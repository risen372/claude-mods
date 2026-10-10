import { atom, read, update } from 'claude-code'
import type { Register, Timer } from 'claude-code'

import type { Band } from '../types'

const STEPS = ['Read', 'Plan', 'Edit', 'Test', 'Done']
const BAR = 36

const idle: Band = {
  active: false,
  finished: false,
  action: '',
  stage: 1,
  visited: [false, false, false, false, false],
  tools: 0,
  startedAt: 0,
  now: 0,
}

const band = atom({ plugin: 'status-band', key: 'band' } as const, idle)

const READ = ['Read', 'Grep', 'Glob', 'WebFetch', 'WebSearch', 'ToolSearch']
const EDIT = ['Edit', 'Write', 'NotebookEdit']
const PLAN = ['Agent', 'Task', 'TodoWrite', 'EnterPlanMode', 'ExitPlanMode']

const base = (p: unknown) => String(p ?? '').split(/[\/]/).pop() ?? ''
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

const describe = (e: Record<string, unknown>): { stage: number; action: string } => {
  const tool = String(e.tool)
  if (READ.includes(tool)) {
    const what = base(e.file_path) || clip(String(e.pattern ?? e.query ?? e.url ?? ''), 30)
    return { stage: 0, action: what ? `Reading ${what}` : `Searching (${tool})` }
  }
  if (EDIT.includes(tool)) {
    return { stage: 2, action: `${tool === 'Write' ? 'Writing' : 'Editing'} ${base(e.file_path ?? e.notebook_path) || 'file'}` }
  }
  if (tool === 'Bash' || tool === 'PowerShell') {
    return { stage: 3, action: `Running ${clip(String(e.command ?? ''), 40)}` }
  }
  if (PLAN.includes(tool)) {
    return { stage: 1, action: tool === 'Agent' || tool === 'Task' ? 'Running a subagent' : 'Planning' }
  }
  return { stage: 3, action: `Using ${tool.replace(/^mcp__/, '')}` }
}

const fmt = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export const register: Register = on => {
  let ticker: Timer | undefined
  let hider: Timer | undefined

  on('turn.start', async ($, e, next) => {
    ticker?.cancel()
    hider?.cancel()
    const t = await $.clock.now()
    await update($, band, () => ({
      ...idle,
      active: true,
      action: 'Thinking…',
      visited: [false, true, false, false, false],
      startedAt: t,
      now: t,
    }))
    ticker = $.clock.every(1000, async () => {
      const n = await $.clock.now()
      await update($, band, b => ({ ...b, now: n }))
    })

    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const d = describe(e as unknown as Record<string, unknown>)
    await update($, band, b => {
      const visited = b.visited.slice()
      visited[d.stage] = true
      return { ...b, action: d.action, stage: d.stage, visited, tools: b.tools + 1 }
    })

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    ticker?.cancel()
    const n = await $.clock.now()
    await update($, band, b => ({
      ...b,
      finished: true,
      action: e.reason === 'answer' ? 'Done' : e.reason === 'aborted' ? 'Interrupted' : 'Stopped',
      stage: 4,
      visited: [true, true, true, true, true],
      now: n,
    }))
    hider = $.clock.after(5000, () => {
      update($, band, () => idle)
    })

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const b = await read($, band)
    if (e.props.hasSurvey || !b.active) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)
    const pct = b.finished ? 100 : Math.min(95, Math.round(100 * (1 - Math.exp(-b.tools / 10))))
    const fill = Math.round((pct / 100) * BAR)
    const color = b.finished ? 'success' : 'suggestion'

    return (
      <Box flexDirection="column" borderStyle="round" borderColor={color} paddingX={1}>
        <Box justifyContent="space-between">
          <Text bold color={color}>
            {b.action}
          </Text>
          <Text dimColor>
            {b.finished ? `${b.tools} tool calls` : `${b.tools} tool calls`} · {fmt(b.now - b.startedAt)}
          </Text>
        </Box>
        <Text>
          <Text color={color}>{'█'.repeat(fill)}</Text>
          <Text dimColor>{'░'.repeat(BAR - fill)}</Text>
          <Text dimColor> {pct}%</Text>
        </Text>
        <Box gap={1}>
          {STEPS.map((s, i) => {
            const now = !b.finished && i === b.stage
            const done = b.visited[i] && !now
            return (
              <Text key={s} bold={now} inverse={now} color={done ? 'success' : undefined} dimColor={!now && !done}>
                {now ? ` ${s} ` : done ? `✓ ${s}` : s}
              </Text>
            )
          })}
        </Box>
      </Box>
    )
  })
}

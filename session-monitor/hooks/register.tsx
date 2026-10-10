import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { SessionRow } from '../types'

const PANE = 'sessions'
const rows = atom({ plugin: 'session-monitor', key: 'rows' } as const, [] as SessionRow[])
const error = atom({ plugin: 'session-monitor', key: 'error' } as const, '')
const EVERY_MS = 2000

// Maps whatever status word a session file carries onto the three the pane shows.
export const toStatus = (raw: unknown): SessionRow['status'] => {
  const s = String(raw ?? '').toLowerCase()
  if (/wait|need|ask|permission|question|input/.test(s)) return 'needs'
  if (/busy|work|run|active|think/.test(s)) return 'working'
  return 'done'
}

const ICON = { needs: '?', working: '●', done: '✓' } as const

// The one place that knows where session records live and what they hold.
const load = async ($: any) => {
  const home = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME'))
  const dir = `${home}/.claude/sessions`
  const out: SessionRow[] = []
  for (const f of await $.fs.list(dir)) {
    if (!f.name.endsWith('.json')) continue
    try {
      const d = JSON.parse(await $.fs.read(`${dir}/${f.name}`))
      const cwd = String(d.cwd ?? '')
      out.push({
        id: String(d.sessionId ?? f.name),
        name: String(d.name ?? d.title ?? cwd.split(/[\/]/).filter(Boolean).pop() ?? f.name),
        status: toStatus(d.status),
        detail: String(d.status ?? ''),
      })
    } catch {}
  }
  return out
}

const refresh = async ($: any) => {
  try {
    const next = await load($)
    await update($, rows, () => next)
    await update($, error, () => '')
  } catch (err) {
    await update($, error, () => String((err as Error)?.message ?? err))
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'sessions', description: 'Show or hide the sessions pane' })
    void refresh($)
    $.clock.every(EVERY_MS, () => void refresh($))
    return next(e)
  })

  on('command.run', { command: 'sessions' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Sessions' })
    return { text: 'session-monitor: Toggled the sessions pane.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const list = await read($, rows)
    const err = await read($, error)
    const n = (s: SessionRow['status']) => list.filter(r => r.status === s).length
    const room = Math.max(1, (e.viewport?.rows ?? 24) - 4)
    const order = { needs: 0, working: 1, done: 2 } as const
    const sorted = [...list].sort((a, b) => order[a.status] - order[b.status])

    return (
      <Box flexDirection="column">
        <Text bold>
          [ Sessions ] ? {n('needs')} needs you · ● {n('working')} working · ✓ {n('done')} done
        </Text>
        {err !== '' && <Text color="red">{err}</Text>}
        {sorted.slice(0, room).map(r => (
          <Text color={r.status === 'needs' ? 'yellow' : r.status === 'working' ? 'red' : 'green'}>
            {ICON[r.status]} {r.name} {r.status}
          </Text>
        ))}
      </Box>
    )
  })
}

import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Assumption } from '../types'

const TOOL = 'mcp__assumption-tracker__log_assumption'

const items = atom({ plugin: 'assumption-tracker', key: 'items' } as const, [])
const isOpen = atom({ plugin: 'assumption-tracker', key: 'isOpen' } as const, false)
const correcting = atom({ plugin: 'assumption-tracker', key: 'correcting' } as const, null)

const GUIDANCE = [
  'Assumption tracker: whenever you build or change something and have to assume',
  'something the user did not specify (a default, a library, a data shape, a scope',
  'limit, a design choice), call the log_assumption tool with one short sentence',
  'stating the assumption, then carry on. Do not stop to ask. The user reviews the',
  'list and replies with corrections; treat a correction as authoritative and',
  'update the work to match it.',
].join(' ')

export const register: Register = on => {
  let nextId = 1

  on('session.start', async ($, e, next) => {
    await $.tool.register({
      name: 'log_assumption',
      description:
        'Record an assumption you are making while building (something the user did not specify). ' +
        'Call it as soon as you make the assumption, one sentence each, then continue working.',
      inputSchema: {
        type: 'object',
        properties: {
          assumption: { type: 'string', description: 'The assumption, one short sentence.' },
          area: { type: 'string', description: 'Optional short label, e.g. "Initial state".' },
        },
        required: ['assumption'],
      },
      isDeferred: false,
    })

    return next(e)
  })

  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)

    return {
      sections: [
        ...composed.sections,
        { id: 'assumption-tracker:guidance', text: GUIDANCE, scope: 'session' },
      ],
    }
  })

  on('tool.call', { tool: TOOL }, async ($, e) => {
    const input = e as unknown as { assumption?: string; area?: string }
    const text = String(input.assumption ?? '').trim()

    if (text === '') {
      return { deny: 'assumption-tracker: `assumption` is required.' }
    }

    const item: Assumption = {
      id: nextId++,
      text,
      area: input.area?.trim() || undefined,
      verdict: 'pending',
    }
    await update($, items, list => [...list, item])

    return { result: `Logged assumption #${item.id}. Continue working.` }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const list = await read($, items)

    if (list.length === 0 || e.props.hasSurvey) {
      return next(e)
    }

    const { Box, Button, Input, Text } = $.ui.resolve(e)
    const pending = list.filter(one => one.verdict === 'pending')
    const open = await read($, isOpen)
    const editing = await read($, correcting)

    const label = `${pending.length} assumption${pending.length === 1 ? '' : 's'} to review (${list.length} total)`

    const header = (
      <Box>
        <Text color="yellow">◆ {label} · </Text>
        <Button
          key="toggle"
          label={open ? 'close' : 'open'}
          onPress={() => update($, isOpen, v => !v)}
        />
      </Box>
    )

    if (!open) {
      return header
    }

    return (
      <Box flexDirection="column">
        {header}
        {pending.length === 0 && <Text dimColor>Everything reviewed.</Text>}
        {pending.map(one => (
          <Box key={`row-${one.id}`} flexDirection="column">
            <Text>
              #{one.id}
              {one.area ? ` ${one.area}:` : ''} {one.text}
            </Text>
            {editing === one.id ? (
              <Input
                key={`fix-${one.id}`}
                label="What should it be instead? "
                placeholder="type the correction, Enter to send"
                submitLabel="send"
                autoFocus
                onSubmit={async value => {
                  const fix = value.trim()
                  if (fix === '') return
                  await update($, items, l =>
                    l.map(x => (x.id === one.id ? { ...x, verdict: 'wrong', correction: fix } : x)),
                  )
                  await update($, correcting, () => null)
                  void $.prompt.submit({
                    text:
                      `Assumption #${one.id} was WRONG: "${one.text}"\n` +
                      `It should be instead: ${fix}\n` +
                      'Update the work to match, and log any new assumptions.',
                  })
                }}
              />
            ) : (
              <Box>
                <Button
                  key={`right-${one.id}`}
                  label="✓ Right"
                  onPress={() =>
                    update($, items, l =>
                      l.map(x => (x.id === one.id ? { ...x, verdict: 'right' } : x)),
                    )
                  }
                />
                <Text> </Text>
                <Button
                  key={`wrong-${one.id}`}
                  label="✗ Wrong"
                  onPress={() => update($, correcting, () => one.id)}
                />
              </Box>
            )}
          </Box>
        ))}
      </Box>
    )
  })
}

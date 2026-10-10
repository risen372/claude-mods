import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Idea } from '../types'

const ideas = atom({ plugin: 'idea-shelf', key: 'ideas' } as const, [])

const STORE_KEY = 'ideas'

let counter = 0

const status = ($: any, list: Idea[]) =>
  $.ui.status(list.length === 0 ? undefined : `💡 ${list.length} shelved`)

const save = async ($: any, list: Idea[]) => {
  await $.store.set(STORE_KEY, list)
  status($, list)
}

const add = async ($: any, raw: string) => {
  const text = raw.trim()
  if (text === '') return false
  counter += 1
  const idea: Idea = { id: `${Date.now()}-${counter}`, text }
  const list = await update($, ideas, l => [...l, idea])
  await save($, list)
  return true
}

const remove = async ($: any, id: string) => {
  const list = await update($, ideas, l => l.filter(i => i.id !== id))
  await save($, list)
}

const send = async ($: any, idea: Idea) => {
  await remove($, idea.id)
  void $.prompt.submit({ text: idea.text, asUser: true })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const saved = (await $.store.get(STORE_KEY)) as Idea[] | undefined
    const list = Array.isArray(saved) ? saved : []
    await update($, ideas, () => list)
    status($, list)
    await $.command.register({
      name: 'idea',
      description: 'Shelve an idea for later: /idea <text>',
    })

    return next(e)
  })

  on('command.run', { command: 'idea' }, async ($, e) => {
    const text = e.args.trim()
    if (text === '') {
      const list = await read($, ideas)
      return {
        text:
          list.length === 0
            ? 'Shelf empty. Add with /idea <text>.'
            : list.map((i, n) => `${n + 1}. ${i.text}`).join('\n'),
      }
    }
    await add($, text)
    $.ui.toast('💡 Idea shelved')

    return { text: `Shelved: ${text}` }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const list = await read($, ideas)
    const { Box, Button, Input, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        {list.map(idea => (
          <Box key={`row-${idea.id}`}>
            <Button
              key={`send-${idea.id}`}
              label="Send"
              onPress={() => send($, idea)}
            />
            <Button
              key={`del-${idea.id}`}
              label="×"
              onPress={() => remove($, idea.id)}
            />
            <Text> {idea.text}</Text>
          </Box>
        ))}
        <Input
          key="new-idea"
          label="💡 "
          placeholder="New idea… (Enter to shelve)"
          submitLabel="shelve"
          onSubmit={value => {
            void add($, value)
          }}
        />
      </Box>
    )
  })
}

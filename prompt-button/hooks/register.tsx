import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { PromptButtonStatus } from '../types'
import { SYSTEM } from './system'

const status = atom({ plugin: 'prompt-button', key: 'status' } as const, 'idle' as PromptButtonStatus)
const original = atom({ plugin: 'prompt-button', key: 'original' } as const, '')

export const register: Register = on => {
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) {
      return next(e)
    }

    const state = await read($, status)
    const { Box, Button, Text } = $.ui.resolve(e)

    const generate = async () => {
      const box = await $.prompt.read()
      const draft = box.text.trim()

      if (draft === '') {
        $.ui.toast('Type something in the prompt box first')
        return
      }

      await update($, status, () => 'working')

      const r = await $.model.complete({
        model: 'sonnet',
        system: SYSTEM,
        prompt: `My request:\n${draft}`,
        maxTokens: 4000,
        timeoutMs: 90000,
      })

      if (!r.isAnswered) {
        await update($, status, () => 'idle')
        $.ui.toast(`Prompt generation failed (${r.reason})`)
        return
      }

      await update($, original, () => draft)
      await $.prompt.fill({ text: r.text.trim(), mode: 'replace' })
      await update($, status, () => 'done')
    }

    const undo = async () => {
      await $.prompt.fill({ text: await read($, original), mode: 'replace' })
      await update($, status, () => 'idle')
    }

    if (state === 'working') {
      return (
        <Box>
          <Text dimColor>Generating prompt…</Text>
        </Box>
      )
    }

    return (
      <Box>
        <Button key="gen" label="✨ Generate prompt" onPress={generate} />
        {state === 'done' ? <Text> </Text> : null}
        {state === 'done' ? <Button key="undo" label="Undo" onPress={undo} /> : null}
      </Box>
    )
  })
}

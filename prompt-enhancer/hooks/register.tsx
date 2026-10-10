import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { EnhanceStatus } from '../types'

const status = atom({ plugin: 'prompt-enhancer', key: 'status' } as const, 'idle' as EnhanceStatus)

const MAX_CONTEXT = 6000

const SYSTEM = `You rewrite a developer's short, vague prompt into a clear, specific prompt for a coding assistant.
Use the project instructions and the available skills below to make the request concrete: name relevant skills with /skill-name when they clearly apply, follow stated conventions, state acceptance criteria and constraints.
Keep the original intent. Do not invent requirements the project context does not support. Do not answer the request.
Output ONLY the rewritten prompt text, with no preface, quotes or markdown fences.`

const readOr = async ($: any, path: string) => {
  try {
    return (await $.fs.read(path)) as string
  } catch {
    return ''
  }
}

const skillNames = async ($: any, dir: string) => {
  try {
    const entries = await $.fs.list(dir)
    return entries.filter((x: any) => x.kind === 'dir').map((x: any) => x.name as string)
  } catch {
    return [] as string[]
  }
}

const gatherContext = async ($: any) => {
  const cwd: string = await $.session.cwd()
  const home: string = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME')) ?? ''
  const claudeMd = (await readOr($, `${cwd}/CLAUDE.md`)) || (await readOr($, `${cwd}/.claude/CLAUDE.md`))
  const userMd = home ? await readOr($, `${home}/.claude/CLAUDE.md`) : ''
  const skills = [
    ...(await skillNames($, `${cwd}/.claude/skills`)),
    ...(home ? await skillNames($, `${home}/.claude/skills`) : []),
  ]
  const parts = [
    claudeMd && `## Project CLAUDE.md\n${claudeMd.slice(0, MAX_CONTEXT)}`,
    userMd && `## User CLAUDE.md\n${userMd.slice(0, MAX_CONTEXT / 2)}`,
    skills.length > 0 && `## Installed skills\n${[...new Set(skills)].join(', ')}`,
    `## Working directory\n${cwd}`,
  ].filter(Boolean)
  return parts.join('\n\n')
}

export const register: Register = on => {
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) {
      return next(e)
    }

    const current = await read($, status)
    const { Box, Text, Button } = $.ui.resolve(e)
    const isBusy = current === 'enhancing' || e.props.isWorking

    const enhance = async () => {
      const draft = (await $.prompt.read()).text.trim()
      if (!draft) {
        $.ui.toast('Type a prompt first, then press Enhance.')
        return
      }
      await update($, status, () => 'enhancing')
      try {
        const context = await gatherContext($)
        const r = await $.model.complete({
          model: 'sonnet',
          system: SYSTEM,
          prompt: `${context}\n\n## Vague prompt\n${draft}`,
        })
        if (r.isAnswered && r.text.trim()) {
          await $.prompt.fill({ text: r.text.trim(), mode: 'replace' })
          await update($, status, () => 'enhanced')
        } else {
          $.ui.toast('Enhance failed; your prompt is unchanged.')
          await update($, status, () => 'failed')
        }
      } catch {
        $.ui.toast('Enhance failed; your prompt is unchanged.')
        await update($, status, () => 'failed')
      }
    }

    const send = async () => {
      const draft = (await $.prompt.read()).text.trim()
      if (!draft) {
        return
      }
      await $.prompt.fill({ text: '', mode: 'replace' })
      await update($, status, () => 'idle')
      void $.prompt.submit({ text: draft })
    }

    const label =
      current === 'enhancing'
        ? 'Enhancing…'
        : current === 'enhanced'
          ? 'Enhanced. Edit it, then Send.'
          : current === 'failed'
            ? 'Enhance failed.'
            : ''

    return (
      <Box>
        <Text dimColor>Prompt enhancer </Text>
        <Button key="enhance" label="Enhance (e)" hotkey="e" onPress={() => (isBusy ? undefined : enhance())} />
        <Text> </Text>
        <Button key="send" label="Send (s)" hotkey="s" onPress={() => send()} />
        {label ? <Text dimColor> {label}</Text> : null}
      </Box>
    )
  })
}

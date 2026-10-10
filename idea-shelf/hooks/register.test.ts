import { expect, mock, test } from 'claude-code/testing'

test('/idea shelves text and lists it back', async ($, on) => {
  mock.store(on)
  on('session.start', async e => ({ cwd: '/work' }) as any)
  on('command.register', async () => ({ value: undefined }) as any)
  on('ui.status', async () => ({ value: undefined }) as any)
  on('ui.toast', async () => ({ value: undefined }) as any)
  await $.session.start({ cwd: '/work', source: 'startup' } as any)
  const added = await $.command.run({ command: 'idea', args: 'add dark mode' })
  expect(String(added.text)).toContain('add dark mode')
  const listed = await $.command.run({ command: 'idea', args: '' })
  expect(String(listed.text)).toContain('1. add dark mode')
})

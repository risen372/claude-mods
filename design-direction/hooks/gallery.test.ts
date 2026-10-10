import { test, expect } from 'claude-code/testing'
import { gallery } from './register'

test('gallery renders html previews and skips plain questions', () => {
  const q = { question: 'Which?', options: [{ label: 'A', preview: '<div>hi "x"</div>' }, { label: 'B' }] }
  const html = gallery([q])!
  expect(html).toContain('&lt;div&gt;hi &quot;x&quot;')
  expect(html).toContain('Press the number')
  expect(gallery([{ question: 'Plain?', options: [{ label: 'A' }] }])).toBe(undefined)
})

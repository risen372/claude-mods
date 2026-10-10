import { test, expect } from 'claude-code/testing'
import { scan } from './register'

test('flags common AI tells', () => {
  const hits = scan("Certainly! Let's delve into this \u2014 it's a robust, seamless tapestry. Feel free to ask.")
  const labels = hits.map(h => h.label)
  expect(labels).toContain('em dash')
  expect(labels).toContain('stock opener')
  expect(labels).toContain('delve/tapestry words')
  expect(labels).toContain('closing offer')
})

test('plain text passes clean', () => {
  expect(scan('Fixed the bug. The loop was off by one.')).toEqual([])
})

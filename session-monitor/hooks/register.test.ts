import { test, expect } from 'claude-code/testing'
import { toStatus } from './register'

test('maps status words', () => {
  expect(toStatus('waiting')).toBe('needs')
  expect(toStatus('busy')).toBe('working')
  expect(toStatus('idle')).toBe('done')
  expect(toStatus(undefined)).toBe('done')
})

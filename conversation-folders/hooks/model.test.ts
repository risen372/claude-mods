import { test, expect } from 'claude-code/testing'

import * as m from './model'

test('folders, filing, pins and removal', async () => {
  let d = m.addFolder(m.empty, '  Game Library ', 'f1')
  d = m.addFolder(d, 'Tech Camps', 'f2')
  expect(d.folders.map(f => f.name)).toEqual(['Game Library', 'Tech Camps'])
  expect(m.addFolder(d, '   ', 'f3')).toEqual(d)

  d = m.upsertChat(d, 's1', 'Fix the MobyGames lookup rate limit', 10)
  d = m.upsertChat(d, 's1', 'ignored once known', 20)
  expect(d.chats).toHaveLength(1)
  expect(d.chats[0]?.at).toBe(20)
  expect(d.chats[0]?.title).toBe('Fix the MobyGames lookup rate limit')

  d = m.fileChat(d, 's1', 'f1')
  expect(m.inFolder(d, 'f1')).toHaveLength(1)
  expect(m.inFolder(d, null)).toHaveLength(0)

  expect(m.findFolder(d, 'tech')?.id).toBe('f2')
  expect(m.findFolder(d, 'nope')).toBeUndefined()

  d = m.togglePinFolder(d, 'f1')
  d = m.togglePinChat(d, 's1')
  expect(d.folders[0]?.pinned).toBe(true)
  expect(d.chats[0]?.pinned).toBe(true)

  d = m.removeFolder(d, 'f1')
  expect(d.folders).toHaveLength(1)
  expect(d.chats[0]?.folderId).toBeNull()
})

test('titles are one short line', async () => {
  expect(m.titleOf('  a\n\n b  ')).toBe('a b')
  expect(m.titleOf('x'.repeat(100))).toHaveLength(60)
  expect(m.titleOf('')).toBe('Untitled chat')
})

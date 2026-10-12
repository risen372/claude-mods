import type { Chat, Data, Folder } from '../types'

export const COLORS = ['green', 'yellow', 'magenta', 'red', 'blue', 'cyan']

export const empty: Data = { folders: [], chats: [] }

export function normalize(raw: unknown): Data {
  const d = raw as Partial<Data> | null | undefined
  return {
    folders: Array.isArray(d?.folders) ? d.folders : [],
    chats: Array.isArray(d?.chats) ? d.chats : [],
  }
}

export function addFolder(d: Data, name: string, id: string): Data {
  const clean = name.trim()
  if (clean === '') return d
  const folder: Folder = {
    id,
    name: clean,
    color: COLORS[d.folders.length % COLORS.length] as string,
    pinned: false,
  }
  return { ...d, folders: [...d.folders, folder] }
}

export function removeFolder(d: Data, id: string): Data {
  return {
    folders: d.folders.filter(f => f.id !== id),
    chats: d.chats.map(c => (c.folderId === id ? { ...c, folderId: null } : c)),
  }
}

export function togglePinFolder(d: Data, id: string): Data {
  return {
    ...d,
    folders: d.folders.map(f => (f.id === id ? { ...f, pinned: !f.pinned } : f)),
  }
}

export function togglePinChat(d: Data, id: string): Data {
  return {
    ...d,
    chats: d.chats.map(c => (c.id === id ? { ...c, pinned: !c.pinned } : c)),
  }
}

export function upsertChat(d: Data, id: string, title: string, at: number): Data {
  const known = d.chats.find(c => c.id === id)
  if (known) {
    return { ...d, chats: d.chats.map(c => (c.id === id ? { ...c, at } : c)) }
  }
  const chat: Chat = { id, title: titleOf(title), folderId: null, pinned: false, at }
  return { ...d, chats: [...d.chats, chat] }
}

export function fileChat(d: Data, chatId: string, folderId: string | null): Data {
  return {
    ...d,
    chats: d.chats.map(c => (c.id === chatId ? { ...c, folderId } : c)),
  }
}

export function findFolder(d: Data, name: string): Folder | undefined {
  const q = name.trim().toLowerCase()
  if (q === '') return undefined
  return (
    d.folders.find(f => f.name.toLowerCase() === q) ??
    d.folders.find(f => f.name.toLowerCase().startsWith(q))
  )
}

export function titleOf(text: string): string {
  const one = text.replace(/\s+/g, ' ').trim()
  if (one === '') return 'Untitled chat'
  return one.length > 60 ? `${one.slice(0, 57)}...` : one
}

export function inFolder(d: Data, id: string | null): Chat[] {
  return d.chats.filter(c => c.folderId === id).sort((a, b) => b.at - a.at)
}

export function recent(d: Data, n: number): Chat[] {
  return [...d.chats].sort((a, b) => b.at - a.at).slice(0, n)
}

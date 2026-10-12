export type Folder = { id: string; name: string; color: string; pinned: boolean }
export type Chat = {
  id: string
  title: string
  folderId: string | null
  pinned: boolean
  at: number
}
export type Data = { folders: Folder[]; chats: Chat[] }
export type View = 'tree' | 'home'

declare module 'claude-code' {
  interface PluginState {
    'conversation-folders': {
      data: Data
      view: View
      open: string[]
      naming: boolean
      moving: boolean
    }
  }
}

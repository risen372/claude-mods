export type SessionRow = { id: string; name: string; status: 'needs' | 'working' | 'done'; detail: string }

declare module 'claude-code' {
  interface PluginState {
    'session-monitor': { rows: SessionRow[]; error: string }
  }
}

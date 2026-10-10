export type Band = {
  active: boolean
  finished: boolean
  action: string
  stage: number
  visited: boolean[]
  tools: number
  startedAt: number
  now: number
}

declare module 'claude-code' {
  interface PluginState {
    'status-band': { band: Band }
  }
}

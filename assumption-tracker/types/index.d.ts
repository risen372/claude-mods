export type Verdict = 'pending' | 'right' | 'wrong'

export type Assumption = {
  id: number
  text: string
  area?: string
  verdict: Verdict
  correction?: string
}

declare module 'claude-code' {
  interface PluginState {
    'assumption-tracker': {
      items: Assumption[]
      isOpen: boolean
      correcting: number | null
    }
  }
}

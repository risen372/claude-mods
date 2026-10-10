export type PromptButtonStatus = 'idle' | 'working' | 'done'

declare module 'claude-code' {
  interface PluginState {
    'prompt-button': { status: PromptButtonStatus; original: string }
  }
}

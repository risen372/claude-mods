export type EnhanceStatus = 'idle' | 'enhancing' | 'enhanced' | 'failed'

declare module 'claude-code' {
  interface PluginState {
    'prompt-enhancer': { status: EnhanceStatus }
  }
}

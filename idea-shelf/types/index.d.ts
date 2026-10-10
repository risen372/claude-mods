export type Idea = { id: string; text: string }

declare module 'claude-code' {
  interface PluginState {
    'idea-shelf': { ideas: Idea[] }
  }
}

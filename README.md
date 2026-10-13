
# claude-mods

A collection of Claude Code mods (plugins).

## Install

In a terminal Claude Code session:

```
/plugin install <mod> --marketplace risen372/claude-mods
```

Answer `y` to add the marketplace, then choose a scope. Replace `<mod>` with any name below.

| Mod | What it does |
| --- | --- |
| `assumption-tracker` | Claude logs the assumptions it makes mid-build; a band above the prompt expands into a list where you mark each Right or Wrong. |
| `conversation-folders` | Folders, pins and a home screen for your conversations, in a docked pane with a Classic switch to go back. |
| `design-direction` | When Claude asks for design direction, renders each option as a visual mockup in a browser gallery so you can pick by sight. |
| `human-voice` | Steers wording toward a natural human voice and double-checks every answer for obvious AI tells. |
| `idea-shelf` | Shelve side ideas while Claude works (`/idea <text>`), then send them with one click. |
| `prompt-button` | A Generate prompt button above the prompt box: rewrites your draft into a detailed, optimized AI prompt in place, with Undo. |
| `prompt-enhancer` | Band above the prompt with Enhance and Send buttons: rewrites a vague prompt using the project's CLAUDE.md and installed skills. |
| `session-monitor` | A side pane (`/sessions`) listing every active Claude session as working, needs you, or done. |
| `status-band` | Stage card above the prompt while Claude works: current action, an estimated progress bar, elapsed time, and a Read / Plan / Edit / Test / Done trail. |

The install command is only available in a terminal session, not the desktop app's Code tab. A mod installed from a terminal at user scope also loads in the desktop app.

## Develop

```
claude --plugin-dir ./<mod>
claude plugin validate ./<mod>
claude plugin test ./<mod>
```

## Claude.ai versions

Claude.ai chat has no mod system, so [`claude-ai/`](claude-ai) rebuilds the mods as a Chrome extension (prompt button, enhancer, idea shelf, status band, sessions pane) plus pasteable instructions (human-voice, design-direction, assumption-tracker). See [`claude-ai/README.md`](claude-ai/README.md) for install steps.

[`claude-folders-extension/`](claude-folders-extension) is the Chrome extension version of conversation-folders: a Folders section in the claude.ai sidebar. See its README for install steps.

# Risen Mods for Claude.ai

Claude.ai chat has no mod or hook system, so these are rebuilt two ways:

- **`extension/`** is one Chrome extension for the mods that draw something on screen.
- **`instructions/`** holds text you paste into Claude.ai for the mods that only change how Claude behaves.

| Claude Code mod | Claude.ai version |
| --- | --- |
| `prompt-button` | **Generate prompt** button above the prompt box (extension) |
| `prompt-enhancer` | **Enhance** button plus a saved **Context** box (extension) |
| `idea-shelf` | **Ideas** shelf above the prompt box (extension) |
| `status-band` | Status band while Claude replies: stage, elapsed time, progress, step trail (extension) |
| `session-monitor` | **Sessions** pill and pane listing your open Claude tabs (extension) |
| `human-voice` | Pasteable instruction (`instructions/human-voice.md`), plus an "AI tells" chip in the status band (extension) |
| `design-direction` | Pasteable instruction (`instructions/design-direction.md`): options come back as one artifact |
| `assumption-tracker` | Pasteable instruction (`instructions/assumption-tracker.md`): an "Assumptions" list you answer by number |
| `conversation-folders` | Already done: see `../claude-folders-extension` |

## Install the extension

1. Open `chrome://extensions` and turn on Developer mode.
2. Click **Load unpacked** and pick the `claude-ai/extension` folder.
3. Reload claude.ai.

Works in Chrome and other Chromium browsers. The Claude desktop app can't load extensions.

## Install the instructions

Open `instructions/all-in-one.md` (or one of the single files), copy it, and paste it into your Claude.ai personal preferences (Settings, Profile) so it applies everywhere, or into a Project's instructions so it applies to that project only.

## How the buttons work

Claude.ai gives an extension no way to call Claude quietly in the background, so **Generate prompt** and **Enhance** use the chat itself:

1. Type a rough prompt, then press **Generate prompt** (or **Enhance**).
2. The extension swaps your draft for a rewrite request and sends it. Your original is kept.
3. When Claude finishes, press **Use reply** to put the rewritten prompt in the box, or **Use & send** to send it right away. **Undo** restores your original draft.

That means the rewrite request shows up in the conversation. Do it in a new chat if you don't want it mixed into an existing one.

**Enhance** has no CLAUDE.md or skills to read in chat. Put whatever it should know (stack, conventions, tone) in **Context**; it is added to every Enhance request.

**Ideas** shelves a note while Claude is busy. **Send** puts it in the box and sends it, or adds it to your draft if you already typed something. **Shelve draft** moves what's in the box onto the shelf.

**Sessions** shows each open claude.ai tab as working, ready for you (a reply finished while you were in another tab), or idle. Click a row to jump to that tab. Alt+Shift+S hides or shows the pill.

Ideas, context and settings are stored in the browser (`chrome.storage.local`), per Chrome profile.

## Limits

- Claude.ai can change its page structure. If a button can't find the prompt box or Claude's reply, it does nothing or says so; the selectors are all at the top of `content.js`.
- The status band's progress bar is an estimate based on reply length, not a real percentage.
- Anything the Claude Code versions did with local files (reading CLAUDE.md, the sessions folder, opening a browser gallery) is replaced with the equivalents above, not copied.

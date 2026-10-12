# Claude Folders (Chrome extension for claude.ai)

Adds a Folders section inside the claude.ai sidebar, right under New / Projects / Artifacts / Scheduled / Customize / More.

- Folders hold chats. Pin folders and individual chats.
- Hover a chat in Recents and use the folder icon to file it. Filed chats move out of Recents and into their folder.
- Home: a full-page board of pinned items, folders and recent chats (search included).
- Classic: one click puts the sidebar back exactly as Claude ships it. "Use Folders" brings it back.
- The Chat/Code switch, the top menu items and your profile are never touched.

## Install
1. Unzip this folder.
2. Open chrome://extensions and turn on Developer mode.
3. Click "Load unpacked" and pick the folder.
4. Reload claude.ai.

Folders are stored in the browser (chrome.storage.local), per Chrome profile.

## Limits
- Chrome and other Chromium browsers only. The Claude desktop app cannot load extensions.
- It sees chats that appear in the sidebar's Recents list, so older chats appear after you scroll or open them.
- claude.ai can change its page structure. If the sidebar section disappears, a floating "Folders" button still opens Home.

# Claude Folders for Firefox

Same Folders section, pins, Home screen and Classic switch as the Chrome version, inside the claude.ai sidebar.

## Try it (temporary, until Firefox restarts)
1. Open `about:debugging#/runtime/this-firefox`.
2. Click "Load Temporary Add-on..." and pick `manifest.json` in this folder.
3. Reload claude.ai.

## Keep it installed
Firefox only keeps unsigned add-ons in Developer Edition, Nightly or ESR. In those, set `xpinstall.signatures.required` to false in `about:config`, then open `claude-folders-firefox.xpi` (File > Open File).
In regular Firefox, sign it free as "unlisted" at addons.mozilla.org (Developer Hub > Submit a New Add-on > On your own), then install the signed .xpi.

Folders are stored in this Firefox profile. Needs Firefox 113 or newer.

// Keeps a shared list of open claude.ai tabs for the Sessions pane.
// Each tab reports its status here; the pane in every tab reads the list from storage.
const KEY = 'cm_sessions'

const load = async () => {
  const v = await chrome.storage.local.get(KEY)
  return v[KEY] || {}
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'whoami') {
    sendResponse({ tabId: sender.tab ? sender.tab.id : null })
    return false
  }
  if (msg && msg.type === 'report' && sender.tab) {
    ;(async () => {
      const all = await load()
      all[sender.tab.id] = {
        tabId: sender.tab.id,
        windowId: sender.tab.windowId,
        title: String(msg.title || ''),
        url: String(msg.url || ''),
        status: String(msg.status || 'idle'),
        ts: Date.now(),
      }
      await chrome.storage.local.set({ [KEY]: all })
    })()
  } else if (msg && msg.type === 'focus' && typeof msg.tabId === 'number') {
    chrome.tabs
      .update(msg.tabId, { active: true })
      .then(tab => chrome.windows.update(tab.windowId, { focused: true }))
      .catch(() => {})
  }
  return false
})

chrome.tabs.onRemoved.addListener(async tabId => {
  const all = await load()
  if (all[tabId]) {
    delete all[tabId]
    await chrome.storage.local.set({ [KEY]: all })
  }
})

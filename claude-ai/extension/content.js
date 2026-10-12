// Risen Mods for Claude.ai: prompt-button, prompt-enhancer, idea-shelf, status-band,
// session-monitor and the human-voice check, as one content script.
;(() => {
  if (window.__cmMods) return
  window.__cmMods = true

  // ---------- small helpers ----------
  const sleep = ms => new Promise(r => setTimeout(r, ms))
  const $ = (sel, root = document) => root.querySelector(sel)

  const h = (tag, attrs, ...kids) => {
    const el = document.createElement(tag)
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'class') el.className = v
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v)
      else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v)
    }
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue
      el.append(kid.nodeType ? kid : document.createTextNode(String(kid)))
    }
    return el
  }

  const store = {
    get: keys =>
      new Promise(resolve => {
        try {
          chrome.storage.local.get(keys, v => resolve(v || {}))
        } catch {
          resolve({})
        }
      }),
    set: obj => {
      try {
        chrome.storage.local.set(obj)
      } catch {}
    },
  }

  // ---------- claude.ai page access (all selectors in one place) ----------
  const composerEl = () =>
    $('div[contenteditable="true"].ProseMirror') ||
    $('[data-testid="chat-input"]') ||
    $('fieldset div[contenteditable="true"]') ||
    $('div[contenteditable="true"][role="textbox"]')

  const sendBtn = () => $('button[aria-label^="Send"]')
  const stopBtn = () => $('button[aria-label^="Stop"]')

  const assistantNodes = () => {
    const a = [...document.querySelectorAll('[data-is-streaming]')]
    if (a.length) return a
    return [...document.querySelectorAll('.font-claude-response, .font-claude-message')]
  }
  const lastAssistant = () => {
    const list = assistantNodes()
    return list.length ? list[list.length - 1] : null
  }

  const isStreaming = () => {
    if (stopBtn()) return true
    const n = lastAssistant()
    return !!n && n.getAttribute('data-is-streaming') === 'true'
  }

  const readDraft = () => {
    const el = composerEl()
    return el ? (el.innerText || '').replace(/​/g, '').trim() : ''
  }

  const setDraft = text => {
    const el = composerEl()
    if (!el) return false
    el.focus()
    const sel = window.getSelection()
    const range = document.createRange()
    range.selectNodeContents(el)
    sel.removeAllRanges()
    sel.addRange(range)
    if (text === '') {
      document.execCommand('delete')
      return true
    }
    try {
      const dt = new DataTransfer()
      dt.setData('text/plain', text)
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
    } catch {}
    if (!readDraft().includes(text.slice(0, 20).trim())) {
      document.execCommand('insertText', false, text)
    }
    return true
  }

  const sendNow = () => {
    const b = sendBtn()
    if (b && !b.disabled) {
      b.click()
      return
    }
    const el = composerEl()
    if (el) {
      el.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }),
      )
    }
  }

  const lastReplyText = () => {
    const n = lastAssistant()
    if (!n) return ''
    const full = (n.innerText || '').trim()
    const pres = n.querySelectorAll('pre')
    if (pres.length === 1) {
      const code = (pres[0].querySelector('code') || pres[0]).innerText.trim()
      if (code.length > full.length * 0.7) return code
    }
    return full
  }

  // ---------- prompts (ported from prompt-button and prompt-enhancer) ----------
  const GENERATE = `You are an expert AI prompt engineer. Turn whatever I send into a clear, detailed, high-quality prompt I can paste into an AI tool.

When given a request, idea, rough draft, goal, problem, or task:
1. Identify what I am trying to accomplish.
2. Write a complete, optimized prompt with enough context, clear instructions, constraints, and a requested output format.
3. Preserve the intent of the original request. Do not change the goal or add assumptions that could change the result.
4. Include useful details when appropriate: the AI's role or expertise, the task, background, target audience, tone and style, required information, things to avoid, output format/structure/length, and questions the AI should ask if required details are missing.
5. Be specific, practical, and easy to paste. Avoid unnecessary complexity; only include instructions that materially improve the result.
6. Do not complete the task yourself. Use editable placeholders such as [AUDIENCE] or [GOAL] where details are missing.

Output ONLY the final prompt text. No preamble, no code fences, no commentary, no headings.`

  const ENHANCE = `Rewrite my short, vague prompt below into a clear, specific prompt.
Use my saved context (if any) to make it concrete: follow stated conventions, state acceptance criteria and constraints.
Keep my original intent. Do not invent requirements the context does not support. Do not answer the request.
Output ONLY the rewritten prompt text, with no preface, quotes or markdown fences.`

  const buildMeta = (kind, draft, ctx) =>
    kind === 'generate'
      ? `${GENERATE}\n\nMy request:\n${draft}`
      : `${ENHANCE}\n\n${ctx ? `My context:\n${ctx}\n\n` : ''}Vague prompt:\n${draft}`

  // ---------- human-voice tells (ported from human-voice) ----------
  const TELLS = [
    { label: 'em dash', pattern: /—/g },
    { label: 'stock opener', pattern: /(^|\n)\s*(certainly|absolutely|great question|sure thing|of course)[!,.]/gi },
    {
      label: 'delve/tapestry words',
      pattern:
        /\b(delve[sd]?|tapestry|testament|beacon|realm|landscape of|multifaceted|myriad|plethora|intricate|pivotal|vibrant|seamless(ly)?|robust|holistic|synergy|paradigm)\b/gi,
    },
    {
      label: 'hype verbs',
      pattern:
        /\b(leverag(e|es|ed|ing)|utiliz(e|es|ed|ing)|elevate[sd]?|unlock(s|ed|ing)?|streamlin(e|es|ed|ing)|foster(s|ed|ing)?|underscor(e|es|ed|ing)|showcas(e|es|ed|ing))\b/gi,
    },
    {
      label: 'filler phrase',
      pattern:
        /(it'?s (important|worth) (to note|noting)|in today'?s (fast-paced|digital)|when it comes to|at the end of the day|in conclusion|in summary|moving forward|needless to say)/gi,
    },
    { label: 'not-just-but framing', pattern: /\bnot (just|only|merely)\b[^.\n]{1,60}\bbut (also )?\b/gi },
    {
      label: 'closing offer',
      pattern: /(let me know if (you|there)|feel free to|i hope this helps|happy to help|don'?t hesitate to)/gi,
    },
    { label: 'emoji', pattern: /[\u{1F300}-\u{1FAFF}✅❌✨]/gu },
  ]
  const scan = text =>
    TELLS.flatMap(t => {
      const count = (text.match(t.pattern) || []).length
      return count > 0 ? [{ label: t.label, count }] : []
    })

  // ---------- state ----------
  const S = {
    ideas: [],
    ctx: '',
    ideasOpen: false,
    ctxOpen: false,
    job: null, // { kind, sawStream, startedAt, ready }
    original: '',
    note: '',
    toast: '',
  }
  const SB = { active: false, finished: false, stage: 1, startedAt: 0, now: 0, chars: 0, tells: [], hideAt: 0 }
  const SESS = { status: 'idle', all: {}, panelOpen: false, pillHidden: false, tabId: null }

  // ---------- DOM: band above the prompt ----------
  const root = h('div', { class: 'cm-root' })
  const toolsEl = h('div', { class: 'cm-tools' })
  const ctxEl = h('div', { class: 'cm-panel cm-hidden' })
  const ideasEl = h('div', { class: 'cm-panel cm-hidden' })
  const statusEl = h('div', { class: 'cm-status cm-hidden' })
  root.append(statusEl, toolsEl, ctxEl, ideasEl)

  const btn = (label, onClick, opts = {}) =>
    h(
      'button',
      {
        type: 'button',
        class: 'cm-btn' + (opts.primary ? ' cm-primary' : ''),
        title: opts.title || '',
        onmousedown: e => e.preventDefault(),
        onclick: onClick,
      },
      label,
    )

  let toastTimer
  const toast = text => {
    S.toast = text
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => {
      S.toast = ''
      renderTools()
    }, 4000)
    renderTools()
  }

  // ----- prompt-button + prompt-enhancer -----
  const runJob = async kind => {
    if (isStreaming()) return toast('Claude is still replying. Wait for it to finish.')
    const draft = readDraft()
    if (!draft) return toast('Type something in the prompt box first.')
    S.original = draft
    S.job = { kind, sawStream: false, startedAt: Date.now(), ready: false }
    S.note = kind === 'generate' ? 'Generating prompt…' : 'Enhancing…'
    setDraft(buildMeta(kind, draft, S.ctx))
    await sleep(120)
    sendNow()
    renderTools()
  }

  const useReply = andSend => {
    const text = lastReplyText()
    if (!text) return toast('Could not find Claude’s reply.')
    setDraft(text)
    S.job = null
    S.note = andSend ? '' : 'Edit it, then press Send.'
    renderTools()
    if (andSend) {
      setTimeout(sendNow, 150)
    }
  }

  const undo = () => {
    setDraft(S.original)
    S.original = ''
    S.job = null
    S.note = ''
    renderTools()
  }

  // ----- idea-shelf -----
  const saveIdeas = () => store.set({ cm_ideas: S.ideas })
  let idCounter = 0
  const addIdea = raw => {
    const text = String(raw || '').trim()
    if (!text) return false
    idCounter += 1
    S.ideas.push({ id: `${Date.now()}-${idCounter}`, text })
    saveIdeas()
    return true
  }
  const removeIdea = id => {
    S.ideas = S.ideas.filter(i => i.id !== id)
    saveIdeas()
    renderIdeas()
    renderTools()
  }
  const sendIdea = idea => {
    const draft = readDraft()
    if (draft) {
      setDraft(`${draft}\n\n${idea.text}`)
      removeIdea(idea.id)
      toast('Added to your draft.')
      return
    }
    if (isStreaming()) {
      setDraft(idea.text)
      removeIdea(idea.id)
      toast('Placed in the box. Send it when Claude finishes.')
      return
    }
    setDraft(idea.text)
    removeIdea(idea.id)
    setTimeout(sendNow, 150)
  }

  const ideaInput = h('input', {
    class: 'cm-input',
    type: 'text',
    placeholder: 'New idea… (Enter to shelve)',
    onkeydown: e => {
      if (e.key === 'Enter') {
        e.preventDefault()
        if (addIdea(ideaInput.value)) {
          ideaInput.value = ''
          renderIdeas()
          renderTools()
        }
      }
      e.stopPropagation()
    },
  })
  const ideaList = h('div', { class: 'cm-list' })

  const shelveDraft = () => {
    const d = readDraft()
    if (!d) return toast('The prompt box is empty.')
    addIdea(d)
    setDraft('')
    renderIdeas()
    renderTools()
    toast('Draft shelved.')
  }

  const renderIdeas = () => {
    ideasEl.classList.toggle('cm-hidden', !S.ideasOpen)
    if (!S.ideasOpen) return
    ideaList.replaceChildren(
      ...(S.ideas.length === 0
        ? [h('div', { class: 'cm-dim' }, 'Shelf empty.')]
        : S.ideas.map(idea =>
            h(
              'div',
              { class: 'cm-row' },
              btn('Send', () => sendIdea(idea), { title: 'Send to Claude (or add to your draft)' }),
              btn('×', () => removeIdea(idea.id), { title: 'Remove' }),
              h('span', { class: 'cm-text' }, idea.text),
            ),
          )),
    )
    if (!ideasEl.contains(ideaInput)) {
      ideasEl.replaceChildren(
        h('div', { class: 'cm-row' }, ideaInput, btn('Shelve draft', shelveDraft, { title: 'Move the prompt box text onto the shelf' })),
        ideaList,
      )
    }
  }

  // ----- context box for Enhance -----
  const ctxArea = h('textarea', {
    class: 'cm-input cm-area',
    rows: '4',
    placeholder:
      'Anything Enhance should know: your stack, conventions, tone, project background. It is added to every Enhance request.',
    oninput: () => {
      S.ctx = ctxArea.value
      store.set({ cm_ctx: S.ctx })
    },
    onkeydown: e => e.stopPropagation(),
  })
  const renderCtx = () => {
    ctxEl.classList.toggle('cm-hidden', !S.ctxOpen)
    if (!S.ctxOpen) return
    if (!ctxEl.contains(ctxArea)) {
      ctxEl.replaceChildren(h('div', { class: 'cm-dim' }, 'Context for Enhance (saved in this browser)'), ctxArea)
    }
    if (document.activeElement !== ctxArea) ctxArea.value = S.ctx
  }

  // ----- tools row -----
  const renderTools = () => {
    const kids = []
    const busy = !!S.job && !S.job.ready
    kids.push(btn('✨ Generate prompt', () => runJob('generate'), { primary: true, title: 'Rewrite your draft into a detailed, optimized prompt' }))
    kids.push(btn('Enhance', () => runJob('enhance'), { title: 'Tighten a vague prompt using your saved context' }))
    if (S.job && S.job.ready) {
      kids.push(btn('Use reply', () => useReply(false), { primary: true, title: 'Put Claude’s reply in the prompt box' }))
      kids.push(btn('Use & send', () => useReply(true)))
    }
    if (S.original && !busy) kids.push(btn('Undo', undo, { title: 'Restore your original draft' }))
    kids.push(btn(S.ctxOpen ? '⚙ Context ▾' : '⚙ Context', () => {
      S.ctxOpen = !S.ctxOpen
      renderCtx()
    }))
    kids.push(btn(`💡 Ideas${S.ideas.length ? ` (${S.ideas.length})` : ''}${S.ideasOpen ? ' ▾' : ''}`, () => {
      S.ideasOpen = !S.ideasOpen
      store.set({ cm_ideasOpen: S.ideasOpen })
      renderIdeas()
      renderTools()
    }))
    const msg = S.toast || S.note
    if (msg) kids.push(h('span', { class: 'cm-dim cm-note' }, msg))
    toolsEl.replaceChildren(...kids)
  }

  // ----- status-band -----
  const STEPS = ['Sent', 'Thinking', 'Writing', 'Done']
  const fmt = ms => {
    const s = Math.max(0, Math.round(ms / 1000))
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  }
  const renderStatus = () => {
    const visible = SB.active || (SB.finished && Date.now() < SB.hideAt)
    statusEl.classList.toggle('cm-hidden', !visible)
    if (!visible) {
      if (SB.finished) {
        SB.finished = false
      }
      return
    }
    const pct = SB.finished ? 100 : Math.min(95, Math.round(100 * (1 - Math.exp(-SB.chars / 1800))))
    const action = SB.finished ? 'Done' : SB.chars > 0 ? 'Writing reply' : 'Thinking…'
    const total = SB.tells.reduce((n, t) => n + t.count, 0)
    statusEl.classList.toggle('cm-done', SB.finished)
    statusEl.replaceChildren(
      h(
        'div',
        { class: 'cm-status-top' },
        h('b', {}, action),
        h('span', { class: 'cm-dim' }, `${SB.chars.toLocaleString()} chars · ${fmt(SB.now - SB.startedAt)}`),
      ),
      h('div', { class: 'cm-bar' }, h('div', { class: 'cm-fill', style: `width:${pct}%` })),
      h(
        'div',
        { class: 'cm-steps' },
        ...STEPS.map((s, i) => {
          const now = !SB.finished && i === SB.stage
          const done = SB.finished || i < SB.stage
          return h('span', { class: 'cm-step' + (now ? ' cm-now' : done ? ' cm-ok' : '') }, now ? s : done ? `✓ ${s}` : s)
        }),
        SB.finished && total > 0
          ? h(
              'span',
              {
                class: 'cm-chip',
                title: SB.tells.map(t => `${t.label} x${t.count}`).join('\n'),
              },
              `human-voice: ${total} AI tell${total === 1 ? '' : 's'}`,
            )
          : null,
      ),
    )
  }

  // ---------- DOM: sessions pane (session-monitor) ----------
  const pill = h('button', { type: 'button', class: 'cm-pill', onclick: () => togglePanel() }, 'Sessions')
  const panel = h('div', { class: 'cm-sess cm-hidden' })
  const sessWrap = h('div', { class: 'cm-sesswrap' }, panel, pill)

  const ICON = { working: '●', ready: '✓', idle: '○' }
  const LABEL = { working: 'working', ready: 'ready for you', idle: 'idle' }
  const liveSessions = () =>
    Object.values(SESS.all)
      .filter(s => Date.now() - s.ts < 25000)
      .sort((a, b) => ({ ready: 0, working: 1, idle: 2 }[a.status] - { ready: 0, working: 1, idle: 2 }[b.status]))

  const renderSessions = () => {
    sessWrap.classList.toggle('cm-hidden', SESS.pillHidden)
    const list = liveSessions()
    const n = st => list.filter(s => s.status === st).length
    pill.textContent = `Sessions · ● ${n('working')}${n('ready') ? ` · ✓ ${n('ready')}` : ''}`
    panel.classList.toggle('cm-hidden', !SESS.panelOpen)
    if (!SESS.panelOpen) return
    panel.replaceChildren(
      h('div', { class: 'cm-sess-head' }, `✓ ${n('ready')} ready · ● ${n('working')} working · ○ ${n('idle')} idle`),
      ...list.map(s =>
        h(
          'button',
          {
            type: 'button',
            class: 'cm-sess-row cm-' + s.status,
            title: s.url,
            onclick: () => {
              if (s.tabId !== SESS.tabId) {
                try {
                  chrome.runtime.sendMessage({ type: 'focus', tabId: s.tabId })
                } catch {}
              }
            },
          },
          h('span', {}, ICON[s.status] || '○'),
          h('span', { class: 'cm-text' }, (s.title || 'New chat') + (s.tabId === SESS.tabId ? ' (this tab)' : '')),
          h('span', { class: 'cm-dim' }, LABEL[s.status] || s.status),
        ),
      ),
      h(
        'button',
        {
          type: 'button',
          class: 'cm-sess-hide',
          onclick: () => {
            SESS.pillHidden = true
            store.set({ cm_pillHidden: true })
            renderSessions()
          },
        },
        'Hide this (Alt+Shift+S brings it back)',
      ),
    )
  }
  const togglePanel = () => {
    SESS.panelOpen = !SESS.panelOpen
    renderSessions()
  }

  const pageTitle = () => document.title.replace(/\s*[-–|]\s*Claude\s*$/, '').trim() || 'New chat'
  const report = () => {
    try {
      chrome.runtime.sendMessage({ type: 'report', title: pageTitle(), url: location.pathname, status: SESS.status }, resp => {
        void chrome.runtime.lastError
      })
    } catch {}
  }

  // ---------- main loop ----------
  let wasStreaming = false
  const tick = () => {
    const streaming = isStreaming()
    const now = Date.now()
    const node = lastAssistant()
    const text = node ? node.innerText || '' : ''

    if (streaming && !wasStreaming) {
      SB.active = true
      SB.finished = false
      SB.stage = 1
      SB.startedAt = now
      SB.tells = []
      SESS.status = 'working'
      report()
    }
    if (streaming) {
      SB.now = now
      SB.chars = text.length
      SB.stage = text.length > 0 ? 2 : 1
    }
    if (!streaming && wasStreaming) {
      SB.active = false
      SB.finished = true
      SB.now = now
      SB.chars = text.length
      SB.stage = 3
      SB.tells = scan(text)
      SB.hideAt = now + 8000
      SESS.status = document.hidden ? 'ready' : 'idle'
      report()
    }
    wasStreaming = streaming

    if (S.job) {
      if (streaming) S.job.sawStream = true
      if (!streaming && S.job.sawStream && !S.job.ready) {
        S.job.ready = true
        S.note = 'Reply ready. Use it, or Undo to restore your draft.'
        renderTools()
      } else if (!streaming && !S.job.sawStream && now - S.job.startedAt > 15000) {
        S.job = null
        S.note = 'Could not send the request. Undo restores your draft.'
        renderTools()
      }
    }

    renderStatus()
  }

  const ensureMounted = () => {
    const comp = composerEl()
    if (!comp) {
      if (root.isConnected) root.remove()
      return
    }
    const host = comp.closest('fieldset') || comp.closest('form') || (comp.parentElement && comp.parentElement.parentElement)
    if (!host || !host.parentElement) return
    if (root.parentElement !== host.parentElement || root.nextSibling !== host) {
      host.parentElement.insertBefore(root, host)
    }
  }

  // ---------- boot ----------
  const boot = async () => {
    const v = await store.get(['cm_ideas', 'cm_ctx', 'cm_ideasOpen', 'cm_pillHidden', 'cm_sessions'])
    S.ideas = Array.isArray(v.cm_ideas) ? v.cm_ideas : []
    S.ctx = typeof v.cm_ctx === 'string' ? v.cm_ctx : ''
    S.ideasOpen = !!v.cm_ideasOpen
    SESS.pillHidden = !!v.cm_pillHidden
    SESS.all = v.cm_sessions || {}
    ctxArea.value = S.ctx

    document.body.append(sessWrap)
    renderTools()
    renderIdeas()
    renderCtx()
    renderSessions()
    ensureMounted()

    try {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return
        if (changes.cm_sessions) {
          SESS.all = changes.cm_sessions.newValue || {}
          renderSessions()
        }
        if (changes.cm_ideas && JSON.stringify(changes.cm_ideas.newValue) !== JSON.stringify(S.ideas)) {
          S.ideas = changes.cm_ideas.newValue || []
          renderIdeas()
          renderTools()
        }
      })
    } catch {}

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && SESS.status === 'ready') {
        SESS.status = 'idle'
        report()
      }
    })
    document.addEventListener('keydown', e => {
      if (e.altKey && e.shiftKey && (e.key === 'S' || e.key === 's')) {
        SESS.pillHidden = !SESS.pillHidden
        store.set({ cm_pillHidden: SESS.pillHidden })
        renderSessions()
      }
    })

    // Only the background worker knows this tab's id; ask once so the pane can mark "this tab".
    try {
      chrome.runtime.sendMessage({ type: 'whoami' }, resp => {
        void chrome.runtime.lastError
        if (resp && typeof resp.tabId === 'number') {
          SESS.tabId = resp.tabId
          renderSessions()
        }
      })
    } catch {}

    setInterval(tick, 400)
    setInterval(ensureMounted, 1000)
    setInterval(report, 4000)
    setInterval(renderSessions, 5000)
    report()
  }

  boot()
})()

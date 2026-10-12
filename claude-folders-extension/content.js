(() => {
  'use strict';
  if (window.__claudeFolders) return;
  window.__claudeFolders = true;

  const KEY = 'cf_state_v1';
  const COLORS = ['#5BB5A2', '#E0A458', '#A58BE0', '#E5817A', '#6FA8E8', '#9AA37A'];
  const SELF = '#cf-root,#cf-home,.cf-menu,#cf-float';

  // folders: [{id,name,color}], chats: {chatId: {title, folderId|null}},
  // recents: chat ids in the order the native Recents list shows them.
  let S = { folders: [], chats: {}, recents: [], pinF: [], pinC: [], open: [], classic: false };
  let homeOpen = false;
  let homeFolder = null;
  let homeQuery = '';
  let editing = null; // {type:'new'} | {type:'rename', id}
  let lastPath = location.pathname;

  /* ---------- tiny DOM helpers ---------- */
  function h(tag, props, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'style') e.style.cssText = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) {
      if (c == null || c === false) continue;
      e.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
    return e;
  }
  const ICON = {
    chev: '<path d="M3 1.5L7 5L3 8.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
    plus: '<path d="M6 1.5v9M1.5 6h9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    x: '<path d="M2.5 2.5l7 7M9.5 2.5l-7 7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
    edit: '<path d="M2 10l.6-2.6L8.4 1.6l2 2L4.6 9.4z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>',
    pin: '<path d="M4 1h4l-.6 3.2L9.5 6.5v1H6.6V11H5.4V7.5H2.5v-1l2.1-2.3z" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/>',
    pinOn: '<path d="M4 1h4l-.6 3.2L9.5 6.5v1H6.6V11H5.4V7.5H2.5v-1l2.1-2.3z" fill="#E0A458" stroke="#E0A458" stroke-width="1" stroke-linejoin="round"/>',
    folder: '<path d="M1.5 3.2c0-.5.4-.9.9-.9h2.2l1 1.1h4c.5 0 .9.4.9.9v4.6c0 .5-.4.9-.9.9H2.4c-.5 0-.9-.4-.9-.9z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>',
    check: '<path d="M2 6.3l2.4 2.4L10 3.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  };
  function icon(name, size = 12, cls = '') {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 12 12');
    s.setAttribute('width', size);
    s.setAttribute('height', size);
    s.setAttribute('aria-hidden', 'true');
    if (cls) s.setAttribute('class', cls);
    s.innerHTML = ICON[name]; // static strings only
    return s;
  }
  const iconBtn = (name, label, onClick) =>
    h('button', { class: 'cf-icon', type: 'button', title: label, 'aria-label': label, onClick: (e) => { e.preventDefault(); e.stopPropagation(); onClick(e); } }, icon(name));

  /* ---------- state ---------- */
  let saveT;
  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      try { chrome.storage.local.set({ [KEY]: S }); } catch (_) { /* extension reloaded */ }
    }, 150);
  }
  const uid = () => 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const folder = (id) => S.folders.find((f) => f.id === id);
  const rank = (id) => { const i = S.recents.indexOf(id); return i < 0 ? 1e9 : i; };
  const chatsIn = (fid) =>
    Object.keys(S.chats).filter((id) => S.chats[id].folderId === fid).sort((a, b) => rank(a) - rank(b));
  const toggle = (arr, id) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
  const currentChatId = () => (location.pathname.match(/^\/chat\/([^/?#]+)/) || [])[1] || null;

  function addFolder(name) {
    const n = name.trim();
    if (!n) return null;
    const f = { id: uid(), name: n, color: COLORS[S.folders.length % COLORS.length] };
    S.folders.push(f);
    S.open.push(f.id);
    save();
    return f;
  }
  function deleteFolder(id) {
    S.folders = S.folders.filter((f) => f.id !== id);
    for (const c of Object.values(S.chats)) if (c.folderId === id) c.folderId = null;
    S.pinF = S.pinF.filter((x) => x !== id);
    S.open = S.open.filter((x) => x !== id);
    if (homeFolder === id) homeFolder = null;
    save();
  }
  function fileChat(chatId, fid) {
    if (!S.chats[chatId]) S.chats[chatId] = { title: 'Chat', folderId: null };
    S.chats[chatId].folderId = fid;
    save();
    refresh();
  }
  function setClassic(on) {
    S.classic = on;
    homeOpen = false;
    save();
    refresh();
  }

  /* ---------- navigation ---------- */
  function go(id) {
    closeHome();
    const a = [...document.querySelectorAll('a[href="/chat/' + id + '"]')].find((x) => !x.closest(SELF));
    if (a) a.click();
    else location.assign('/chat/' + id);
  }
  function newChat() {
    closeHome();
    const a = [...document.querySelectorAll('a[href="/new"]')].find((x) => !x.closest(SELF));
    if (a) a.click();
    else location.assign('/new');
  }
  const plainClick = (e) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

  /* ---------- popover menu ---------- */
  let menuEl = null;
  function closeMenu() { if (menuEl) { menuEl.remove(); menuEl = null; } }
  function openMenu(anchor, chatId) {
    closeMenu();
    const cur = S.chats[chatId] || { folderId: null };
    const items = [];
    for (const f of S.folders) {
      items.push(
        h('button', { class: 'cf-row', type: 'button', onClick: () => { fileChat(chatId, f.id); closeMenu(); } },
          h('span', { class: 'cf-dot', style: 'background:' + f.color }),
          h('span', { class: 'cf-name' }, f.name),
          cur.folderId === f.id ? icon('check') : null));
    }
    if (cur.folderId) {
      items.push(h('button', { class: 'cf-row', type: 'button', onClick: () => { fileChat(chatId, null); closeMenu(); } },
        h('span', { class: 'cf-name' }, 'Remove from folder')));
    }
    items.push(h('button', { class: 'cf-row', type: 'button', onClick: () => { S.pinC = toggle(S.pinC, chatId); save(); refresh(); closeMenu(); } },
      icon(S.pinC.includes(chatId) ? 'pinOn' : 'pin'),
      h('span', { class: 'cf-name' }, S.pinC.includes(chatId) ? 'Unpin chat' : 'Pin chat')));
    const input = h('input', { type: 'text', placeholder: 'New folder…', 'aria-label': 'New folder name' });
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { const f = addFolder(input.value); if (f) fileChat(chatId, f.id); closeMenu(); }
      if (e.key === 'Escape') closeMenu();
    });
    items.push(h('div', { class: 'cf-sep' }), h('div', { style: 'padding:2px' }, input));
    menuEl = h('div', { class: 'cf-menu', role: 'menu' }, ...items);
    document.body.append(menuEl);
    const r = anchor.getBoundingClientRect();
    const mw = menuEl.offsetWidth, mh = menuEl.offsetHeight;
    menuEl.style.left = Math.max(8, Math.min(r.right + 6, innerWidth - mw - 8)) + 'px';
    menuEl.style.top = Math.max(8, Math.min(r.top, innerHeight - mh - 8)) + 'px';
    setTimeout(() => input.focus({ preventScroll: true }), 0);
  }
  document.addEventListener('mousedown', (e) => { if (menuEl && !menuEl.contains(e.target)) closeMenu(); }, true);

  /* ---------- sidebar section ---------- */
  function chatLink(id, extra) {
    const c = S.chats[id];
    const a = h('a', { class: 'cf-row ' + (extra || ''), href: '/chat/' + id, title: c.title },
      h('span', { class: 'cf-name' }, c.title),
      h('span', { class: 'cf-acts' },
        iconBtn('pin', S.pinC.includes(id) ? 'Unpin chat' : 'Pin chat', () => { S.pinC = toggle(S.pinC, id); save(); refresh(); }),
        c.folderId ? iconBtn('x', 'Remove from folder', () => fileChat(id, null)) : null));
    a.addEventListener('click', (e) => { if (plainClick(e)) { e.preventDefault(); go(id); } });
    return a;
  }

  function nameInput(initial, onDone, onCancel) {
    const input = h('input', { type: 'text', value: initial || '', placeholder: 'Folder name', 'aria-label': 'Folder name' });
    let done = false;
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { done = true; onDone(input.value); }
      if (e.key === 'Escape') { done = true; onCancel(); }
    });
    input.addEventListener('blur', () => { if (!done) onCancel(); });
    setTimeout(() => { input.focus({ preventScroll: true }); input.select(); }, 0);
    return h('div', { style: 'padding:3px 6px' }, input);
  }

  function folderRow(f) {
    const isOpen = S.open.includes(f.id);
    if (editing && editing.type === 'rename' && editing.id === f.id) {
      return nameInput(f.name,
        (v) => { if (v.trim()) { f.name = v.trim(); save(); } editing = null; refresh(); },
        () => { editing = null; refresh(); });
    }
    const n = chatsIn(f.id).length;
    const row = h('div', { class: 'cf-row', role: 'button', tabindex: '0', 'aria-expanded': String(isOpen),
        onClick: () => { S.open = toggle(S.open, f.id); save(); refresh(); },
        onKeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); S.open = toggle(S.open, f.id); save(); refresh(); } } },
      icon('chev', 10, 'cf-chev' + (isOpen ? ' cf-open' : '')),
      h('span', { class: 'cf-dot', style: 'background:' + f.color }),
      h('span', { class: 'cf-name' }, f.name),
      h('span', { class: 'cf-count' }, String(n)),
      h('span', { class: 'cf-acts' },
        iconBtn(S.pinF.includes(f.id) ? 'pinOn' : 'pin', S.pinF.includes(f.id) ? 'Unpin folder' : 'Pin folder', () => { S.pinF = toggle(S.pinF, f.id); save(); refresh(); }),
        iconBtn('edit', 'Rename folder', () => { editing = { type: 'rename', id: f.id }; refresh(); }),
        iconBtn('x', 'Delete folder (chats are kept)', () => { if (confirm('Delete folder "' + f.name + '"? Its chats stay in your Recents.')) { deleteFolder(f.id); refresh(); } })));
    const wrap = h('div', null, row);
    if (isOpen) {
      const kids = chatsIn(f.id);
      if (!kids.length) wrap.append(h('div', { class: 'cf-empty cf-child' }, 'Empty. Use the folder icon on a chat to add it.'));
      for (const id of kids) wrap.append(chatLink(id, 'cf-child'));
    }
    return wrap;
  }

  function renderRoot() {
    const root = ensureRoot();
    if (!root) return;
    root.replaceChildren();

    if (S.classic) {
      root.append(h('div', { class: 'cf-head' },
        h('span', { class: 'cf-title' }, 'CLASSIC VIEW'),
        h('button', { class: 'cf-pill', type: 'button', onClick: () => setClassic(false) }, 'Use Folders')));
      return;
    }

    root.append(h('div', { class: 'cf-head' },
      h('span', { class: 'cf-title' }, 'FOLDERS'),
      iconBtn('plus', 'New folder', () => { editing = { type: 'new' }; refresh(); }),
      h('button', { class: 'cf-pill', type: 'button', onClick: () => openHome() }, 'Home'),
      h('button', { class: 'cf-pill', type: 'button', title: 'Back to the classic sidebar', onClick: () => setClassic(true) }, 'Classic')));

    if (editing && editing.type === 'new') {
      root.append(nameInput('',
        (v) => { addFolder(v); editing = null; refresh(); },
        () => { editing = null; refresh(); }));
    }

    const cid = currentChatId();
    if (cid && S.chats[cid]) {
      const f = folder(S.chats[cid].folderId);
      root.append(h('button', { class: 'cf-row cf-current', type: 'button', title: 'File this chat in a folder',
          onClick: (e) => openMenu(e.currentTarget, cid) },
        icon('folder'),
        h('span', { class: 'cf-name' }, f ? 'This chat: ' + f.name : 'File this chat…')));
    }

    const pf = S.pinF.map(folder).filter(Boolean);
    const pc = S.pinC.filter((id) => S.chats[id]);
    if (pf.length + pc.length) {
      root.append(h('div', { class: 'cf-label' }, 'PINNED'));
      for (const f of pf) root.append(folderRow(f));
      for (const id of pc) root.append(chatLink(id));
      root.append(h('div', { class: 'cf-sep' }));
    }

    if (!S.folders.length && !(editing && editing.type === 'new')) {
      root.append(h('div', { class: 'cf-empty' }, 'No folders yet. Press + to make one.'));
    }
    for (const f of S.folders) root.append(folderRow(f));
  }

  function ensureRoot() {
    let root = document.getElementById('cf-root');
    const nav = document.querySelector('.dframe-nav-scroll');
    const anchor = nav && (nav.querySelector('a[href="/artifacts"]') || nav.querySelector('a[href="/customize"]'));
    if (!nav || !anchor) {
      if (root) root.remove();
      if (!document.getElementById('cf-float')) {
        document.body.append(h('button', { id: 'cf-float', type: 'button', onClick: () => openHome() }, 'Folders'));
      }
      return null;
    }
    const fl = document.getElementById('cf-float');
    if (fl) fl.remove();
    let blk = anchor;
    while (blk.parentElement && blk.parentElement !== nav) blk = blk.parentElement;
    if (!root) root = h('div', { id: 'cf-root' });
    if (root.previousElementSibling !== blk) blk.after(root);
    return root;
  }

  /* ---------- native Recents list: capture, decorate, hide filed ---------- */
  function scan() {
    const side = document.querySelector('aside[aria-label="Sidebar"]') || document;
    const links = [...side.querySelectorAll('a[href^="/chat/"]')].filter((a) => !a.closest(SELF));
    const ids = [];
    let changed = false;
    for (const a of links) {
      const id = (a.getAttribute('href').split('/')[2] || '').split(/[?#]/)[0];
      if (!id) continue;
      ids.push(id);
      const title = (a.textContent || '').trim();
      let c = S.chats[id];
      if (!c) { c = S.chats[id] = { title: title || 'Chat', folderId: null }; changed = true; }
      else if (title && c.title !== title) { c.title = title; changed = true; }
      const row = a.closest('div.group') || a.parentElement;
      row.toggleAttribute('data-cf-hidden', !S.classic && !!c.folderId);
      if (row && !row.querySelector(':scope > .cf-file')) {
        const b = h('button', { class: 'cf-file', type: 'button', title: 'Move to folder', 'aria-label': 'Move to folder',
          onClick: (e) => { e.preventDefault(); e.stopPropagation(); openMenu(b, id); } }, icon('folder', 13));
        row.append(b);
      }
    }
    if (ids.length && JSON.stringify(ids) !== JSON.stringify(S.recents)) { S.recents = ids; changed = true; }
    if (changed) { save(); renderRoot(); if (homeOpen) renderHome(); }
  }

  /* ---------- home screen ---------- */
  function openHome(fid) { homeOpen = true; homeFolder = fid || null; homeQuery = ''; renderHome(); }
  function closeHome() { homeOpen = false; const e = document.getElementById('cf-home'); if (e) e.remove(); }

  function card(f) {
    const ids = chatsIn(f.id);
    return h('button', { class: 'cf-card', type: 'button', onClick: () => { homeFolder = f.id; renderHome(); } },
      h('div', { class: 'cf-bandc', style: 'background:' + f.color }),
      h('div', { class: 'cf-body' },
        h('div', { class: 'cf-top' },
          h('span', { class: 'cf-name' }, f.name),
          S.pinF.includes(f.id) ? icon('pinOn') : null,
          h('span', { class: 'cf-count', style: 'font-size:11px;opacity:.6' }, String(ids.length))),
        ...ids.slice(0, 2).map((id) => h('div', { class: 'cf-peek' }, S.chats[id].title)),
        ids.length ? null : h('div', { class: 'cf-peek' }, 'Empty')));
  }
  function homeChat(id) {
    const c = S.chats[id];
    const f = folder(c.folderId);
    const a = h('a', { class: 'cf-row', href: '/chat/' + id },
      h('span', { class: 'cf-name' }, c.title),
      h('span', { class: 'cf-chip' }, f ? f.name : 'Unfiled'),
      h('button', { class: 'cf-icon', type: 'button', title: 'Move to folder', 'aria-label': 'Move to folder',
        onClick: (e) => { e.preventDefault(); e.stopPropagation(); openMenu(e.currentTarget, id); } }, icon('folder')));
    a.addEventListener('click', (e) => { if (plainClick(e)) { e.preventDefault(); go(id); } });
    return a;
  }

  function renderHome() {
    let el = document.getElementById('cf-home');
    if (!homeOpen || S.classic) { if (el) el.remove(); return; }
    if (!el) { el = h('div', { id: 'cf-home', role: 'region', 'aria-label': 'Folders home' }); document.body.append(el); }
    const side = document.querySelector('aside[aria-label="Sidebar"]');
    el.style.left = (side ? Math.round(side.getBoundingClientRect().right) : 0) + 'px';
    el.style.background = getComputedStyle(document.body).backgroundColor;
    const q = homeQuery.trim().toLowerCase();
    const match = (t) => !q || t.toLowerCase().includes(q);
    const keepFocus = document.activeElement && document.activeElement.classList.contains('cf-search');
    el.replaceChildren();

    const search = h('input', { class: 'cf-search', type: 'search', placeholder: 'Search folders and chats', value: homeQuery, 'aria-label': 'Search folders and chats' });
    search.addEventListener('input', () => { homeQuery = search.value; renderHome(); });
    search.addEventListener('keydown', (e) => e.stopPropagation());
    const f0 = homeFolder && folder(homeFolder);

    el.append(h('div', { class: 'cf-bar' },
      f0 ? h('button', { class: 'cf-pill', type: 'button', onClick: () => { homeFolder = null; renderHome(); } }, '‹ All folders') : null,
      h('h1', null, f0 ? f0.name : 'Folders home'),
      search,
      h('button', { class: 'cf-solid', type: 'button', onClick: newChat }, 'New chat'),
      h('button', { class: 'cf-pill', type: 'button', onClick: closeHome }, 'Close')));

    if (f0) {
      const ids = chatsIn(f0.id).filter((id) => match(S.chats[id].title));
      el.append(h('div', { class: 'cf-list' }, ids.length ? ids.map(homeChat) : h('div', { class: 'cf-empty' }, 'No chats here yet.')));
    } else {
      const pf = S.pinF.map(folder).filter(Boolean).filter((f) => match(f.name));
      const pc = S.pinC.filter((id) => S.chats[id] && match(S.chats[id].title));
      if (pf.length + pc.length) {
        el.append(h('h2', null, 'PINNED'), h('div', { class: 'cf-grid' }, pf.map(card)));
        if (pc.length) el.append(h('div', { class: 'cf-list', style: 'margin-bottom:26px' }, pc.map(homeChat)));
      }
      const fs = S.folders.filter((f) => match(f.name) || chatsIn(f.id).some((id) => match(S.chats[id].title)));
      el.append(h('h2', null, 'ALL FOLDERS'),
        fs.length ? h('div', { class: 'cf-grid' }, fs.map(card)) : h('div', { class: 'cf-empty', style: 'margin-bottom:26px' }, 'No folders match.'));
      const rec = S.recents.filter((id) => S.chats[id] && match(S.chats[id].title)).slice(0, 12);
      el.append(h('h2', null, 'RECENT CHATS'), h('div', { class: 'cf-list' }, rec.map(homeChat)));
    }
    if (keepFocus) { const s = el.querySelector('.cf-search'); if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); } }
  }

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (menuEl) closeMenu();
    else if (homeOpen) closeHome();
  });

  /* ---------- wiring ---------- */
  function refresh() {
    document.documentElement.classList.toggle('cf-classic', !!S.classic);
    renderRoot();
    scan();
    if (homeOpen) renderHome();
  }

  let raf = 0;
  function schedule() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (location.pathname !== lastPath) { lastPath = location.pathname; if (homeOpen) closeHome(); renderRoot(); }
      else if (!document.getElementById('cf-root') || !document.querySelector('.dframe-nav-scroll')) renderRoot();
      scan();
    });
  }
  new MutationObserver((muts) => {
    for (const m of muts) {
      const t = m.target.nodeType === 1 ? m.target : m.target.parentElement;
      if (t && !t.closest(SELF)) { schedule(); return; }
    }
  }).observe(document.body, { childList: true, subtree: true });
  addEventListener('resize', () => { if (homeOpen) renderHome(); });

  try {
    chrome.storage.local.get(KEY, (r) => {
      if (r && r[KEY]) S = Object.assign(S, r[KEY]);
      refresh();
    });
    chrome.storage.onChanged.addListener((ch, area) => {
      if (area !== 'local' || !ch[KEY] || !ch[KEY].newValue) return;
      if (JSON.stringify(ch[KEY].newValue) === JSON.stringify(S)) return;
      S = Object.assign(S, ch[KEY].newValue);
      refresh();
    });
  } catch (_) {
    refresh();
  }
})();

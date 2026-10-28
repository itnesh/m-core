import { CONFIG } from './config.js?v=14';

/* ================= Konstanten ================= */
const STATUSES = ['Ideas', 'Queued', 'In Motion', 'Frozen', 'Delivered', 'Dropped'];
const SI = p => `<svg class="sico" viewBox="0 0 24 24">${p}</svg>`;
const ST_ICON = {
  'Ideas': SI('<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>'),
  'Queued': SI('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  'In Motion': SI('<path d="M7 5l11 7-11 7z" fill="currentColor"/>'),
  'Frozen': SI('<path d="M12 2v20M4 7l16 10M20 7L4 17M9 4l3 2 3-2M9 20l3-2 3 2"/>'),
  'Delivered': SI('<path d="M4 12l5 5L20 6"/>'),
  'Dropped': SI('<path d="M6 6l12 12M18 6 6 18"/>'),
};
const STATUS_COLOR = { 'Ideas': '#9c7fd6', 'Queued': '#7b52c9', 'In Motion': '#FF6600', 'Delivered': '#5fa832', 'Frozen': '#e0605a', 'Dropped': '#c0392b' };
const STATUS_TINT = { 'Ideas': 7, 'Queued': 7, 'In Motion': 0, 'Delivered': 8, 'Frozen': 7, 'Dropped': 8 };
const STATUS_ORDER = { 'In Motion': 1, 'Queued': 2, 'Frozen': 3, 'Ideas': 4, 'Delivered': 5, 'Dropped': 6 };
const DEFAULT_FILTER = ['Queued', 'In Motion', 'Frozen'];
const PRIO = { 1: { n: 'High', c: '#B76E79' }, 2: { n: 'Medium', c: '#C7A76C' }, 3: { n: 'Low', c: '#7E9CB2' } };
const LINK_TYPES = ['Jira', 'Octane', 'Onenote', 'Sharepoint', 'SNOW', 'Teams', 'Wiki', 'Others'];
const LINK_DETECT = [
  [/atlassian|jira/i, 'Jira'], [/octane|almoctane|microfocus/i, 'Octane'], [/onenote|1drv\.ms\/o|onenote:/i, 'Onenote'],
  [/teams\.microsoft|teams\.live/i, 'Teams'], [/service-?now|snow/i, 'SNOW'], [/confluence|wiki/i, 'Wiki'],
  [/sharepoint|onedrive|-my\.sharepoint/i, 'Sharepoint'],
];
const ICON = t => `img/${(t || 'others').toLowerCase()}.png`;

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ALLOWED = new Set(['IMG','B','STRONG','I','EM','U','S','P','BR','DIV','SPAN','UL','OL','LI','A','CODE','PRE','BLOCKQUOTE','H1','H2','H3','H4','FONT']);
function clean(html) {
  const tpl = document.createElement('template'); tpl.innerHTML = html || '';
  const walk = node => [...node.childNodes].forEach(n => {
    if (n.nodeType === 8) return n.remove();
    if (n.nodeType !== 1) return;
    if (!ALLOWED.has(n.tagName)) { if (/^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED)$/.test(n.tagName)) return n.remove(); walk(n); n.replaceWith(...n.childNodes); return; }
    if (n.tagName === 'IMG') { const id = n.getAttribute('data-att'); if (!id || !/^[\w-]+$/.test(id)) return n.remove(); [...n.attributes].forEach(a => n.removeAttribute(a.name)); n.setAttribute('data-att', id); n.className = 'att'; n.alt = 'Screenshot'; return; }
    const keepC = /^(SPAN|FONT|P|DIV|LI|B|STRONG|I|EM|U)$/.test(n.tagName) ? [n.style.color, n.style.backgroundColor] : ['', ''];
    [...n.attributes].forEach(a => { if (!(n.tagName === 'A' && a.name === 'href') && a.name !== 'color') n.removeAttribute(a.name); });
    if (/^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\))$/i.test(keepC[0] || '')) n.style.color = keepC[0];
    if (/^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\))$/i.test(keepC[1] || '') && !/rgba\(0, 0, 0, 0\)/.test(keepC[1])) n.style.backgroundColor = keepC[1];
    if (n.tagName === 'A') { if (!/^(https?:|mailto:|onenote:)/i.test(n.getAttribute('href') || '')) n.removeAttribute('href'); n.target = '_blank'; n.rel = 'noopener'; }
    walk(n);
  });
  walk(tpl.content); return tpl.innerHTML;
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const svg = {
  edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  del: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  chat: '<svg viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>',
};

/* ================= Datenschicht ================= */
const FB = '10.14.1';

async function firebaseStore() {
  const [{ initializeApp }, A, F] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${FB}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${FB}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${FB}/firebase-firestore.js`),
  ]);
  const app = initializeApp(CONFIG.firebase);
  const auth = A.getAuth(app);
  let db;
  try {
    db = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) });
  } catch { db = F.getFirestore(app); }

  const user = await new Promise(res => {
    A.onAuthStateChanged(auth, u => {
      if (u) return res(u);
      $('#login').classList.remove('hidden');
      $('#btnLogin').onclick = () => A.signInWithPopup(auth, new A.GoogleAuthProvider())
        .catch(e => $('#loginErr').textContent = e.message);
    });
  });
  if (CONFIG.allowedEmail && user.email.toLowerCase() !== CONFIG.allowedEmail.toLowerCase()) {
    await A.signOut(auth);
    $('#login').classList.remove('hidden');
    $('#loginErr').textContent = `Kein Zugriff für ${user.email}`;
    throw new Error('not allowed');
  }
  $('#login').classList.add('hidden');
  const col = n => F.collection(db, 'users', user.uid, n);
  const fail = e => toast('Fehler beim Speichern: ' + e.message);
  return {
    mode: 'Firebase · ' + user.email,
    user: { name: user.displayName, email: user.email, photo: user.photoURL },
    signOut: () => A.signOut(auth).then(() => location.reload()),
    sub: (n, cb) => F.onSnapshot(col(n), s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))), e => toast(e.message)),
    add(n, data) { const ref = F.doc(col(n)); F.setDoc(ref, { ...data, createdAt: Date.now(), updatedAt: Date.now() }).catch(fail); return ref.id; },
    update: (n, id, p) => F.updateDoc(F.doc(col(n), id), { ...p, updatedAt: Date.now() }).catch(fail),
    remove: (n, id) => F.deleteDoc(F.doc(col(n), id)).catch(fail),
    put: (n, id, data) => F.setDoc(F.doc(col(n), id), data).catch(fail),
    get: (n, id) => F.getDoc(F.doc(col(n), id)).then(s => s.exists() ? { id: s.id, ...s.data() } : null),
  };
}

function localStore() {
  const subs = {};
  const read = n => { try { return JSON.parse(localStorage.getItem('mcore:' + n) || '[]'); } catch { return []; } };
  const write = (n, arr) => { try { localStorage.setItem('mcore:' + n, JSON.stringify(arr)); } catch {} (subs[n] || []).forEach(cb => cb(structuredClone(arr))); };
  return {
    mode: 'LOCAL-Modus (nur dieser Browser)',
    user: { name: 'Lokal', email: 'config.js ausfüllen für Firebase' },
    signOut: null,
    sub(n, cb) { (subs[n] ||= []).push(cb); cb(read(n)); },
    add(n, data) { const id = uid(); write(n, [...read(n), { id, ...data, createdAt: Date.now(), updatedAt: Date.now() }]); return id; },
    update(n, id, p) { write(n, read(n).map(x => x.id === id ? { ...x, ...p, updatedAt: Date.now() } : x)); },
    remove(n, id) { write(n, read(n).filter(x => x.id !== id)); },
    put(n, id, data) { write(n, [...read(n).filter(x => x.id !== id), { id, ...data }]); },
    get: async (n, id) => read(n).find(x => x.id === id) || null,
  };
}

/* ================= State ================= */
let store;
const S = {
  tasks: [], todos: [],
  filter: new Set(loadPref('filter', DEFAULT_FILTER)),
  q: '',
  openId: null,
  editMsgId: null,
  editLinkId: null,
  linkFilter: null,
  sFilter: new Set(STATUSES),
  editTodoId: null,
  recs: [],
};
function loadPref(k, d) { try { const v = JSON.parse(localStorage.getItem('mcore:pref:' + k)); return v ?? d; } catch { return d; } }
function savePref(k, v) { try { localStorage.setItem('mcore:pref:' + k, JSON.stringify(v)); } catch {} }
const task = id => S.tasks.find(t => t.id === id);
const upd = (id, p) => store.update('tasks', id, p);

/* ================= Helpers ================= */
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add('hidden'), 2600);
}
function fmtDate(iso) { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}.${m}.${y.slice(2)}`; }
function fmtTs(ts) {
  const d = new Date(ts); const p = n => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${String(d.getFullYear()).slice(2)} - ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function dlClass(iso) {
  if (!iso) return '';
  const days = (new Date(iso + 'T23:59:59') - new Date()) / 864e5;
  return days < 0 ? 'over' : days <= 3 ? 'soon' : '';
}
function detectType(url) { for (const [re, t] of LINK_DETECT) if (re.test(url)) return t; return 'Others'; }
function normUrl(u) { u = u.trim(); if (!u) return ''; if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u; return u; }
function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } }
function linkify(text) { return esc(text).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>'); }
function stripHtml(h) { const d = document.createElement('div'); d.innerHTML = h || ''; return d.textContent || ''; }
function waitsOf(t) {
  if (t.waits) return t.waits;
  if ((t.waitFor || []).length || t.waitReason) return (t.waitFor?.length ? t.waitFor : ['']).map((p, i) => ({ id: 'w' + i, personId: p, reason: i ? '' : (t.waitReason || ''), since: t.waitSince || 0 }));
  return [];
}
function waitText(t) {
  const ps = t.persons || [];
  return waitsOf(t).map(w => { const n = ps.find(p => p.id === w.personId)?.name; return [n, w.reason].filter(Boolean).join(': '); }).filter(Boolean).join(' · ') || 'wartet';
}
const ORDER_T = ['Teams', 'Jira', 'Octane', 'SNOW', 'Sharepoint', 'Onenote', 'Wiki', 'Others'];
function linkGroups(urls) {
  const m = new Map(); urls.forEach(u => { const k = u.type || 'Others'; (m.get(k) || m.set(k, []).get(k)).push(u); });
  return [...m.entries()].sort((a, b) => ORDER_T.indexOf(a[0]) - ORDER_T.indexOf(b[0]));
}
const isTeams = u => /^https:\/\/teams\.microsoft\.com\//i.test(u || '');
const linkHref = u => isTeams(u) ? u.replace(/^https:\/\/teams\.microsoft\.com\//i, 'msteams:/') : u;
const linkTarget = u => isTeams(u) ? '' : 'target="_blank" rel="noopener"';
function personHits(t) {
  const q = S.q.toLowerCase(); if (!q) return '';
  const ps = (t.persons || []).filter(p => (p.name || '').toLowerCase().includes(q) || (p.role || '').toLowerCase().includes(q));
  if (!ps.length) return '';
  return `<div class="desc personhit">${ps.map(p => {
    const ws = waitsOf(t).filter(w => w.personId === p.id && w.reason);
    return `👤 <b>${esc(p.name)}</b>${p.role ? ' (' + esc(p.role) + ')' : ''}${ws.length && t.status === 'Frozen' ? ' · ⏸ wartet: ' + esc(ws.map(w => w.reason).join(', ')) : ''}`;
  }).join(' &nbsp; ')}</div>`;
}
function initials(n) { return (n || '?').split(/\s+/).map(s => s[0]).slice(0, 2).join('').toUpperCase(); }

/* ================= Sidebar ================= */
const activeFilter = () => S.q ? S.sFilter : S.filter;
function renderSidebar() {
  const F = activeFilter();
  const counts = Object.fromEntries(STATUSES.map(s => [s, 0]));
  S.tasks.forEach(t => counts[t.status] = (counts[t.status] || 0) + 1);
  $('#statusNav').innerHTML = STATUSES.map(s => `
    <button class="st-btn ${F.has(s) ? 'on' : ''}" data-s="${s}" style="--c:${STATUS_COLOR[s]}">
      <span class="sic">${ST_ICON[s]}</span>${s}<span class="cnt">${counts[s]}</span>
    </button>`).join('');
}
$('#statusNav').addEventListener('click', e => {
  const b = e.target.closest('.st-btn'); if (!b) return;
  const s = b.dataset.s; const F = activeFilter();
  if (e.ctrlKey || e.metaKey) { F.clear(); F.add(s); }
  else F.has(s) ? F.delete(s) : F.add(s);
  if (!S.q) savePref('filter', [...S.filter]);
  renderSidebar(); renderList();
});
$('#btnAll').onclick = () => { if (S.q) S.sFilter = new Set(STATUSES); else { S.filter = new Set(STATUSES); savePref('filter', STATUSES); } renderSidebar(); renderList(); };
$('#btnActive').onclick = () => { if (S.q) S.sFilter = new Set(DEFAULT_FILTER); else { S.filter = new Set(DEFAULT_FILTER); savePref('filter', DEFAULT_FILTER); } renderSidebar(); renderList(); };

/* ================= Task-Liste ================= */
function visibleTasks() {
  const q = S.q.toLowerCase();
  return S.tasks
    .filter(t => { const F = activeFilter(); return !F.size || F.has(t.status); })
    .filter(t => !q || [t.title, t.description,
      ...(t.urls || []).flatMap(u => [u.title, u.url]),
      ...(t.chats || []).map(c => stripHtml(c.html)),
      ...(t.persons || []).flatMap(p => [p.name, p.role]),
      ...waitsOf(t).map(w => w.reason)].some(v => (v || '').toLowerCase().includes(q)))
    .sort((a, b) =>
      (!a.deadline - !b.deadline) ||
      (a.deadline || '').localeCompare(b.deadline || '') ||
      (STATUS_ORDER[a.status] || 99) - (STATUS_ORDER[b.status] || 99) ||
      (+a.prio || 9) - (+b.prio || 9) ||
      (a.title || '').localeCompare(b.title || ''));
}

function renderList() {
  const list = visibleTasks();
  $('#listCount').textContent = `${list.length} von ${S.tasks.length}`;
  if (!list.length) {
    $('#taskList').innerHTML = `<div class="empty">${S.tasks.length ? 'Keine Treffer für Filter/Suche.' : 'Noch keine Tasks. <b>N</b> drücken oder „+ Neu“.'}</div>`;
    return;
  }
  $('#taskList').innerHTML = list.map(t => {
    const p = PRIO[t.prio] || { c: '#ccc', n: '-' };
    const nChat = (t.chats || []).length;
    const urls = t.urls || [];
    return `
    <article class="task" data-id="${t.id}" style="--tc:${STATUS_COLOR[t.status] || '#fff'};--tp:${STATUS_TINT[t.status] ?? 0}%">
      <div class="bar" style="--pc:${p.c}" data-act="prio" title="Prio: ${p.n}"></div>
      <div class="main">
        <div class="ttl ${t.title ? '' : 'empty-ttl'}">${t.recurNew ? '<span class="recnew" title="Neu aus Recurring">!</span>' : ''}${t.recId ? '<span class="recicon" title="Recurring">↻</span>' : ''}${esc(t.title || 'Ohne Titel')}</div>
        ${personHits(t)}${t.status === 'Frozen' && waitsOf(t).length ? `<div class="desc waitline">⏸ ${esc(waitText(t))}</div>`
          : t.description ? `<div class="desc">${esc(t.description)}</div>` : ''}
      </div>
      <div class="qlinks">${linkGroups(urls).map(([ty, us]) => us.length === 1
        ? `<a class="qlink" href="${esc(linkHref(us[0].url))}" ${linkTarget(us[0].url)} title="${esc(us[0].title || us[0].url)}"><img src="${ICON(ty)}" alt=""></a>`
        : `<button class="qlink" data-act="links" data-ty="${esc(ty)}" title="${us.length} ${esc(ty)}-Links"><img src="${ICON(ty)}" alt=""><b class="qn">${us.length}</b></button>`).join('')}</div>
      <button class="status-pill" data-act="status" style="--c:${STATUS_COLOR[t.status]}"><span class="sic">${ST_ICON[t.status] || ''}</span>${esc(t.status)}</button>
      <div class="progress" data-act="prog"><i style="width:${+t.progress || 0}%"></i><span>${+t.progress || 0}%</span></div>
      <div class="deadline deadline-col ${dlClass(t.deadline)}">${fmtDate(t.deadline) || '<span style="opacity:.35">–</span>'}</div>
      <div class="chatcnt ${nChat ? 'has' : ''}" title="${nChat} Chat-Einträge">${svg.chat}${nChat || ''}</div>
    </article>`;
  }).join('');
}

$('#taskList').addEventListener('click', e => {
  if (e.target.closest('a')) return; // Quick-Link
  const row = e.target.closest('.task'); if (!row) return;
  const id = row.dataset.id; const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'status') return statusPop(e.target.closest('[data-act]'), id);
  if (act === 'prog') return progPop(e.target.closest('[data-act]'), id);
  if (act === 'prio') return prioPop(e.target.closest('[data-act]'), id);
  if (act === 'links') return linksPop(e.target.closest('[data-act]'), id);
  openTask(id);
});

/* ================= Popover ================= */
function showPop(anchor, html, cls = '') {
  const pop = $('#pop'); pop.className = 'pop ' + cls; pop.innerHTML = html;
  const r = anchor.getBoundingClientRect();
  pop.style.left = '0px'; pop.style.top = '0px';
  const pw = pop.offsetWidth, ph = pop.offsetHeight;
  pop.style.left = Math.min(r.left, innerWidth - pw - 10) + 'px';
  pop.style.top = (r.bottom + ph + 8 > innerHeight ? r.top - ph - 6 : r.bottom + 6) + 'px';
  return pop;
}
const hidePop = () => $('#pop').classList.add('hidden');
document.addEventListener('mousedown', e => { if (!e.target.closest('#pop') && !e.target.closest('[data-act]')) hidePop(); if (!e.target.closest('.user')) $('#userMenu').classList.add('hidden'); });

function statusPop(a, id) {
  const t = task(id);
  showPop(a, STATUSES.map(s => `<button data-v="${s}" class="${t.status === s ? 'cur' : ''}" style="--c:${STATUS_COLOR[s]}"><span class="sic">${ST_ICON[s]}</span>${s}</button>`).join(''))
    .onclick = e => { const b = e.target.closest('button'); if (b) { upd(id, { status: b.dataset.v }); hidePop(); } };
}
function progPop(a, id) {
  const t = task(id);
  showPop(a, Array.from({ length: 11 }, (_, i) => i * 10).map(v => `<button data-v="${v}" class="${+t.progress === v ? 'cur' : ''}">${v}</button>`).join(''), 'prog')
    .onclick = e => { const b = e.target.closest('button'); if (b) { upd(id, { progress: +b.dataset.v }); hidePop(); } };
}
function linksPop(a, id) {
  const ty = a.dataset.ty; const us = (task(id).urls || []).filter(u => (u.type || 'Others') === ty);
  showPop(a, us.map(u => `<a class="pl" href="${esc(linkHref(u.url))}" ${linkTarget(u.url)}><img src="${ICON(ty)}" alt=""><span>${esc(u.title || hostOf(u.url))}</span></a>`).join(''), 'links')
    .onclick = e => { if (e.target.closest('a')) setTimeout(hidePop, 50); };
}
function prioPop(a, id) {
  const t = task(id);
  showPop(a, [1, 2, 3].map(v => `<button data-v="${v}" class="${+t.prio === v ? 'cur' : ''}" style="--c:${PRIO[v].c}"><span class="sdot"></span>${PRIO[v].n}</button>`).join(''))
    .onclick = e => { const b = e.target.closest('button'); if (b) { upd(id, { prio: +b.dataset.v }); hidePop(); } };
}

/* ================= Neuer Task ================= */
function newTask() {
  const id = store.add('tasks', {
    title: '', description: '', status: 'Queued', prio: 2, progress: 0, deadline: '',
    persons: [], urls: [], chats: [],
  });
  if (!S.filter.has('Queued') && S.filter.size) { S.filter.add('Queued'); savePref('filter', [...S.filter]); renderSidebar(); }
  openTask(id, true);
}
$('#btnNew').onclick = newTask;

/* ================= Drawer ================= */
$('#fStatus').innerHTML = STATUSES.map(s => `<option>${s}</option>`).join('');
$('#fProg').innerHTML = Array.from({ length: 11 }, (_, i) => `<button data-v="${i * 10}">${i * 10}</button>`).join('');

function openTask(id, focusTitle = false) {
  if (task(id)?.recurNew) upd(id, { recurNew: false });
  S.openId = id; S.editMsgId = null; S.editLinkId = null; S.linkFilter = null;
  $('#chatInput').innerHTML = '';
  $('#chatEditor').classList.add('hidden'); hideLinkForm();
  $('#drawer').classList.remove('hidden'); $('#drawerBg').classList.remove('hidden');
  renderDrawer(true);
  if (focusTitle) setTimeout(() => $('#fTitle').focus(), 30);
}
function closeTask() {
  const t = task(S.openId);
  // leere neue Tasks automatisch wegräumen
  if (t && !t.title && !t.description && !(t.urls || []).length && !(t.chats || []).length && !(t.persons || []).length) store.remove('tasks', t.id);
  S.openId = null;
  $('#drawer').classList.add('hidden'); $('#drawerBg').classList.add('hidden');
}
$('#btnClose').onclick = closeTask;
$('#drawerBg').onclick = () => { if (!$('#recModal').classList.contains('hidden')) return closeRec(); closeTask(); };
$('#btnDelete').onclick = () => {
  const t = task(S.openId); if (!t) return;
  if (confirm(`Task "${t.title || 'Ohne Titel'}" löschen?`)) { store.remove('tasks', t.id); S.openId = null; closeTask(); toast('Task gelöscht'); }
};

function setVal(el, v) { if (document.activeElement !== el) el.value = v ?? ''; }

function renderDrawer(full = false) {
  const t = task(S.openId);
  if (!t) { if (S.openId && !full) closeTask(); return; }
  setVal($('#fTitle'), t.title);
  setVal($('#fDesc'), t.description);
  setVal($('#fStatus'), t.status);
  setVal($('#fDeadline'), t.deadline);
  $('#btnClearDeadline').classList.toggle('hidden', !t.deadline);
  $$('#fPrio button').forEach(b => b.classList.toggle('on', +b.dataset.v === +t.prio));
  $$('#fProg button').forEach(b => b.classList.toggle('fill', +b.dataset.v <= (+t.progress || 0) && +t.progress > 0));
  $('#fProgVal').textContent = `${+t.progress || 0}%`;
  renderPersons(t); renderLinks(t); renderChat(t);
}

// Felder: Autosave
const debounce = (fn, ms = 400) => { let h; return (...a) => { clearTimeout(h); h = setTimeout(() => fn(...a), ms); }; };
const saveTitle = debounce(v => upd(S.openId, { title: v }));
const saveDesc = debounce(v => upd(S.openId, { description: v }));
$('#fTitle').addEventListener('input', e => saveTitle(e.target.value.trim()));
$('#fDesc').addEventListener('input', e => saveDesc(e.target.value));
$('#fTitle').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#fDesc').focus(); } });
$('#fStatus').onchange = e => upd(S.openId, { status: e.target.value });
$('#fDeadline').onchange = e => upd(S.openId, { deadline: e.target.value });
$('#btnClearDeadline').onclick = () => upd(S.openId, { deadline: '' });
$('#fPrio').onclick = e => { const b = e.target.closest('button'); if (b) upd(S.openId, { prio: +b.dataset.v }); };
$('#fProg').onclick = e => { const b = e.target.closest('button'); if (b) upd(S.openId, { progress: +b.dataset.v }); };

/* Personen (Tags) + Frozen/Wartet auf */
function knownPersons() {
  const m = new Map();
  S.tasks.forEach(t => (t.persons || []).forEach(p => { const k = (p.name || '').toLowerCase(); if (k && !m.has(k)) m.set(k, p); }));
  return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
}
function renderPersons(t) {
  const ps = t.persons || [];
  const frozen = t.status === 'Frozen';
  $('#persons').innerHTML = ps.map(p => `
    <span class="tag ${frozen && waitsOf(t).some(w => w.personId === p.id) ? 'waiting' : ''}" data-id="${p.id}" title="Klick: Rolle ändern">
      <span class="ini">${esc(initials(p.name))}</span>${esc(p.name)}${p.role ? `<em>${esc(p.role)}</em>` : ''}
      <button class="tx" data-del="${p.id}" title="Entfernen">×</button></span>`).join('');
  const have = new Set(ps.map(p => p.name.toLowerCase()));
  $('#personList').innerHTML = knownPersons().filter(p => !have.has(p.name.toLowerCase()))
    .map(p => `<option value="${esc(p.name)}">${esc(p.role || '')}</option>`).join('');
  $('#waitBox').classList.toggle('hidden', !frozen);
  if (frozen) renderWaits(t);
}
function addPerson(raw) {
  const [n, r] = String(raw).split('/').map(s => s.trim()); if (!n) return;
  const t = task(S.openId); const ps = t.persons || [];
  if (ps.some(p => p.name.toLowerCase() === n.toLowerCase())) return;
  const k = knownPersons().find(p => p.name.toLowerCase() === n.toLowerCase());
  upd(t.id, { persons: [...ps, { id: uid(), name: k ? k.name : n, role: r || '' }] });
}
$('#pInput').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addPerson(e.target.value); e.target.value = ''; } });
$('#pInput').addEventListener('input', e => { if (e.inputType === 'insertReplacementText' || !e.inputType) { addPerson(e.target.value); e.target.value = ''; } });
$('#tagbox').addEventListener('click', e => { if (e.target === $('#tagbox') || e.target === $('#persons')) $('#pInput').focus(); });
$('#persons').onclick = e => {
  const t = task(S.openId);
  const d = e.target.closest('[data-del]');
  if (d) return upd(t.id, { persons: t.persons.filter(p => p.id !== d.dataset.del), waits: waitsOf(t).map(w => w.personId === d.dataset.del ? { ...w, personId: '' } : w) });
  const tag = e.target.closest('.tag'); if (!tag) return;
  const p = t.persons.find(x => x.id === tag.dataset.id);
  const r = prompt(`Rolle von ${p.name}`, p.role || ''); if (r === null) return;
  upd(t.id, { persons: t.persons.map(x => x.id === p.id ? { ...x, role: r.trim() } : x) });
};
function renderWaits(t) {
  if ($('#waits').contains(document.activeElement)) return;
  const ps = t.persons || [];
  const ws = waitsOf(t);
  $('#waits').innerHTML = ws.map(w => `
    <div class="wrow" data-id="${w.id}">
      <select data-wf="person"><option value="">– allgemein –</option>${ps.map(p => `<option value="${p.id}" ${p.id === w.personId ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
      <textarea data-wf="reason" rows="2" placeholder="worauf? z.B. OK, Berechtigung">${esc(w.reason)}</textarea>
      <button class="x" data-wdel="${w.id}" title="Entfernen">${svg.x}</button>
    </div>`).join('') || '<div class="muted small">Auf niemanden. „+ Eintrag“ zum Erfassen.</div>';
}
function readWaits() {
  const t = task(S.openId); const old = waitsOf(t);
  return $$('#waits .wrow').map(r => ({ id: r.dataset.id, personId: r.querySelector('[data-wf=person]').value, reason: r.querySelector('[data-wf=reason]').value.trim(), since: old.find(o => o.id === r.dataset.id)?.since || Date.now() }));
}
const saveWaits = debounce(() => upd(S.openId, { waits: readWaits() }), 350);
$('#waits').addEventListener('input', saveWaits);
$('#waits').addEventListener('change', () => upd(S.openId, { waits: readWaits() }));
$('#waits').addEventListener('focusout', () => setTimeout(() => { if (!$('#waits').contains(document.activeElement)) renderWaits(task(S.openId)); }, 50));
$('#waits').addEventListener('click', e => {
  const d = e.target.closest('[data-wdel]'); if (!d) return;
  const t = task(S.openId); upd(t.id, { waits: waitsOf(t).filter(w => w.id !== d.dataset.wdel) });
  setTimeout(() => renderWaits(task(S.openId)), 0);
});
$('#btnAddWait').onclick = () => {
  const t = task(S.openId); const id = uid();
  upd(t.id, { waits: [...waitsOf(t), { id, personId: '', reason: '', since: Date.now() }] });
  setTimeout(() => { renderWaits(task(S.openId)); $(`#waits [data-id="${id}"] select`)?.focus(); }, 30);
};

/* Links */
$('#lType').innerHTML = '<option value="auto">Typ: Auto</option>' + LINK_TYPES.map(x => `<option>${x}</option>`).join('');
function renderLinks(t) {
  const all = t.urls || [];
  const types = [...new Set(all.map(u => u.type || 'Others'))];
  if (S.linkFilter && !types.includes(S.linkFilter)) S.linkFilter = null;
  $('#linkFilter').innerHTML = types.length > 1 ? `<button class="chip ${!S.linkFilter ? 'on' : ''}" data-lf="">Alle ${all.length}</button>` +
    types.map(x => `<button class="chip ${S.linkFilter === x ? 'on' : ''}" data-lf="${x}"><img src="${ICON(x)}" alt="">${x} ${all.filter(u => (u.type || 'Others') === x).length}</button>`).join('') : '';
  const urls = S.linkFilter ? all.filter(u => (u.type || 'Others') === S.linkFilter) : all;
  $('#links').innerHTML = urls.length ? urls.map(u => u.id === S.editLinkId ? `
    <div class="lnk-edit" data-id="${u.id}">
      <input data-f="title" value="${esc(u.title)}" placeholder="Titel">
      <input data-f="url" value="${esc(u.url)}" placeholder="URL">
      <div class="row">
        <select data-f="type">${LINK_TYPES.map(x => `<option ${x === u.type ? 'selected' : ''}>${x}</option>`).join('')}</select>
        <button class="btn small primary" data-la="save">OK</button>
        <button class="icon-btn danger" data-la="del" title="Löschen">${svg.del}</button>
      </div>
    </div>` : `
    <a class="lnk" href="${esc(linkHref(u.url))}" ${linkTarget(u.url)} data-id="${u.id}" title="${esc(u.url)}">
      <img src="${ICON(u.type)}" alt="">
      <div class="lt"><b>${esc(u.title || hostOf(u.url))}</b><span>${esc(u.url)}</span></div>
      <button class="ed" data-la="edit" title="Bearbeiten">${svg.edit}</button>
    </a>`).join('') : '<div class="muted small">Noch keine Links.</div>';
}
$('#linkForm').addEventListener('keydown', e => { if (e.key === 'Enter') e.preventDefault(); });
$('#linkForm').addEventListener('submit', e => e.preventDefault());
$('#btnLinkCancel').onclick = () => hideLinkForm();
$('#btnLinkSave').onclick = () => {
  const url = normUrl($('#lUrl').value); if (!url) { $('#lUrl').focus(); return; }
  const t = task(S.openId);
  const ty = $('#lType').value === 'auto' ? detectType(url) : $('#lType').value;
  upd(t.id, { urls: [...(t.urls || []), { id: uid(), url, title: $('#lTitle').value.trim() || hostOf(url), type: ty }] });
  $('#lType').value = 'auto'; $('#lType').dataset.manual = ''; hideLinkForm();
};
$('#lUrl').addEventListener('input', e => { const u = e.target.value.trim(); if (u && $('#lType').dataset.manual !== '1') $('#lType').value = detectType(u) === 'Others' ? 'auto' : detectType(u); });
$('#lType').addEventListener('change', e => e.target.dataset.manual = e.target.value === 'auto' ? '' : '1');
$('#linkFilter').onclick = e => { const b = e.target.closest('[data-lf]'); if (!b) return; S.linkFilter = b.dataset.lf || null; renderLinks(task(S.openId)); };
$('#links').addEventListener('click', e => {
  const a = e.target.closest('[data-la]'); if (!a) return;
  e.preventDefault(); e.stopPropagation();
  const box = a.closest('[data-id]'); const lid = box.dataset.id; const t = task(S.openId);
  if (a.dataset.la === 'edit') { S.editLinkId = lid; renderLinks(t); return; }
  if (a.dataset.la === 'del') { S.editLinkId = null; upd(t.id, { urls: t.urls.filter(u => u.id !== lid) }); return; }
  if (a.dataset.la === 'save') {
    const v = f => box.querySelector(`[data-f="${f}"]`).value.trim();
    S.editLinkId = null;
    upd(t.id, { urls: t.urls.map(u => u.id === lid ? { ...u, title: v('title'), url: normUrl(v('url')), type: v('type') } : u) });
  }
});
$('#links').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.closest('.lnk-edit')) { e.preventDefault(); e.target.closest('.lnk-edit').querySelector('[data-la=save]').click(); } });

/* Chat */
function renderChat(t) {
  if (S.editMsgId && document.querySelector('.msg-edit')?.contains(document.activeElement)) return;
  const chats = [...(t.chats || [])].sort((a, b) => b.ts - a.ts);
  $('#chat').innerHTML = chats.length ? chats.map(c => `
    <div class="msg ${c.id === S.editMsgId ? 'editing' : ''}" data-id="${c.id}">
      <div class="mh">${fmtTs(c.ts)}${c.edited ? ' · bearbeitet' : ''}
        <span class="acts"><button data-ca="edit" title="Bearbeiten">${svg.edit}</button><button data-ca="del" title="Löschen">${svg.del}</button></span></div>
      ${c.id === S.editMsgId
        ? `<div class="editor msg-edit">${TB}<span class="grow"></span><button class="link-btn" data-ca="cancel">Abbrechen</button><button class="btn small primary" data-ca="save">Speichern</button></div><div class="rte" contenteditable="true">${clean(c.html)}</div></div>`
        : `<div class="mb" title="Doppelklick zum Bearbeiten">${clean(c.html)}</div>`}
    </div>`).join('') : '<div class="muted small">Noch keine Einträge.</div>';
  hydrate($('#chat'));
  $$('#chat .mb a').forEach(a => { if (isTeams(a.href)) { a.href = linkHref(a.href); a.removeAttribute('target'); } else { a.target = '_blank'; a.rel = 'noopener'; } });
}
function showChatEditor() { $('#chatEditor').classList.remove('hidden'); $('#chatInput').focus(); }
function hideChatEditor() { S.editMsgId = null; $('#chatInput').innerHTML = ''; $('#chatEditor').classList.add('hidden'); }
$('#btnChatNew').onclick = () => { if (S.editMsgId) finishMsgEdit(false); $('#chatInput').innerHTML = ''; showChatEditor(); };
function hideLinkForm() { $('#linkForm').classList.add('hidden'); $('#lUrl').value = ''; $('#lTitle').value = ''; }
$('#btnLinkNew').onclick = () => { const f = $('#linkForm'); if (f.classList.contains('hidden')) { f.classList.remove('hidden'); $('#lUrl').focus(); } else hideLinkForm(); };
function sendChat() {
  const html = clean($('#chatInput').innerHTML.trim());
  if (!stripHtml(html).trim() && !/<img/i.test(html)) return;
  const t = task(S.openId);
  upd(t.id, { chats: [...(t.chats || []), { id: uid(), ts: Date.now(), html }] });
  $('#chatInput').innerHTML = ''; $('#chatEditor').classList.add('hidden');
}
function startMsgEdit(mid) {
  $('#chatInput').innerHTML = ''; $('#chatEditor').classList.add('hidden');
  S.editMsgId = mid; renderChat(task(S.openId));
  const ed = document.querySelector('.msg-edit .rte'); if (!ed) return;
  hydrate(ed); ed.focus(); document.getSelection().selectAllChildren(ed); document.getSelection().collapseToEnd();
}
function finishMsgEdit(save) {
  const mid = S.editMsgId; const ed = document.querySelector('.msg-edit .rte'); S.editMsgId = null;
  const t = task(S.openId);
  if (save && ed && t) {
    const html = clean(ed.innerHTML.trim()); const old = t.chats.find(c => c.id === mid);
    if ((stripHtml(html).trim() || /<img/i.test(html)) && old && html !== old.html) {
      attIds(old.html).filter(x => !attIds(html).includes(x)).forEach(x => removeAtts(`data-att="${x}"`));
      upd(t.id, { chats: t.chats.map(c => c.id === mid ? { ...c, html, edited: Date.now() } : c) }); return;
    }
  }
  if (t) renderChat(t);
}
document.addEventListener('keydown', e => {
  if (!e.target.closest?.('.msg-edit')) return;
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); finishMsgEdit(true); }
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finishMsgEdit(false); }
}, true);
$('#btnSend').onclick = sendChat;
$('#btnCancelEdit').onclick = () => { $('#chatInput').innerHTML = ''; $('#chatEditor').classList.add('hidden'); };
$('#chatInput').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); sendChat(); } });
document.addEventListener('mousedown', e => {
  const b = e.target.closest('.toolbar [data-cmd]'); if (!b) return; e.preventDefault();
  const ed = b.closest('.editor')?.querySelector('.rte'); if (ed && !ed.contains(document.activeElement)) ed.focus();
  if (b.dataset.cmd === 'createLink') { const u = prompt('URL'); if (u) document.execCommand('createLink', false, normUrl(u)); }
  else document.execCommand(b.dataset.cmd);
});
const FORE = [['Standard', '#23272e'], ['Rot', '#d32f2f'], ['Orange', '#FF6600'], ['Grün', '#2e7d32'], ['Blau', '#014f80'], ['Violett', '#7b52c9'], ['Grau', '#8a9099']];
const BACK = [['Keine', 'transparent'], ['Gelb', '#fff3a0'], ['Grün', '#d8f0c8'], ['Blau', '#d6e8f7'], ['Rot', '#fbd5d3'], ['Orange', '#ffe0c2'], ['Violett', '#e6dcf7']];
document.addEventListener('mousedown', e => {
  const cb = e.target.closest('.toolbar [data-color]');
  const pick = e.target.closest('#colorPop [data-c]');
  if (pick) {
    e.preventDefault();
    const pop = $('#colorPop'); document.execCommand('styleWithCSS', false, true);
    if (pop.dataset.mode === 'fore') document.execCommand('foreColor', false, pick.dataset.c);
    else document.execCommand('hiliteColor', false, pick.dataset.c);
    pop.classList.add('hidden'); return;
  }
  if (!cb) { if (!e.target.closest('#colorPop')) $('#colorPop').classList.add('hidden'); return; }
  e.preventDefault();
  const ed = cb.closest('.editor')?.querySelector('.rte'); if (ed && !ed.contains(document.activeElement)) ed.focus();
  const mode = cb.dataset.color, list = mode === 'fore' ? FORE : BACK, pop = $('#colorPop');
  pop.dataset.mode = mode;
  pop.innerHTML = `<div class="cp-title">${mode === 'fore' ? 'Schriftfarbe' : 'Hintergrund'}</div>` + list.map(([n, c]) => `<button data-c="${c}" title="${n}" class="sw ${mode}" style="${mode === 'fore' ? 'color' : 'background'}:${c}">${mode === 'fore' ? 'A' : (c === 'transparent' ? '∅' : '')}</button>`).join('');
  const r = cb.getBoundingClientRect(); pop.classList.remove('hidden');
  pop.style.left = Math.min(r.left, innerWidth - pop.offsetWidth - 10) + 'px'; pop.style.top = (r.bottom + 6) + 'px';
});
$('#chat').addEventListener('click', e => {
  const b = e.target.closest('[data-ca]'); if (!b) return;
  const mid = b.closest('.msg').dataset.id; const t = task(S.openId);
  if (b.dataset.ca === 'del') { if (confirm('Eintrag löschen?')) { removeAtts(t.chats.find(c => c.id === mid)?.html); upd(t.id, { chats: t.chats.filter(c => c.id !== mid) }); } return; }
  if (b.dataset.ca === 'save') return finishMsgEdit(true);
  if (b.dataset.ca === 'cancel') return finishMsgEdit(false);
  startMsgEdit(mid);
});
$('#chat').addEventListener('dblclick', e => { const mb = e.target.closest('.msg .mb'); if (mb && !e.target.closest('a,img')) startMsgEdit(mb.closest('.msg').dataset.id); });

/* ================= 2do ================= */
const TB = `<div class="toolbar"><button data-cmd="bold" title="Bold"><b>B</b></button><button data-cmd="italic" title="Italic"><i>I</i></button><button data-cmd="underline" title="Underline"><u>U</u></button><button data-cmd="insertUnorderedList" title="Liste">•</button><button data-cmd="createLink" title="Link">🔗</button><button data-color="fore" title="Schriftfarbe" class="cbtn"><span class="ca">A</span></button><button data-color="back" title="Hintergrundfarbe" class="cbtn"><span class="cm">▌</span></button>`;
function renderTodos() {
  if (S.editTodoId && document.querySelector('.todo-edit')?.contains(document.activeElement)) return;
  const open = S.todos.filter(t => !t.done).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const done = S.todos.filter(t => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  const row = t => `
    <li class="todo ${t.done ? 'is-done' : ''}" data-id="${t.id}">
      <button class="chk" data-ta="chk" title="${t.done ? 'Wieder öffnen' : 'Erledigt'}"></button>
      <div style="flex:1;min-width:0">
        ${S.editTodoId === t.id ? `<div class="editor todo-edit">${TB}<span class="grow"></span><button class="link-btn" data-ta="cancel">Abbrechen</button><button class="btn small primary" data-ta="save">Speichern</button></div><div class="rte" contenteditable="true">${todoHtml(t)}</div></div>`
          : `<div class="txt" data-ta="txt" title="Doppelklick zum Bearbeiten">${todoHtml(t)}</div>`}
        <div class="meta">${t.done ? 'erledigt ' + fmtTs(t.doneAt) : fmtTs(t.createdAt)}</div>
      </div>
      ${S.editTodoId === t.id ? '' : `<button class="del" data-ta="edit" title="Bearbeiten">${svg.edit}</button><button class="del" data-ta="del" title="Löschen">${svg.x}</button>`}
    </li>`;
  $('#todoList').innerHTML = open.map(row).join('') || '<li class="muted small" style="padding:10px 4px">Alles erledigt.</li>';
  $('#todoDoneList').innerHTML = done.map(row).join('');
  hydrate($('#todoList')); hydrate($('#todoDoneList'));
  $('#todoCount').textContent = open.length;
  $('#todoTabCount').textContent = open.length;
  $('#todoDoneCount').textContent = `(${done.length})`;
  $('#todoDoneWrap').classList.toggle('hidden', !done.length);
}
const todoHtml = t => t.html ? clean(t.html) : linkify(t.text);
function addTodo() {
  const html = clean($('#todoInput').innerHTML.trim()); const text = stripHtml(html).trim();
  if (!text && !/<img/i.test(html)) return;
  store.add('todos', { html, text, done: false }); hideTodoEditor();
}
$('#btnTodoAdd').onclick = addTodo;
function showTodoEditor() { setTodoCollapsed(false); $('#todoEditor').classList.remove('hidden'); $('#todoInput').focus(); }
function hideTodoEditor() { $('#todoInput').innerHTML = ''; $('#todoEditor').classList.add('hidden'); }
$('#btnTodoNew').onclick = () => $('#todoEditor').classList.contains('hidden') ? showTodoEditor() : hideTodoEditor();
$('#btnTodoCancel').onclick = hideTodoEditor;
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const a = document.activeElement;
  if (a === $('#todoInput')) { e.stopPropagation(); e.preventDefault(); hideTodoEditor(); }
  else if (a === $('#chatInput')) { e.stopPropagation(); e.preventDefault(); hideChatEditor(); renderChat(task(S.openId)); }
  else if (a === $('#lUrl') || a === $('#lTitle') || a === $('#lType')) { e.stopPropagation(); e.preventDefault(); hideLinkForm(); }
}, true);
function setTodoCollapsed(v) { document.body.classList.toggle('todo-collapsed', v); savePref('todoCollapsed', v); }
setTodoCollapsed(!!loadPref('todoCollapsed', false));
$('#btnTodoHide').onclick = () => setTodoCollapsed(true);
$('#todoTab').onclick = () => setTodoCollapsed(false);
$('#todoInput').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); addTodo(); } });
function todoClick(e) {
  const el = e.target.closest('[data-ta]'); if (!el) return;
  const id = el.closest('.todo').dataset.id; const t = S.todos.find(x => x.id === id);
  if (el.dataset.ta === 'chk') store.update('todos', id, { done: !t.done, doneAt: t.done ? null : Date.now() });
  if (el.dataset.ta === 'del') { removeAtts(t.html); store.remove('todos', id); }
  if (el.dataset.ta === 'edit') todoEdit({ target: el.closest('.todo').querySelector('[data-ta=txt]') });
}
function todoEdit(e) {
  const el = e.target.closest('[data-ta=txt]'); if (!el || e.target.closest('a')) return;
  S.editTodoId = el.closest('.todo').dataset.id; renderTodos();
  const ed = document.querySelector('.todo-edit .rte'); hydrate(ed); ed.focus();
  document.getSelection().selectAllChildren(ed); document.getSelection().collapseToEnd();
}
function todoFinish(save) {
  const id = S.editTodoId; const ed = document.querySelector('.todo-edit .rte'); S.editTodoId = null;
  if (save && ed) { const html = clean(ed.innerHTML.trim()); const text = stripHtml(html).trim(); const t = S.todos.find(x => x.id === id); if ((text || /<img/i.test(html)) && html !== t.html) { attIds(t.html).filter(x => !attIds(html).includes(x)).forEach(x => removeAtts(`data-att="${x}"`)); store.update('todos', id, { html, text }); return; } }
  renderTodos();
}
document.addEventListener('click', e => { const b = e.target.closest('.todo-edit [data-ta]'); if (b) { e.stopPropagation(); todoFinish(b.dataset.ta === 'save'); } }, true);
document.addEventListener('keydown', e => {
  if (!e.target.closest?.('.todo-edit')) return;
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); todoFinish(true); }
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); todoFinish(false); }
}, true);
['#todoList', '#todoDoneList'].forEach(s => { $(s).addEventListener('click', todoClick); $(s).addEventListener('dblclick', todoEdit); });


/* ================= Recurring ================= */
const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const todayIso = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const isoOf = d => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
function nextAfter(r, iso) {
  const d = new Date(iso + 'T12:00:00'); const n = Math.max(1, +r.every || 1);
  if (r.freq === 'daily') d.setDate(d.getDate() + n);
  else if (r.freq === 'weekly') d.setDate(d.getDate() + 7 * n);
  else if (r.freq === 'monthly') { const day = +r.dom || d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); }
  else if (r.freq === 'workdays') { do d.setDate(d.getDate() + 1); while ([0, 6].includes(d.getDay())); }
  return isoOf(d);
}
function rhythmText(r) {
  const n = +r.every || 1;
  if (r.freq === 'daily') return n === 1 ? 'täglich' : `alle ${n} Tage`;
  if (r.freq === 'workdays') return 'Mo-Fr';
  if (r.freq === 'weekly') return (n === 1 ? 'wöchentlich' : `alle ${n} Wochen`) + (r.next ? ' (' + WD[new Date(r.next + 'T12:00').getDay()] + ')' : '');
  if (r.freq === 'monthly') return (n === 1 ? 'monatlich' : `alle ${n} Monate`) + (r.dom ? ` am ${r.dom}.` : '');
  return '';
}
// erzeugt fällige Instanzen; Task-ID ist deterministisch -> keine Duplikate über Tabs/Geräte
function runRecurring() {
  const today = todayIso();
  if (!$('#recModal').classList.contains('hidden')) return;
  S.recs.filter(r => r.active !== false && r.next && r.title).forEach(r => {
    let due = r.next, guard = 0;
    const lead = Math.max(0, +r.lead || 0);
    const createUntil = isoOf(new Date(new Date(today + 'T12:00').getTime() + lead * 864e5));
    let created = false;
    while (due <= createUntil && guard++ < 60) {
      const id = `rec-${r.id}-${due}`;
      if (!task(id)) {
        store.put('tasks', id, {
          title: r.title, description: r.description || '', status: 'Queued', prio: +r.prio || 2, progress: 0,
          deadline: due, persons: [], urls: (r.urls || []).map(u => ({ ...u, id: uid() })), chats: [],
          recId: r.id, recurNew: true, createdAt: Date.now(), updatedAt: Date.now(),
        });
        created = true;
      }
      due = nextAfter(r, due);
    }
    if (due !== r.next) store.update('recurring', r.id, { next: due });
    if (created) toast(`↻ Neu im Queued: ${r.title}`);
  });
}
function renderRecs() {
  $('#recCount').textContent = S.recs.filter(r => r.active !== false).length || '';
  if ($('#recModal').classList.contains('hidden')) return;
  if ($('#recList').contains(document.activeElement)) return;
  const recs = [...S.recs].sort((a, b) => (a.next || '').localeCompare(b.next || ''));
  $('#recList').innerHTML = recs.length ? recs.map(r => `
    <div class="rec ${r.active === false ? 'off' : ''}" data-id="${r.id}">
      <input class="rec-title" data-rf="title" value="${esc(r.title)}" placeholder="Titel der Aufgabe">
      <div class="rec-row">
        <select data-rf="freq">
          ${[['daily', 'Täglich'], ['workdays', 'Mo-Fr'], ['weekly', 'Wöchentlich'], ['monthly', 'Monatlich']].map(([v, n]) => `<option value="${v}" ${r.freq === v ? 'selected' : ''}>${n}</option>`).join('')}
        </select>
        <label class="mini ${r.freq === 'workdays' ? 'hidden' : ''}">alle <input type="number" min="1" data-rf="every" value="${+r.every || 1}"></label>
        <label class="mini ${r.freq === 'monthly' ? '' : 'hidden'}">am <input type="number" min="1" max="31" data-rf="dom" value="${r.dom || ''}">.</label>
        <label class="mini">nächste <input type="date" data-rf="next" value="${r.next || ''}"></label>
        <label class="mini" title="So viele Tage vor dem Termin im Queued erstellen">Vorlauf <input type="number" min="0" data-rf="lead" value="${+r.lead || 0}"> T</label>
        <select data-rf="prio">${[1, 2, 3].map(v => `<option value="${v}" ${(+r.prio || 2) === v ? 'selected' : ''}>${PRIO[v].n}</option>`).join('')}</select>
      </div>
      <div class="rec-foot">
        <span class="muted small">${r.next ? esc(rhythmText(r)) + ' · nächste ' + fmtDate(r.next) : '⚠ Datum „nächste“ setzen, sonst inaktiv'}</span>
        <span class="grow"></span>
        <label class="mini"><input type="checkbox" data-rf="active" ${r.active === false ? '' : 'checked'}> aktiv</label>
        <button class="icon-btn danger" data-rdel title="Löschen">${svg.del}</button>
      </div>
    </div>`).join('') : '<div class="muted" style="padding:20px 4px">Noch keine wiederkehrenden Aufgaben.</div>';
}
function readRec(el) {
  const v = f => el.querySelector(`[data-rf="${f}"]`);
  return { title: v('title').value.trim(), freq: v('freq').value, every: +v('every').value || 1, dom: +v('dom').value || null,
    next: v('next').value, lead: +v('lead').value || 0, prio: +v('prio').value, active: v('active').checked };
}
const saveRec = debounce(el => store.update('recurring', el.dataset.id, readRec(el)), 400);
$('#recList').addEventListener('input', e => { const el = e.target.closest('.rec'); if (el) saveRec(el); });
$('#recList').addEventListener('change', e => {
  const el = e.target.closest('.rec'); if (!el) return;
  store.update('recurring', el.dataset.id, readRec(el));
  if (['freq', 'active'].includes(e.target.dataset.rf)) { e.target.blur(); setTimeout(renderRecs, 50); }
});
$('#recList').addEventListener('focusout', () => setTimeout(() => { if (!$('#recList').contains(document.activeElement)) renderRecs(); }, 80));
$('#recList').addEventListener('click', e => {
  const d = e.target.closest('[data-rdel]'); if (!d) return;
  const el = d.closest('.rec'); if (confirm('Wiederkehrende Aufgabe löschen? Bereits erstellte Tasks bleiben.')) { store.remove('recurring', el.dataset.id); setTimeout(renderRecs, 50); }
});
$('#btnRecAdd').onclick = () => {
  const id = store.add('recurring', { title: '', freq: 'weekly', every: 1, next: '', lead: 0, prio: 2, active: true });
  setTimeout(() => { renderRecs(); const el = $(`#recList [data-id="${id}"] .rec-title`); el?.focus(); el?.select(); }, 80);
};
$('#btnRec').onclick = () => { $('#recModal').classList.remove('hidden'); $('#drawerBg').classList.remove('hidden'); renderRecs(); };
const closeRec = () => { $('#recModal').classList.add('hidden'); if (!S.openId) $('#drawerBg').classList.add('hidden'); runRecurring(); };
$('#btnRecClose').onclick = closeRec;

document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="https://teams.microsoft.com/"]'); if (!a) return;
  e.preventDefault(); location.href = linkHref(a.href);
}, true);


/* ================= Anhänge (Screenshots) ================= */
const ATT = new Map(); // id -> thumb dataURL
function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
function toDataUrl(img, maxW, q) {
  const s = Math.min(1, maxW / img.naturalWidth);
  const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/webp', q);
}
async function saveImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImg(url);
    let w = 2400, q = 0.9, full = toDataUrl(img, w, q);
    while (full.length > 900000 && w > 600) { w = Math.round(w * 0.8); q = Math.max(0.6, q - 0.08); full = toDataUrl(img, w, q); }
    const thumb = toDataUrl(img, 480, 0.8);
    const id = 'a' + uid();
    store.put('attthumb', id, { data: thumb, w: img.naturalWidth, h: img.naturalHeight, createdAt: Date.now() });
    store.put('attfull', id, { data: full, createdAt: Date.now() });
    ATT.set(id, thumb);
    return { id, thumb };
  } finally { URL.revokeObjectURL(url); }
}
async function insertImages(ed, files) {
  for (const f of files) {
    if (!f.type.startsWith('image/')) continue;
    toast('Screenshot wird gespeichert …');
    const { id, thumb } = await saveImage(f);
    ed.focus();
    document.execCommand('insertHTML', false, `<img class="att" data-att="${id}" src="${thumb}" alt="Screenshot"><br>`);
    toast('Screenshot angehängt');
  }
}
document.addEventListener('paste', e => {
  const ed = e.target.closest?.('.rte'); if (!ed) return;
  const files = [...(e.clipboardData?.files || [])].filter(f => f.type.startsWith('image/'));
  if (!files.length) return;
  e.preventDefault(); insertImages(ed, files);
});
document.addEventListener('dragover', e => { if (e.target.closest?.('.rte')) e.preventDefault(); });
document.addEventListener('drop', e => {
  const ed = e.target.closest?.('.rte'); if (!ed) return;
  const files = [...(e.dataTransfer?.files || [])].filter(f => f.type.startsWith('image/'));
  if (!files.length) return;
  e.preventDefault(); insertImages(ed, files);
});
// Bilder in gerenderten Bereichen nachladen
function hydrate(root) {
  root?.querySelectorAll('img[data-att]').forEach(async im => {
    const id = im.dataset.att;
    if (!im.closest('.rte') && !im.parentElement.classList.contains('attw')) {
      const w = document.createElement('span'); w.className = 'attw';
      im.replaceWith(w); w.append(im);
      w.insertAdjacentHTML('beforeend', '<button class="attdel" title="Bild löschen">×</button>');
    }
    if (ATT.has(id)) { im.src = ATT.get(id); return; }
    im.classList.add('loading');
    const d = await store.get('attthumb', id).catch(() => null);
    if (d?.data) { ATT.set(id, d.data); im.src = d.data; } else im.classList.add('missing');
    im.classList.remove('loading');
  });
}
const attIds = html => [...String(html || '').matchAll(/data-att="([\w-]+)"/g)].map(m => m[1]);
function removeAtts(html) { attIds(html).forEach(id => { store.remove('attthumb', id); store.remove('attfull', id); ATT.delete(id); }); }
// Bild löschen (Ansicht) bzw. im Editor entfernen
const stripAtt = (html, id) => String(html || '').replace(new RegExp(`<img[^>]*data-att="${id}"[^>]*>(<br>)?`, 'g'), '');
document.addEventListener('click', e => {
  const del = e.target.closest('.attdel'); if (!del) return;
  e.preventDefault(); e.stopPropagation();
  const id = del.parentElement.querySelector('img[data-att]')?.dataset.att; if (!id || !confirm('Bild löschen?')) return;
  const msg = del.closest('#chat .msg'), td = del.closest('.todo');
  if (msg) { const t = task(S.openId); upd(t.id, { chats: t.chats.map(c => c.id === msg.dataset.id ? { ...c, html: stripAtt(c.html, id) } : c) }); }
  else if (td) { const t = S.todos.find(x => x.id === td.dataset.id); const html = stripAtt(t.html, id); store.update('todos', t.id, { html, text: stripHtml(html).trim() }); }
  removeAtts(`data-att="${id}"`);
}, true);
document.addEventListener('click', e => {
  const im = e.target.closest('.rte img[data-att]'); if (!im) return;
  e.preventDefault();
  if (confirm('Bild aus diesem Eintrag entfernen?')) { const br = im.nextSibling; im.remove(); if (br?.nodeName === 'BR') br.remove(); }
});
// Klick auf Vorschau -> Grossansicht
async function openLightbox(id) {
  const lb = $('#lightbox'); lb.classList.remove('hidden');
  const im = $('#lbImg'); im.src = ATT.get(id) || ''; $('#lbOpen').dataset.id = id;
  const d = await store.get('attfull', id).catch(() => null);
  if (d?.data && $('#lbOpen').dataset.id === id) im.src = d.data;
}
const closeLightbox = () => { $('#lightbox').classList.add('hidden'); $('#lbImg').src = ''; };
document.addEventListener('click', e => {
  const im = e.target.closest('img[data-att]'); if (!im || im.closest('.rte')) return;
  e.preventDefault(); e.stopPropagation(); openLightbox(im.dataset.att);
}, true);
$('#lightbox').addEventListener('click', e => { if (!e.target.closest('#lbOpen')) closeLightbox(); });
$('#lbOpen').onclick = async () => {
  const src = $('#lbImg').src; if (!src) return;
  const blob = await (await fetch(src)).blob(); window.open(URL.createObjectURL(blob), '_blank');
};
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#lightbox').classList.contains('hidden')) { e.stopPropagation(); e.preventDefault(); closeLightbox(); } }, true);

/* ================= Suche / Shortcuts ================= */
$('#search').addEventListener('input', debounce(e => {
  const was = !!S.q; S.q = e.target.value.trim();
  if (S.q && !was) S.sFilter = new Set(STATUSES);
  renderSidebar(); renderList();
}, 120));
document.addEventListener('keydown', e => {
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
  if (e.key === 'Escape') {
    if (!$('#pop').classList.contains('hidden')) return hidePop();
    if (!$('#recModal').classList.contains('hidden')) { if (typing) document.activeElement.blur(); return closeRec(); }
    if (S.openId) { if (typing) document.activeElement.blur(); return closeTask(); }
    if (document.activeElement === $('#search')) { $('#search').value = ''; S.q = ''; renderSidebar(); renderList(); $('#search').blur(); }
    return;
  }
  if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === '/') { e.preventDefault(); $('#search').focus(); }
  else if (e.key.toLowerCase() === 'n' && !S.openId) { e.preventDefault(); newTask(); }
  else if (e.key.toLowerCase() === 't' && !S.openId) { e.preventDefault(); showTodoEditor(); }
});

/* ================= User-Menü / Backup ================= */
$('#btnUser').onclick = () => $('#userMenu').classList.toggle('hidden');
$('#userMenu').addEventListener('click', e => {
  const a = e.target.closest('[data-act]')?.dataset.act;
  if (a === 'logout' && store.signOut) store.signOut();
  if (a === 'export') {
    const blob = new Blob([JSON.stringify({ app: 'M-CORE', exported: new Date().toISOString(), tasks: S.tasks, todos: S.todos }, null, 2)], { type: 'application/json' });
    const a2 = document.createElement('a'); a2.href = URL.createObjectURL(blob); a2.download = `m-core-backup-${new Date().toISOString().slice(0, 10)}.json`; a2.click();
  }
});
$('#importFile').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (!confirm(`${(d.tasks || []).length} Tasks und ${(d.todos || []).length} 2dos importieren? Bestehende Einträge mit gleicher ID werden überschrieben.`)) return;
    (d.tasks || []).forEach(({ id, ...x }) => store.put('tasks', id || uid(), x));
    (d.todos || []).forEach(({ id, ...x }) => store.put('todos', id || uid(), x));
    toast('Import abgeschlossen');
  } catch (err) { toast('Import fehlgeschlagen: ' + err.message); }
  e.target.value = '';
};

/* ================= Start ================= */
(async function init() {
  try {
    store = CONFIG.firebase?.apiKey ? await firebaseStore() : localStore();
  } catch (e) { console.error(e); return; }
  $('#app').classList.remove('hidden');
  const u = store.user;
  const av = $('#btnUser');
  if (u.photo) av.style.backgroundImage = `url("${u.photo}")`; else av.textContent = initials(u.name);
  $('#userInfo').innerHTML = `<b>${esc(u.name || '')}</b>${esc(u.email || '')}`;
  if (!store.signOut) $('#btnLogout').classList.add('hidden');
  $('#modeBadge').textContent = store.mode.startsWith('LOCAL') ? '⚠ ' + store.mode : '● online · offline-fähig';

  store.sub('tasks', ts => { S.tasks = ts; renderSidebar(); renderList(); if (S.openId) renderDrawer(); });
  store.sub('todos', td => { S.todos = td; renderTodos(); });
  let recInit = false;
  store.sub('recurring', rs => { S.recs = rs; renderRecs(); if (!recInit) { recInit = true; setTimeout(runRecurring, 1500); } });
  setInterval(runRecurring, 30 * 60 * 1000);
})();

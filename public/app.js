import { CONFIG } from './config.js';

/* ================= Konstanten ================= */
const STATUSES = ['Ideas', 'Queued', 'In Motion', 'Delivered', 'Frozen', 'Dropped'];
const STATUS_COLOR = { 'Ideas': '#b39ddb', 'Queued': '#769cc1', 'In Motion': '#FF6600', 'Delivered': '#7cb342', 'Frozen': '#90a4ae', 'Dropped': '#bdbdbd' };
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
const ALLOWED = new Set(['B','STRONG','I','EM','U','S','P','BR','DIV','SPAN','UL','OL','LI','A','CODE','PRE','BLOCKQUOTE','H1','H2','H3','H4','FONT']);
function clean(html) {
  const tpl = document.createElement('template'); tpl.innerHTML = html || '';
  const walk = node => [...node.childNodes].forEach(n => {
    if (n.nodeType === 8) return n.remove();
    if (n.nodeType !== 1) return;
    if (!ALLOWED.has(n.tagName)) { if (/^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED)$/.test(n.tagName)) return n.remove(); walk(n); n.replaceWith(...n.childNodes); return; }
    [...n.attributes].forEach(a => { if (!(n.tagName === 'A' && a.name === 'href') && a.name !== 'color') n.removeAttribute(a.name); });
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
function initials(n) { return (n || '?').split(/\s+/).map(s => s[0]).slice(0, 2).join('').toUpperCase(); }

/* ================= Sidebar ================= */
function renderSidebar() {
  const counts = Object.fromEntries(STATUSES.map(s => [s, 0]));
  S.tasks.forEach(t => counts[t.status] = (counts[t.status] || 0) + 1);
  $('#statusNav').innerHTML = STATUSES.map(s => `
    <button class="st-btn ${S.filter.has(s) ? 'on' : ''}" data-s="${s}" style="--c:${STATUS_COLOR[s]}">
      <span class="sdot"></span>${s}<span class="cnt">${counts[s]}</span>
    </button>`).join('');
}
$('#statusNav').addEventListener('click', e => {
  const b = e.target.closest('.st-btn'); if (!b) return;
  const s = b.dataset.s;
  if (e.ctrlKey || e.metaKey) S.filter = new Set([s]);
  else S.filter.has(s) ? S.filter.delete(s) : S.filter.add(s);
  savePref('filter', [...S.filter]); renderSidebar(); renderList();
});
$('#btnAll').onclick = () => { S.filter = new Set(STATUSES); savePref('filter', STATUSES); renderSidebar(); renderList(); };
$('#btnActive').onclick = () => { S.filter = new Set(DEFAULT_FILTER); savePref('filter', DEFAULT_FILTER); renderSidebar(); renderList(); };

/* ================= Task-Liste ================= */
function visibleTasks() {
  const q = S.q.toLowerCase();
  return S.tasks
    .filter(t => !S.filter.size || S.filter.has(t.status))
    .filter(t => !q || [t.title, t.description,
      ...(t.urls || []).flatMap(u => [u.title, u.url]),
      ...(t.chats || []).map(c => stripHtml(c.html)),
      ...(t.persons || []).map(p => p.name)].some(v => (v || '').toLowerCase().includes(q)))
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
    <article class="task" data-id="${t.id}">
      <div class="bar" style="--pc:${p.c}" data-act="prio" title="Prio: ${p.n}"></div>
      <div class="main">
        <div class="ttl ${t.title ? '' : 'empty-ttl'}">${esc(t.title || 'Ohne Titel')}</div>
        ${t.status === 'Frozen' && waitsOf(t).length ? `<div class="desc waitline">⏸ ${esc(waitText(t))}</div>`
          : t.description ? `<div class="desc">${esc(t.description)}</div>` : ''}
      </div>
      <div class="qlinks">${urls.slice(0, 6).map(u => `
        <a class="qlink" href="${esc(u.url)}" target="_blank" rel="noopener" title="${esc(u.title || u.url)}"><img src="${ICON(u.type)}" alt=""></a>`).join('')}</div>
      <span class="type ${t.type}" title="${t.type === 'P' ? 'Project' : 'Task'}">${t.type || 'T'}</span>
      <button class="status-pill" data-act="status" style="--c:${STATUS_COLOR[t.status]}"><span class="sdot"></span>${esc(t.status)}</button>
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
  showPop(a, STATUSES.map(s => `<button data-v="${s}" class="${t.status === s ? 'cur' : ''}" style="--c:${STATUS_COLOR[s]}"><span class="sdot"></span>${s}</button>`).join(''))
    .onclick = e => { const b = e.target.closest('button'); if (b) { upd(id, { status: b.dataset.v }); hidePop(); } };
}
function progPop(a, id) {
  const t = task(id);
  showPop(a, Array.from({ length: 11 }, (_, i) => i * 10).map(v => `<button data-v="${v}" class="${+t.progress === v ? 'cur' : ''}">${v}</button>`).join(''), 'prog')
    .onclick = e => { const b = e.target.closest('button'); if (b) { upd(id, { progress: +b.dataset.v }); hidePop(); } };
}
function prioPop(a, id) {
  const t = task(id);
  showPop(a, [1, 2, 3].map(v => `<button data-v="${v}" class="${+t.prio === v ? 'cur' : ''}" style="--c:${PRIO[v].c}"><span class="sdot"></span>${PRIO[v].n}</button>`).join(''))
    .onclick = e => { const b = e.target.closest('button'); if (b) { upd(id, { prio: +b.dataset.v }); hidePop(); } };
}

/* ================= Neuer Task ================= */
function newTask() {
  const id = store.add('tasks', {
    title: '', description: '', status: 'Queued', type: 'T', prio: 2, progress: 0, deadline: '',
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
  S.openId = id; S.editMsgId = null; S.editLinkId = null; S.linkFilter = null;
  $('#chatInput').innerHTML = '';
  $('#drawer').classList.remove('hidden'); $('#drawerBg').classList.remove('hidden');
  renderDrawer(true);
  setTimeout(() => (focusTitle ? $('#fTitle') : $('#lUrl')).focus(), 30);
}
function closeTask() {
  const t = task(S.openId);
  // leere neue Tasks automatisch wegräumen
  if (t && !t.title && !t.description && !(t.urls || []).length && !(t.chats || []).length && !(t.persons || []).length) store.remove('tasks', t.id);
  S.openId = null;
  $('#drawer').classList.add('hidden'); $('#drawerBg').classList.add('hidden');
}
$('#btnClose').onclick = closeTask;
$('#drawerBg').onclick = closeTask;
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
  setVal($('#fType'), t.type || 'T');
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
$('#fType').onchange = e => upd(S.openId, { type: e.target.value });
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
      <input data-wf="reason" value="${esc(w.reason)}" placeholder="worauf? z.B. OK, Berechtigung">
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
    <a class="lnk" href="${esc(u.url)}" target="_blank" rel="noopener" data-id="${u.id}">
      <img src="${ICON(u.type)}" alt="">
      <div class="lt"><b>${esc(u.title || hostOf(u.url))}</b><span>${esc(u.url)}</span></div>
      <button class="ed" data-la="edit" title="Bearbeiten">${svg.edit}</button>
    </a>`).join('') : '<div class="muted small">Noch keine Links. URL oben einfügen.</div>';
}
$('#linkForm').addEventListener('keydown', e => {
  if (e.key !== 'Enter') return; e.preventDefault();
  const url = normUrl($('#lUrl').value); if (!url) return;
  const t = task(S.openId);
  const ty = $('#lType').value === 'auto' ? detectType(url) : $('#lType').value;
  upd(t.id, { urls: [...(t.urls || []), { id: uid(), url, title: $('#lTitle').value.trim() || hostOf(url), type: ty }] });
  $('#lUrl').value = ''; $('#lTitle').value = ''; $('#lType').value = 'auto'; $('#lType').dataset.manual = ''; $('#lUrl').focus();
});
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
  const chats = [...(t.chats || [])].sort((a, b) => b.ts - a.ts);
  $('#chat').innerHTML = chats.length ? chats.map(c => `
    <div class="msg ${c.id === S.editMsgId ? 'editing' : ''}" data-id="${c.id}">
      <div class="mh">${fmtTs(c.ts)}${c.edited ? ' · bearbeitet' : ''}
        <span class="acts"><button data-ca="edit" title="Bearbeiten">${svg.edit}</button><button data-ca="del" title="Löschen">${svg.del}</button></span></div>
      <div class="mb">${clean(c.html)}</div>
    </div>`).join('') : '<div class="muted small">Noch keine Einträge.</div>';
  $$('#chat .mb a').forEach(a => { a.target = '_blank'; a.rel = 'noopener'; });
}
function sendChat() {
  const html = clean($('#chatInput').innerHTML.trim());
  if (!stripHtml(html).trim() && !/<img/i.test(html)) return;
  const t = task(S.openId);
  if (S.editMsgId) {
    upd(t.id, { chats: t.chats.map(c => c.id === S.editMsgId ? { ...c, html, edited: Date.now() } : c) });
    S.editMsgId = null; $('#btnCancelEdit').classList.add('hidden');
  } else {
    upd(t.id, { chats: [...(t.chats || []), { id: uid(), ts: Date.now(), html }] });
  }
  $('#chatInput').innerHTML = '';
}
$('#btnSend').onclick = sendChat;
$('#btnCancelEdit').onclick = () => { S.editMsgId = null; $('#chatInput').innerHTML = ''; $('#btnCancelEdit').classList.add('hidden'); renderChat(task(S.openId)); };
$('#chatInput').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); sendChat(); } });
$$('.toolbar').forEach(tb => tb.addEventListener('mousedown', e => {
  const b = e.target.closest('[data-cmd]'); if (!b) return; e.preventDefault();
  const ed = document.getElementById(tb.dataset.target); if (ed && !ed.contains(document.activeElement) && document.activeElement !== ed) ed.focus();
  if (b.dataset.cmd === 'createLink') { const u = prompt('URL'); if (u) document.execCommand('createLink', false, normUrl(u)); }
  else document.execCommand(b.dataset.cmd);
}));
$('#chat').addEventListener('click', e => {
  const b = e.target.closest('[data-ca]'); if (!b) return;
  const mid = b.closest('.msg').dataset.id; const t = task(S.openId);
  if (b.dataset.ca === 'del') { if (confirm('Eintrag löschen?')) upd(t.id, { chats: t.chats.filter(c => c.id !== mid) }); return; }
  S.editMsgId = mid; $('#chatInput').innerHTML = clean(t.chats.find(c => c.id === mid).html);
  $('#btnCancelEdit').classList.remove('hidden'); renderChat(t); $('#chatInput').focus();
});

/* ================= 2do ================= */
function renderTodos() {
  const open = S.todos.filter(t => !t.done).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const done = S.todos.filter(t => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  const row = t => `
    <li class="todo ${t.done ? 'is-done' : ''}" data-id="${t.id}">
      <button class="chk" data-ta="chk" title="${t.done ? 'Wieder öffnen' : 'Erledigt'}"></button>
      <div style="flex:1;min-width:0">
        <div class="txt" data-ta="txt" title="Doppelklick zum Bearbeiten">${todoHtml(t)}</div>
        <div class="meta">${t.done ? 'erledigt ' + fmtTs(t.doneAt) : fmtTs(t.createdAt)}</div>
      </div>
      <button class="del" data-ta="del" title="Löschen">${svg.x}</button>
    </li>`;
  $('#todoList').innerHTML = open.map(row).join('') || '<li class="muted small" style="padding:10px 4px">Alles erledigt.</li>';
  $('#todoDoneList').innerHTML = done.map(row).join('');
  $('#todoCount').textContent = open.length;
  $('#todoDoneCount').textContent = `(${done.length})`;
  $('#todoDoneWrap').classList.toggle('hidden', !done.length);
}
const todoHtml = t => t.html ? clean(t.html) : linkify(t.text);
function addTodo() {
  const html = clean($('#todoInput').innerHTML.trim()); const text = stripHtml(html).trim();
  if (!text) return;
  store.add('todos', { html, text, done: false }); $('#todoInput').innerHTML = '';
}
$('#btnTodoAdd').onclick = addTodo;
$('#todoInput').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); addTodo(); } });
function todoClick(e) {
  const el = e.target.closest('[data-ta]'); if (!el) return;
  const id = el.closest('.todo').dataset.id; const t = S.todos.find(x => x.id === id);
  if (el.dataset.ta === 'chk') store.update('todos', id, { done: !t.done, doneAt: t.done ? null : Date.now() });
  if (el.dataset.ta === 'del') store.remove('todos', id);
}
function todoEdit(e) {
  const el = e.target.closest('[data-ta=txt]'); if (!el || e.target.closest('a')) return;
  const id = el.closest('.todo').dataset.id; const t = S.todos.find(x => x.id === id);
  if (el.isContentEditable) return;
  el.innerHTML = todoHtml(t); el.contentEditable = 'true'; el.focus();
  document.getSelection().selectAllChildren(el); document.getSelection().collapseToEnd();
  const finish = save => {
    el.contentEditable = 'false'; el.onblur = el.onkeydown = null;
    const html = clean(el.innerHTML.trim()); const text = stripHtml(html).trim();
    if (save && text && html !== t.html) store.update('todos', id, { html, text }); else renderTodos();
  };
  el.onblur = () => finish(true);
  el.onkeydown = k => { if (k.key === 'Enter' && (k.ctrlKey || k.metaKey)) { k.preventDefault(); el.blur(); } if (k.key === 'Escape') finish(false); };
}
['#todoList', '#todoDoneList'].forEach(s => { $(s).addEventListener('click', todoClick); $(s).addEventListener('dblclick', todoEdit); });

/* ================= Suche / Shortcuts ================= */
$('#search').addEventListener('input', debounce(e => { S.q = e.target.value.trim(); renderList(); }, 120));
document.addEventListener('keydown', e => {
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
  if (e.key === 'Escape') {
    if (!$('#pop').classList.contains('hidden')) return hidePop();
    if (S.openId) { if (typing) document.activeElement.blur(); return closeTask(); }
    if (document.activeElement === $('#search')) { $('#search').value = ''; S.q = ''; renderList(); $('#search').blur(); }
    return;
  }
  if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === '/') { e.preventDefault(); $('#search').focus(); }
  else if (e.key.toLowerCase() === 'n' && !S.openId) { e.preventDefault(); newTask(); }
  else if (e.key.toLowerCase() === 't' && !S.openId) { e.preventDefault(); $('#todoInput').focus(); }
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
})();

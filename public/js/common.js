// Shared helpers for all pages
const LEVELS = [
  '1ère Année Primaire', '2ème Année Primaire', '3ème Année Primaire', '4ème Année Primaire', '5ème Année Primaire', '6ème Année Primaire',
  '1ère Année Collège', '2ème Année Collège', '3ème Année Collège',
  'Tronc Commun', '1ère Année Bac', '2ème Année Bac',
];
const SUBJECTS = [
  'Mathématiques', 'Physique-Chimie', 'SVT', 'Français', 'Arabe', 'Anglais', 'Philosophie',
  'Histoire-Géographie', 'Éducation Islamique', 'Informatique', 'Sciences de l\'Ingénieur', 'Économie', 'Amazigh', 'Éveil Scientifique',
];
const COLORS = ['#0f766e', '#2563eb', '#b45309', '#15803d', '#be123c', '#7c3aed', '#0891b2', '#c2410c', '#475569'];

const store = {
  get token() { try { return localStorage.getItem('madrasti_token'); } catch { return null; } },
  get user() { try { return JSON.parse(localStorage.getItem('madrasti_user') || 'null'); } catch { return null; } },
  save(token, user) { try { localStorage.setItem('madrasti_token', token); localStorage.setItem('madrasti_user', JSON.stringify(user)); } catch {} },
  setUser(user) { try { localStorage.setItem('madrasti_user', JSON.stringify(user)); } catch {} },
  clear() { try { localStorage.removeItem('madrasti_token'); localStorage.removeItem('madrasti_user'); } catch {} },
};

async function api(path, { method = 'GET', body, form } = {}) {
  const headers = {};
  if (store.token) headers.Authorization = 'Bearer ' + store.token;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  let res;
  try {
    res = await fetch('/api' + path, { method, headers, body: payload });
  } catch {
    throw new Error('Cannot reach the server. Is it running?');
  }
  let data = null;
  try { data = await res.json(); } catch {}
  if (res.status === 401 && !path.startsWith('/auth/')) {
    store.clear();
    location.href = '/auth?next=' + encodeURIComponent(location.pathname + location.hash);
    throw new Error('Please log in');
  }
  if (!res.ok) {
    const err = new Error((data && data.error) || 'Something went wrong');
    err.status = res.status;
    err.data = data || {};
    throw err;
  }
  return data;
}

// City → school picker (schools come from the database, grouped by city).
// cityEl and schoolEl are <select>; otherEl is a text input shown for "my school is not in the list".
let citiesPromise = null;
async function mountCitySchool({ cityEl, schoolEl, otherEl, city = '', school = '' }) {
  const OTHER = '__other__';
  if (!citiesPromise) citiesPromise = api('/cities').catch(() => { citiesPromise = null; return []; });
  const cities = await citiesPromise;
  const known = cities.some((c) => c.name === city);
  cityEl.innerHTML = `<option value="">Choose your city…</option>` +
    cities.map((c) => `<option value="${esc(c.name)}" ${c.name === city ? 'selected' : ''}>${esc(c.name)}${c.ar ? ' — ' + esc(c.ar) : ''}</option>`).join('') +
    (city && !known ? `<option value="${esc(city)}" selected>${esc(city)}</option>` : '');
  const showOther = (on) => { otherEl.classList.toggle('hidden', !on); if (!on) otherEl.value = ''; };
  async function loadSchools(selected) {
    const c = cityEl.value;
    if (!c) { schoolEl.innerHTML = '<option value="">Choose a city first</option>'; schoolEl.disabled = true; showOther(false); return; }
    schoolEl.disabled = true;
    schoolEl.innerHTML = '<option value="">Loading schools…</option>';
    let list = [];
    try { list = await api('/schools?city=' + encodeURIComponent(c)); } catch {}
    const inList = selected && list.includes(selected);
    schoolEl.innerHTML = `<option value="">${list.length ? `Choose your school (${list.length})…` : 'No school listed for this city'}</option>` +
      list.map((n) => `<option value="${esc(n)}" ${n === selected ? 'selected' : ''}>${esc(n)}</option>`).join('') +
      `<option value="${OTHER}" ${selected && !inList ? 'selected' : ''}>➕ My school is not in the list</option>`;
    schoolEl.disabled = false;
    showOther(Boolean(selected && !inList));
    if (selected && !inList) otherEl.value = selected;
  }
  cityEl.onchange = () => loadSchools('');
  schoolEl.onchange = () => { showOther(schoolEl.value === OTHER); if (schoolEl.value === OTHER) otherEl.focus(); };
  await loadSchools(school);
  // Returns the chosen values
  return () => ({ city: cityEl.value, school: schoolEl.value === OTHER ? otherEl.value.trim() : schoolEl.value });
}

// City + school fields for the profile pages
const placeFieldsHtml = () => `<div class="row">
  <div class="field"><label>City</label><select id="pCity"><option value="">Loading cities…</option></select></div>
  <div class="field"><label>School</label><select id="pSchool" disabled><option value="">Choose a city first</option></select>
    <input id="pOther" type="text" class="hidden" placeholder="Write the name of your school" style="margin-top:.5rem" maxlength="120"></div></div>`;
const mountPlaceFields = (root, user) => mountCitySchool({
  cityEl: root.querySelector('#pCity'), schoolEl: root.querySelector('#pSchool'), otherEl: root.querySelector('#pOther'),
  city: user.city || '', school: user.school || '',
});

// ---- formatting ----
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const initials = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-MA', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const fmtDateTime = (d) => d ? new Date(d).toLocaleString('fr-MA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
function timeAgo(d) {
  if (!d) return '—';
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + ' min ago';
  if (s < 86400) return Math.floor(s / 3600) + ' h ago';
  const days = Math.floor(s / 86400);
  return days === 1 ? 'yesterday' : days + ' days ago';
}
function dueLabel(d) {
  if (!d) return '';
  const diff = new Date(d).getTime() - Date.now();
  const days = Math.ceil(diff / 86400000);
  if (diff < 0) return `<span class="badge bad">Overdue</span>`;
  if (days <= 1) return `<span class="badge warn">Due ${diff < 86400000 / 2 ? 'today' : 'tomorrow'}</span>`;
  if (days <= 3) return `<span class="badge warn">Due in ${days} days</span>`;
  return `<span class="badge">Due ${fmtDate(d)}</span>`;
}
function gradeHtml(value, max = 20) {
  if (value === null || value === undefined) return '<span class="muted">—</span>';
  const r = value / max;
  const cls = r >= 0.6 ? 'good' : r >= 0.5 ? 'mid' : 'low';
  const v = Math.round(value * 10) / 10;
  return `<span class="grade ${cls}">${v}<span class="muted" style="font-weight:500">/${max}</span></span>`;
}
const toLocalInput = (d) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 16); };
const bar = (pct, color) => `<div class="progress"><span style="width:${Math.max(0, Math.min(100, pct || 0))}%;${color ? 'background:' + esc(color) : ''}"></span></div>`;
const options = (arr, selected) => arr.map((v) => `<option ${v === selected ? 'selected' : ''}>${esc(v)}</option>`).join('');
const filesHtml = (files) => (files && files.length) ? `<div class="files">${files.map((f) => `<a class="file-chip" href="${esc(f.path)}" target="_blank" rel="noopener">📎 ${esc(f.name)}</a>`).join('')}</div>` : '';

// Minimal safe formatter for lesson text: "## title", "- item", **bold**, paragraphs
function renderRich(text) {
  const lines = esc(text || '').split(/\r?\n/);
  let html = '', inList = false, para = [];
  const flush = () => { if (para.length) { html += `<p>${para.join('<br>')}</p>`; para = []; } };
  const closeList = () => { if (inList) { html += '</ul>'; inList = false; } };
  for (const raw of lines) {
    const line = raw.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    if (/^#{1,3}\s/.test(line)) { flush(); closeList(); html += `<h3>${line.replace(/^#{1,3}\s/, '')}</h3>`; }
    else if (/^[-•]\s/.test(line)) { flush(); if (!inList) { html += '<ul>'; inList = true; } html += `<li>${line.slice(2)}</li>`; }
    else if (!line.trim()) { flush(); closeList(); }
    else { closeList(); para.push(line); }
  }
  flush(); closeList();
  return html;
}

function videoEmbed(url) {
  if (!url) return '';
  const m = String(url).match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  if (m) return `<div class="video"><iframe src="https://www.youtube-nocookie.com/embed/${m[1]}" allowfullscreen title="Lesson video"></iframe></div>`;
  if (/^https?:\/\//.test(url)) return `<p><a class="btn secondary sm" href="${esc(url)}" target="_blank" rel="noopener">▶ Watch the video</a></p>`;
  return '';
}

// ---- UI: toast, modal, confirm ----
function toast(msg, type) {
  let box = document.getElementById('toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
  const t = document.createElement('div');
  t.className = 'toast' + (type === 'error' ? ' error' : '');
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function modal({ title, body, foot = '', wide = false, onOpen }) {
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">
    <div class="modal-head"><h2>${esc(title)}</h2><button type="button" data-close aria-label="Close">×</button></div>
    <div class="modal-body">${body}</div>${foot ? `<div class="modal-foot">${foot}</div>` : ''}</div>`;
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
  back.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  document.addEventListener('keydown', onKey);
  document.body.appendChild(back);
  const el = back.querySelector('.modal');
  if (onOpen) onOpen(el, close);
  const first = el.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]), textarea, select');
  if (first) first.focus();
  return { el, close };
}

function confirmBox(message, { okText = 'Delete', danger = true } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const { el, close } = modal({
      title: 'Please confirm',
      body: `<p>${esc(message)}</p>`,
      foot: `<button class="btn secondary" data-close>Cancel</button><button class="btn ${danger ? 'accent' : ''}" data-ok>${esc(okText)}</button>`,
    });
    el.querySelector('[data-ok]').addEventListener('click', () => { done = true; close(); resolve(true); });
    const obs = new MutationObserver(() => { if (!document.body.contains(el)) { obs.disconnect(); if (!done) resolve(false); } });
    obs.observe(document.body, { childList: true });
  });
}

// Disable a button while an async action runs; show errors as toast
async function busy(btn, fn) {
  if (btn) btn.disabled = true;
  try { return await fn(); }
  catch (e) { toast(e.message, 'error'); return undefined; }
  finally { if (btn) btn.disabled = false; }
}

// ---- App shell (sidebar + hash router) ----
function requireRole(role) {
  const u = store.user;
  if (!store.token || !u) { location.href = '/auth?next=' + encodeURIComponent(location.pathname + location.hash); return null; }
  if (u.role !== role) { location.href = u.role === 'teacher' ? '/teacher' : '/student'; return null; }
  return u;
}

function buildShell(user, navItems) {
  document.body.innerHTML = `
  <div class="app" id="app">
    <aside class="sidebar">
      <a class="brand" href="/"><div class="logo">م</div><div class="name">Madrasti<small>مدرستي</small></div></a>
      <nav class="nav" id="nav">${navItems.map((n) => n.sec
        ? `<div class="sec">${esc(n.sec)}</div>`
        : `<a href="#${n.id}" data-nav="${n.id}"><span class="i">${n.icon}</span>${esc(n.label)}<span class="count hidden" data-count="${n.id}"></span></a>`).join('')}
      </nav>
      <div class="me"><div class="avatar">${esc(initials(user.name))}</div>
        <div class="who"><b>${esc(user.name)}</b><span>${user.role === 'teacher' ? 'Teacher' : esc(user.level || 'Student')}</span></div>
        <button data-theme-toggle type="button">🌙</button>
        <button id="logout" title="Log out" aria-label="Log out">⎋</button></div>
    </aside>
    <div class="main">
      <div class="topbar"><button id="menuBtn" aria-label="Menu">☰</button><span class="t">Madrasti</span><button data-theme-toggle type="button">🌙</button></div>
      <main class="content" id="view"></main>
    </div>
  </div><div id="toasts"></div>`;
  if (window.MadrastiTheme) MadrastiTheme.refresh();
  document.getElementById('logout').onclick = () => { store.clear(); location.href = '/'; };
  const app = document.getElementById('app');
  document.getElementById('menuBtn').onclick = (e) => { e.stopPropagation(); app.classList.toggle('nav-open'); };
  app.addEventListener('click', (e) => { if (app.classList.contains('nav-open') && !e.target.closest('.sidebar')) app.classList.remove('nav-open'); });
}

function setCount(id, n) {
  const el = document.querySelector(`[data-count="${id}"]`);
  if (!el) return;
  el.textContent = n;
  el.classList.toggle('hidden', !n);
}

function startRouter(routes, fallback) {
  const view = () => document.getElementById('view');
  async function go() {
    const hash = location.hash.slice(1) || fallback;
    const [name, ...params] = hash.split('/');
    const handler = routes[name] || routes[fallback];
    document.querySelectorAll('[data-nav]').forEach((a) => {
      const nav = a.dataset.nav;
      a.classList.toggle('active', nav === name || (routes[name]?.parent === nav));
    });
    document.getElementById('app').classList.remove('nav-open');
    const v = view();
    v.innerHTML = '<div class="loader"></div>';
    window.scrollTo(0, 0);
    try { await handler(v, ...params); }
    catch (e) { v.innerHTML = `<div class="card empty"><div class="big">⚠️</div><p>${esc(e.message)}</p><a class="btn secondary" href="#${fallback}">Back to dashboard</a></div>`; }
  }
  window.addEventListener('hashchange', go);
  window.refresh = go;
  go();
}

// Read a form into an object
const formData = (form) => Object.fromEntries(new FormData(form).entries());

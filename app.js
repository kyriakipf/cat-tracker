/* Cat Tracker — Θωμάς, Σίσσυ & Φώτης */
(() => {
'use strict';

const CFG = window.CAT_CONFIG;
const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

const TABLES = ['cats', 'diets', 'meals', 'counters', 'events', 'meds', 'health'];
const S = {
  user: null, tab: 'today', loaded: false, loadError: null,
  cats: [], diets: [], meals: [], counters: [], events: [], meds: [], health: [],
  catId: null, histCat: 'all', histKind: 'all', histLimit: 150, healthCat: 'all',
};

/* ---------- constants ---------- */
const SLOTS = [
  { k: 'morning', ico: '🌅', name: 'Morning' },
  { k: 'midday', ico: '☀️', name: 'Midday', time: '13:30' },
  { k: 'evening', ico: '🌇', name: 'Evening', time: '19:30' },
  { k: 'night', ico: '🌙', name: 'Night' },
];
const SLOT = Object.fromEntries(SLOTS.map(s => [s.k, s]));
const AMT = {
  all: { t: 'Ate it all', short: 'All', ico: '😻', f: 1 },
  most: { t: 'Most of it', short: '¾', ico: '😺', f: .75 },
  half: { t: 'About half', short: '½', ico: '😼', f: .5 },
  little: { t: 'Just a little', short: '¼', ico: '😿', f: .25 },
  none: { t: 'Nothing', short: '0', ico: '🙀', f: 0 },
};
const LITTER = [
  ['Diarrhea', '💧'], ['Soft stool', '🟤'], ['Constipation', '🧱'], ['Straining', '😣'],
  ['Blood in stool/urine', '🩸'], ['Outside the box', '🚫'], ['Other', '❓'],
];
const HKIND = {
  vaccine: { t: 'Vaccines', one: 'Vaccine', ico: '💉', sugg: ['Tricat (core)', 'Rabies', 'FeLV'] },
  antiparasitic: { t: 'Antiparasitics', one: 'Antiparasitic', ico: '🐛', sugg: ['Flea & tick', 'Dewormer', 'Spot-on (all-in-one)'] },
  vet: { t: 'Vet visits', one: 'Vet visit', ico: '🩺', sugg: ['Check-up', 'Follow-up', 'Dental', 'Blood test'] },
};
const COLORS = ['#F2A65A', '#EE8FA9', '#7FB894', '#8FB3E8', '#B79CE0', '#E8C26A', '#E07E6E', '#6EC1C1'];

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const dayStr = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => dayStr();
const parseDay = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseDay(s); d.setDate(d.getDate() + n); return dayStr(d); };
const addMonths = (s, n) => { const d = parseDay(s); const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); return dayStr(d); };
const diffDays = (a, b) => Math.round((parseDay(b) - parseDay(a)) / 864e5);
const evDay = iso => dayStr(new Date(iso));
const fmtTime = iso => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const fmtDate = (s, year = true) => s ? parseDay(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}) }) : '';
const fmtDayLabel = s => {
  const t = today();
  if (s === t) return 'Today';
  if (s === addDays(t, -1)) return 'Yesterday';
  return parseDay(s).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
};
const toLocalInput = (iso = new Date().toISOString()) => { const d = new Date(iso); return `${dayStr(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const fromLocalInput = v => (v ? new Date(v) : new Date()).toISOString();
const num = v => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : null; };
const round = (n, p = 0) => { const f = 10 ** p; return Math.round(n * f) / f; };
const byId = (list, id) => list.find(x => x.id === id);
const cat = id => byId(S.cats, id);
const nowHM = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

function whoName(email) {
  if (!email) return '';
  if (S.user && email.toLowerCase() === S.user.email.toLowerCase()) return 'you';
  if (CFG.names && CFG.names[email]) return CFG.names[email];
  const w = email.split('@')[0].split(/[._\d-]/).filter(Boolean)[0] || email;
  return w.charAt(0).toUpperCase() + w.slice(1);
}
function avatar(c, size = '') {
  if (!c) return '';
  const inner = c.photo ? `<img src="${esc(c.photo)}" alt="">` : esc((c.name || '?').charAt(0));
  return `<div class="avatar ${size}" style="--c:${esc(c.color)}">${inner}</div>`;
}
function ageText(b) {
  if (!b) return '';
  const d = parseDay(b), n = new Date();
  let m = (n.getFullYear() - d.getFullYear()) * 12 + n.getMonth() - d.getMonth();
  if (n.getDate() < d.getDate()) m--;
  if (m < 0) return '';
  const y = Math.floor(m / 12); m %= 12;
  return y ? `${y} yr${y > 1 ? 's' : ''}${m ? ` ${m} mo` : ''}` : `${m} mo`;
}

/* ---------- data ---------- */
async function fetchAll(table, full = false) {
  let all = [];
  for (let from = 0; ; from += 1000) {
    let q = sb.from(table).select('*').order('id').range(from, from + 999);
    if (!full && table === 'meals') q = q.gte('day', addDays(today(), -120));
    if (!full && table === 'events') q = q.gte('at', new Date(Date.now() - 400 * 864e5).toISOString());
    const { data, error } = await q;
    if (error) throw error;
    all = all.concat(data);
    if (data.length < 1000) break;
  }
  return all;
}
function sortTable(t) {
  const L = S[t];
  if (t === 'cats') L.sort((a, b) => (a.sort - b.sort) || a.created_at.localeCompare(b.created_at));
  if (t === 'diets') L.sort((a, b) => a.from_date.localeCompare(b.from_date) || a.created_at.localeCompare(b.created_at));
  if (t === 'events') L.sort((a, b) => b.at.localeCompare(a.at));
  if (t === 'counters') L.sort((a, b) => (a.sort - b.sort) || a.created_at.localeCompare(b.created_at));
  if (t === 'health') L.sort((a, b) => b.on_date.localeCompare(a.on_date));
}
async function loadTable(t) { S[t] = await fetchAll(t); sortTable(t); }
async function loadAll() {
  try {
    await Promise.all(TABLES.map(loadTable));
    S.loaded = true; S.loadError = null;
  } catch (e) {
    console.error(e);
    S.loadError = e.message || String(e);
  }
  render();
}
const pending = {};
function scheduleReload(t) {
  if (!TABLES.includes(t)) return;
  clearTimeout(pending[t]);
  pending[t] = setTimeout(async () => { try { await loadTable(t); render(); } catch (e) { console.error(e); } }, 350);
}
let channel = null;
function subscribe() {
  if (channel) return;
  channel = sb.channel('cat-sync')
    .on('postgres_changes', { event: '*', schema: 'public' }, p => scheduleReload(p.table))
    .subscribe();
}

async function run(promise) {
  const { data, error } = await promise;
  if (error) {
    console.error(error);
    toast('⚠️ ' + (error.message || 'Could not save — check your connection'));
    throw error;
  }
  return data;
}
async function insert(t, row) {
  const data = await run(sb.from(t).insert(row).select().single());
  S[t] = S[t].filter(x => x.id !== data.id).concat(data); sortTable(t); render();
  return data;
}
async function update(t, id, patch) {
  const data = await run(sb.from(t).update(patch).eq('id', id).select().single());
  S[t] = S[t].map(x => x.id === id ? data : x); sortTable(t); render();
  return data;
}
async function remove(t, id) {
  await run(sb.from(t).delete().eq('id', id));
  S[t] = S[t].filter(x => x.id !== id); render();
}

/* ---------- derived ---------- */
function currentDiet(catId) {
  const ds = S.diets.filter(d => d.cat_id === catId);
  return ds[ds.length - 1] || null;
}
const mealFor = (catId, day, slot) => S.meals.find(m => m.cat_id === catId && m.day === day && m.slot === slot);
function dayIntake(catId, day) {
  const d = currentDiet(catId);
  const target = d ? Number(d.meal_g) * 4 : 0;
  let eaten = 0, served = 0;
  S.meals.filter(m => m.cat_id === catId && m.day === day).forEach(m => {
    const g = Number(m.served_g ?? (d ? d.meal_g : 0)) || 0;
    served += g; eaten += g * AMT[m.amount].f;
  });
  return { target, eaten: round(eaten), served: round(served) };
}
function slotState(catId, slot, day = today()) {
  const m = mealFor(catId, day, slot.k);
  if (m) return { m, cls: ['half', 'little', 'none'].includes(m.amount) ? 'done poor' : 'done' };
  if (slot.time && day === today() && nowHM() >= slot.time) return { cls: 'due' };
  return { cls: '' };
}
const evCount = (catId, pred, day = today()) => S.events.filter(e => e.cat_id === catId && evDay(e.at) === day && pred(e)).length;

function medActiveOn(m, day) { return m.active && m.start_date <= day && (!m.end_date || m.end_date >= day); }
function medDoses(catId, day = today()) {
  const out = [];
  S.meds.filter(m => m.cat_id === catId && medActiveOn(m, day)).forEach(m => {
    const given = S.events.filter(e => e.kind === 'med_given' && e.ref_id === m.id && evDay(e.at) === day);
    if (m.kind === 'as_needed') { out.push({ m, key: 'now', asNeeded: true, count: given.length }); return; }
    const keys = (m.times && m.times.length) ? [...m.times].sort() : ['day'];
    keys.forEach(k => out.push({ m, key: k, ev: given.find(e => e.label === k) }));
  });
  return out;
}

function healthAlerts(withinDays = 14) {
  const t = today(), latest = {};
  S.health.forEach(r => {
    const k = `${r.cat_id}|${r.kind}|${r.title.trim().toLowerCase()}`;
    if (!latest[k] || r.on_date > latest[k].on_date) latest[k] = r;
  });
  const out = [];
  Object.values(latest).forEach(r => {
    if (r.kind === 'vet' && r.on_date >= t) out.push({ r, date: r.on_date, diff: diffDays(t, r.on_date), appt: true });
    else if (r.next_due) out.push({ r, date: r.next_due, diff: diffDays(t, r.next_due) });
  });
  S.health.forEach(r => { // other future vet appointments that aren't the latest of their kind
    if (r.kind === 'vet' && r.on_date >= t && !out.some(o => o.r.id === r.id)) out.push({ r, date: r.on_date, diff: diffDays(t, r.on_date), appt: true });
  });
  return out.filter(a => a.diff <= withinDays).sort((a, b) => a.diff - b.diff);
}
const isLatestOfKind = r => !S.health.some(o => o.id !== r.id && o.cat_id === r.cat_id && o.kind === r.kind &&
  o.title.trim().toLowerCase() === r.title.trim().toLowerCase() && o.on_date > r.on_date);
function dueBadge(diff, appt) {
  if (appt) return `<span class="badge ${diff <= 2 ? 'soon' : 'plain'}">${diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : `in ${diff} days`}</span>`;
  if (diff < 0) return `<span class="badge over">${-diff} day${diff === -1 ? '' : 's'} overdue</span>`;
  if (diff === 0) return `<span class="badge over">Due today</span>`;
  if (diff <= 14) return `<span class="badge soon">Due in ${diff} day${diff === 1 ? '' : 's'}</span>`;
  return `<span class="badge ok">Next ${esc(fmtDate(addDays(today(), diff)))}</span>`;
}
function calUrl(title, day, details) {
  const s = day.replaceAll('-', ''), e = addDays(day, 1).replaceAll('-', '');
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${s}/${e}&details=${encodeURIComponent(details || '')}`;
}
function healthCal(r) {
  const c = cat(r.cat_id), t = today();
  const appt = r.kind === 'vet' && r.on_date >= t;
  const day = appt ? r.on_date : r.next_due;
  if (!day) return null;
  const title = appt ? `🐱 ${c?.name} – vet: ${r.title}` : `🐱 ${c?.name} – ${r.title} due`;
  return calUrl(title, day, `${HKIND[r.kind].one} for ${c?.name}${r.notes ? '\n' + r.notes : ''}\n(from Cat Tracker)`);
}

/* ---------- UI plumbing ---------- */
let toastTimer;
function toast(msg, actions = [], ms = 4500) {
  const el = $('#toast');
  el.innerHTML = `<span>${esc(msg)}</span>` + actions.map((a, i) => `<button data-i="${i}">${esc(a.t)}</button>`).join('');
  el.hidden = false;
  el.querySelectorAll('button').forEach(b => b.onclick = () => { el.hidden = true; actions[b.dataset.i].fn(); });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}
let sheetOpen = false;
function openSheet(html, mount) {
  const wrap = $('#sheet-wrap'), sh = $('#sheet');
  sh.innerHTML = html;
  if (!sheetOpen) { history.pushState({ sheet: 1 }, ''); sheetOpen = true; wrap.hidden = false; }
  sh.scrollTop = 0;
  if (mount) mount(sh);
}
function hideSheet() { sheetOpen = false; $('#sheet-wrap').hidden = true; $('#sheet').innerHTML = ''; }
function closeSheet() {
  if (!sheetOpen) return;
  if (history.state && history.state.sheet) history.back(); else hideSheet();
}
window.addEventListener('popstate', () => {
  if (sheetOpen) { hideSheet(); return; }
  if (S.catId) { S.catId = null; render(); }
});
$('#sheet-backdrop').addEventListener('click', closeSheet);
function confirmSheet(title, text, okText, fn) {
  openSheet(`<h2>${esc(title)}</h2><p class="sheet-sub">${esc(text)}</p>
    <div class="btn-row"><button class="btn soft" data-act="close">Cancel</button><button class="btn danger" id="cf-ok">${esc(okText)}</button></div>`,
  sh => { $('#cf-ok', sh).onclick = async () => { await fn(); closeSheet(); }; });
}
const busy = async (btn, fn) => { if (btn.disabled) return; btn.disabled = true; try { await fn(); } catch (e) { /* toast shown */ } finally { btn.disabled = false; } };

/* ---------- rendering ---------- */
function render() {
  const app = $('#app'), tabs = $('#tabs');
  if (!S.user) { tabs.hidden = true; app.innerHTML = loginView(); mountLogin(); return; }
  tabs.hidden = false;
  tabs.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.tab === S.tab));
  if (!S.loaded) {
    app.innerHTML = S.loadError ? errorView() : `<div class="boot"><div class="boot-paw">🐾</div></div>`;
    return;
  }
  const views = { today: todayView, health: healthView, history: historyView, cats: catsView };
  app.innerHTML = (S.loadError ? `<div class="banner">⚠️ Couldn't refresh: ${esc(S.loadError)} <button class="link" data-act="retry">Retry</button></div>` : '') + views[S.tab]();
}
function errorView() {
  return `<div class="login"><div class="logo">😿</div><h1>Can't reach the database</h1>
    <p class="muted">${esc(S.loadError)}</p>
    <p class="muted small">If nobody opened the app for a week, the free database may be paused: open supabase.com → your project → <b>Restore</b>.</p>
    <button class="btn" data-act="retry">Try again</button></div>`;
}

/* Login */
function loginView() {
  return `<div class="login"><div class="logo">🐾</div><h1>Cat Tracker</h1><div class="muted">Θωμάς · Σίσσυ · Φώτης</div>
  <form id="login-form">
    <label class="f"><span>Email</span><input class="inp" type="email" id="lg-email" autocomplete="email" required></label>
    <label class="f"><span>Password</span><input class="inp" type="password" id="lg-pass" autocomplete="current-password" required></label>
    <button class="btn full" type="submit" id="lg-btn">Sign in</button>
    <div class="err" id="lg-err"></div>
    <p style="text-align:center"><button type="button" class="link" id="lg-forgot">Forgot password?</button></p>
  </form></div>`;
}
function mountLogin() {
  $('#login-form').onsubmit = async e => {
    e.preventDefault();
    const btn = $('#lg-btn'); btn.disabled = true; $('#lg-err').textContent = '';
    const { error } = await sb.auth.signInWithPassword({ email: $('#lg-email').value.trim(), password: $('#lg-pass').value });
    btn.disabled = false;
    if (error) $('#lg-err').textContent = error.message === 'Invalid login credentials' ? 'Wrong email or password.' : error.message;
  };
  $('#lg-forgot').onclick = async () => {
    const email = $('#lg-email').value.trim();
    if (!email) { $('#lg-err').textContent = 'Type your email first.'; return; }
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    $('#lg-err').textContent = error ? error.message : 'Check your email for a reset link.';
  };
}

/* Today */
function todayView() {
  const d = new Date();
  if (!S.cats.length) return `<div class="top"><h1>Today</h1></div><div class="card empty">No cats yet. Add them in the Cats tab.</div>`;
  let sel = S.todayCat && cat(S.todayCat) ? S.todayCat : null;
  if (!sel) { try { sel = localStorage.getItem('todayCat'); } catch (e) {} }
  if (!sel || !cat(sel)) sel = S.cats[0].id;
  S.todayCat = sel;
  const alerts = healthAlerts(14);
  const needs = id => alerts.some(a => a.r.cat_id === id && (a.appt ? a.diff <= 1 : a.diff <= 7)) ||
    SLOTS.some(s => slotState(id, s).cls === 'due') || medDoses(id).some(x => !x.asNeeded && !x.ev);
  let html = `<div class="today-top"><h1>Today</h1><span class="sub">${esc(d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }))}</span></div>`;
  html += `<div class="cat-tabs">` + S.cats.map(c => `<button class="cat-tab ${c.id === sel ? 'sel' : ''}" style="--c:${esc(c.color)}" data-act="today-cat" data-cat="${c.id}">
    ${avatar(c, 'sm')}<span>${esc(c.name)}</span>${needs(c.id) ? '<i class="dot"></i>' : ''}</button>`).join('') + `</div>`;
  const mine = alerts.filter(a => a.r.cat_id === sel);
  if (mine.length) {
    const a = mine[0], bad = !a.appt && a.diff <= 0;
    html += `<button class="alert-strip ${bad ? 'bad' : ''}" data-act="tab" data-tab="health">${HKIND[a.r.kind].ico} <span class="grow">${esc(a.r.title)}</span>${dueBadge(a.diff, a.appt)}${mine.length > 1 ? `<span class="more">+${mine.length - 1}</span>` : ''}</button>`;
  }
  html += `<div id="today-swipe">${catCard(cat(sel))}</div>`;
  return html;
}
function catCard(c) {
  const diet = currentDiet(c.id), t = today();
  const intake = dayIntake(c.id, t);
  const pct = intake.target ? Math.min(100, intake.eaten / intake.target * 100) : 0;
  const meals = SLOTS.map(s => {
    const st = slotState(c.id, s);
    const label = st.m ? fmtTime(st.m.at) : (s.time || s.name);
    const val = st.m ? `${AMT[st.m.amount].short}${st.m.served_g != null ? ` · ${round(Number(st.m.served_g))}g` : ''}` : (st.cls === 'due' ? 'Due' : '—');
    return `<button class="meal ${st.cls}" data-act="meal" data-cat="${c.id}" data-slot="${s.k}">
      <span class="m-ico">${st.m ? AMT[st.m.amount].ico : s.ico}</span><span class="m-t">${esc(label)}</span><span class="m-v">${esc(val)}</span></button>`;
  }).join('');
  const doses = medDoses(c.id);
  const medChips = doses.map(d => {
    if (d.asNeeded) return `<button class="chip" data-act="med" data-med="${d.m.id}" data-key="now">💊 ${esc(d.m.name)}${d.count ? ` <span class="n">${d.count}</span>` : ' +'}</button>`;
    const when = d.key === 'day' ? '' : ` ${esc(d.key)}`;
    return `<button class="chip ${d.ev ? 'med-done' : 'med-due'}" data-act="med" data-med="${d.m.id}" data-key="${esc(d.key)}">💊 ${esc(d.m.name)}${when} ${d.ev ? '✓' : ''}</button>`;
  }).join('');
  const counters = S.counters.filter(k => k.cat_id === c.id).map(k => {
    const n = evCount(c.id, e => e.kind === 'counter' && e.ref_id === k.id);
    return `<button class="chip counter" data-act="count" data-id="${k.id}">${esc(k.emoji || '⭐')} ${esc(k.label)}${n ? ` <span class="n">${n}</span>` : ''}</button>`;
  }).join('');
  const nV = evCount(c.id, e => e.kind === 'vomit'), nL = evCount(c.id, e => e.kind === 'litter'), nB = evCount(c.id, e => e.kind === 'behavior');
  const n = x => x ? ` <span class="n">${x}</span>` : '';
  return `<div class="card cat-card" style="--c:${esc(c.color)}">
    <div class="cat-head"><div class="grow">
      <div class="cat-food">${diet && Number(diet.meal_g) ? `${esc(diet.food)} · ${round(Number(diet.meal_g), 1)} g × 4` : `<span class="link" data-act="diet" data-cat="${c.id}">Set food & grams →</span>`}</div></div>
      <button class="icon-btn" data-act="open-cat" data-cat="${c.id}" aria-label="Open ${esc(c.name)}">›</button></div>
    ${intake.target ? `<div class="progress"><div class="bar"><div class="fill" style="width:${pct}%"></div></div>
      <div class="lbl"><span>Eaten ~${intake.eaten} g</span><span>of ${round(intake.target)} g</span></div></div>` : ''}
    <div class="meals">${meals}</div>
    ${medChips ? `<div class="section-lbl">Medication</div><div class="chips">${medChips}</div>` : ''}
    <div class="section-lbl">Quick log</div>
    <div class="chips">${counters}
      <button class="chip counter" data-act="vomit" data-cat="${c.id}">🤮 Puked${n(nV)}</button>
      <button class="chip counter" data-act="litter" data-cat="${c.id}">💩 Litter${n(nL)}</button>
      <button class="chip counter" data-act="weight" data-cat="${c.id}">⚖️ Weight</button>
      <button class="chip counter" data-act="behavior" data-cat="${c.id}">📝 Other${n(nB)}</button>
      <button class="chip ghost" data-act="add-counter" data-cat="${c.id}">＋ Button</button>
    </div></div>`;
}

/* Health */
function healthView() {
  const f = S.healthCat;
  let html = `<div class="top"><div><h1>Health</h1><div class="sub">Vaccines, antiparasitics & vet</div></div></div>`;
  html += catFilter('health-cat', f);
  const alerts = healthAlerts(30).filter(a => f === 'all' || a.r.cat_id === f);
  if (alerts.length) {
    html += `<div class="section-lbl">Coming up (30 days)</div><div class="card">` + alerts.map(a => {
      const u = healthCal(a.r);
      return `<div class="row">${avatar(cat(a.r.cat_id), 'sm')}<div class="grow" data-act="health-view" data-id="${a.r.id}"><div class="r-t">${esc(a.r.title)}</div>
        <div class="r-s">${esc(cat(a.r.cat_id)?.name)} · ${a.appt ? 'Appointment' : 'Due'} ${esc(fmtDate(a.date, false))}</div></div>
        ${dueBadge(a.diff, a.appt)}${u ? `<a class="icon-btn" href="${esc(u)}" target="_blank" rel="noopener" aria-label="Add to calendar">📅</a>` : ''}</div>`;
    }).join('') + `</div>`;
  }
  Object.entries(HKIND).forEach(([k, K]) => {
    const recs = S.health.filter(r => r.kind === k && (f === 'all' || r.cat_id === f));
    html += `<div class="section-lbl">${K.ico} ${K.t}</div><div class="card">`;
    if (!recs.length) html += `<div class="empty small">Nothing logged yet</div>`;
    recs.forEach(r => {
      const t = today(), future = r.on_date > t;
      let badge = '';
      if (k === 'vet' && r.on_date >= t) badge = dueBadge(diffDays(t, r.on_date), true);
      else if (r.next_due && isLatestOfKind(r)) badge = dueBadge(diffDays(t, r.next_due));
      html += `<div class="row" data-act="health-view" data-id="${r.id}">${f === 'all' ? avatar(cat(r.cat_id), 'sm') : `<div class="r-ico">${K.ico}</div>`}
        <div class="grow"><div class="r-t">${esc(r.title)}</div><div class="r-s">${f === 'all' ? esc(cat(r.cat_id)?.name) + ' · ' : ''}${future ? 'Booked' : k === 'vet' ? 'Visit' : 'Given'} ${esc(fmtDate(r.on_date))}</div></div>${badge}</div>`;
    });
    html += `</div>`;
  });
  html += `<button class="fab" data-act="health-add" aria-label="Add">＋</button>`;
  return html;
}
function catFilter(act, sel) {
  return `<div class="filters"><button class="chip ${sel === 'all' ? 'sel' : ''}" data-act="${act}" data-cat="all">All cats</button>` +
    S.cats.map(c => `<button class="chip ${sel === c.id ? 'sel' : ''}" data-act="${act}" data-cat="${c.id}">${avatar(c, 'sm')} ${esc(c.name)}</button>`).join('') + `</div>`;
}

/* History */
const HFILTERS = [['all', 'Everything'], ['meals', '🍽 Meals'], ['behavior', '⭐ Behaviour'], ['vomit', '🤮 Puke'], ['litter', '💩 Litter'], ['weight', '⚖️ Weight'], ['meds', '💊 Meds']];
function historyItems() {
  const fc = S.histCat, fk = S.histKind, items = [];
  if (fk === 'all' || fk === 'meals') S.meals.forEach(m => {
    if (fc !== 'all' && m.cat_id !== fc) return;
    items.push({ type: 'meal', at: m.at, day: m.day, obj: m });
  });
  S.events.forEach(e => {
    if (fc !== 'all' && e.cat_id !== fc) return;
    const map = { counter: 'behavior', behavior: 'behavior', vomit: 'vomit', litter: 'litter', weight: 'weight', med_given: 'meds' };
    if (fk !== 'all' && map[e.kind] !== fk) return;
    items.push({ type: 'ev', at: e.at, day: evDay(e.at), obj: e });
  });
  return items.sort((a, b) => b.day.localeCompare(a.day) || b.at.localeCompare(a.at));
}
function evDisplay(e) {
  const k = e.kind;
  if (k === 'counter') { const c = byId(S.counters, e.ref_id); return { ico: c?.emoji || '⭐', t: e.label || c?.label || 'Counter', s: e.note }; }
  if (k === 'behavior') return { ico: '📝', t: 'Behaviour', s: e.note };
  if (k === 'vomit') return { ico: '🤮', t: 'Puked', s: e.note };
  if (k === 'litter') return { ico: '💩', t: e.label || 'Litter issue', s: e.note };
  if (k === 'weight') return { ico: '⚖️', t: `${round(Number(e.value), 2)} kg`, s: e.note };
  if (k === 'med_given') return { ico: '💊', t: `${e.label === 'now' ? '' : ''}${e.note || 'Medication'} given`, s: e.label && !['day', 'now'].includes(e.label) ? `${e.label} dose` : '' };
  return { ico: '•', t: k, s: e.note };
}
function historyView() {
  let html = `<div class="top"><div><h1>History</h1><div class="sub">Everything that happened</div></div></div>`;
  html += catFilter('hist-cat', S.histCat);
  html += `<div class="filters">` + HFILTERS.map(([k, t]) => `<button class="chip ${S.histKind === k ? 'sel' : ''}" data-act="hist-kind" data-k="${k}">${t}</button>`).join('') + `</div>`;
  const items = historyItems();
  if (!items.length) return html + `<div class="card empty">Nothing logged yet 🐾</div>`;
  let lastDay = null, open = false;
  items.slice(0, S.histLimit).forEach(it => {
    if (it.day !== lastDay) { if (open) html += `</div>`; html += `<div class="day-lbl">${esc(fmtDayLabel(it.day))}</div><div class="card">`; open = true; lastDay = it.day; }
    let d, c;
    if (it.type === 'meal') {
      const m = it.obj; c = cat(m.cat_id);
      d = { ico: AMT[m.amount].ico, t: `${SLOT[m.slot].name} meal · ${AMT[m.amount].t}`, s: [m.food, m.served_g != null ? `${round(Number(m.served_g))} g` : ''].filter(Boolean).join(' · ') };
      html += `<div class="row" data-act="meal" data-cat="${m.cat_id}" data-slot="${m.slot}" data-day="${m.day}">`;
      d.by = m.by_email;
    } else {
      const e = it.obj; c = cat(e.cat_id); d = evDisplay(e); d.by = e.by_email;
      html += `<div class="row" data-act="ev-edit" data-id="${e.id}">`;
    }
    html += `<div class="r-ico" style="background:color-mix(in srgb, ${esc(c?.color || '#ccc')} 20%, white)">${d.ico}</div>
      <div class="grow"><div class="r-t">${S.histCat === 'all' ? `${esc(c?.name)} · ` : ''}${esc(d.t)}</div>${d.s ? `<div class="r-s">${esc(d.s)}</div>` : ''}</div>
      <div class="r-time">${esc(fmtTime(it.at))}${d.by ? `<br>${esc(whoName(d.by))}` : ''}</div></div>`;
  });
  if (open) html += `</div>`;
  if (items.length > S.histLimit) html += `<div style="text-align:center;margin:10px"><button class="btn soft" data-act="hist-more">Show more</button></div>`;
  return html;
}

/* Cats */
function catsView() {
  if (S.catId && cat(S.catId)) return catDetail(cat(S.catId));
  S.catId = null;
  let html = `<div class="top"><div><h1>Cats</h1><div class="sub">Profiles, food & medication</div></div></div>`;
  S.cats.forEach(c => {
    const d = currentDiet(c.id);
    html += `<div class="card cat-card" style="--c:${esc(c.color)}" data-act="open-cat" data-cat="${c.id}"><div class="cat-head">${avatar(c)}
      <div class="grow"><div class="cat-name">${esc(c.name)}</div><div class="cat-food">${[ageText(c.birthday), d ? `${d.food} · ${round(Number(d.meal_g), 1)} g × 4` : 'No food set'].filter(Boolean).map(esc).join(' · ')}</div></div>
      <span class="muted" style="font-size:22px">›</span></div></div>`;
  });
  html += `<button class="btn soft full" data-act="cat-add">＋ Add a cat</button>`;
  html += `<div class="section-lbl" style="margin-top:22px">Your data</div><div class="card">
    <div class="row" data-act="export"><div class="r-ico">📦</div><div class="grow"><div class="r-t">Backup everything</div><div class="r-s">Download a spreadsheet with all records</div></div></div>
    <div class="row" data-act="signout"><div class="r-ico">👋</div><div class="grow"><div class="r-t">Sign out</div><div class="r-s">${esc(S.user.email)}</div></div></div></div>`;
  return html;
}
function catDetail(c) {
  const diet = currentDiet(c.id);
  const diets = S.diets.filter(d => d.cat_id === c.id).reverse();
  const weights = S.events.filter(e => e.cat_id === c.id && e.kind === 'weight').slice().reverse();
  const counters = S.counters.filter(k => k.cat_id === c.id);
  const meds = S.meds.filter(m => m.cat_id === c.id);
  const t = today();
  const activeMeds = meds.filter(m => m.active && (!m.end_date || m.end_date >= t));
  const pastMeds = meds.filter(m => !activeMeds.includes(m));

  let html = `<div class="top"><button class="icon-btn" data-act="back" aria-label="Back">‹</button><div></div><button class="icon-btn" data-act="cat-edit" data-cat="${c.id}" aria-label="Edit">✏️</button></div>`;
  html += `<div class="card cat-card" style="--c:${esc(c.color)}"><div class="profile-head">${avatar(c, 'lg')}<div><h1 style="font-size:28px">${esc(c.name)}</h1>
    <div class="muted" style="font-weight:700">${esc([ageText(c.birthday), weights.length ? `${round(Number(weights[weights.length - 1].value), 2)} kg` : ''].filter(Boolean).join(' · '))}</div></div></div>
    ${(c.birthday || c.microchip || c.vet || c.notes) ? `<dl class="kv" style="margin-top:14px">
      ${c.birthday ? `<dt>Birthday</dt><dd>${esc(fmtDate(c.birthday))}</dd>` : ''}
      ${c.microchip ? `<dt>Microchip</dt><dd>${esc(c.microchip)}</dd>` : ''}
      ${c.vet ? `<dt>Vet</dt><dd>${esc(c.vet)}</dd>` : ''}
      ${c.notes ? `<dt>Notes</dt><dd>${esc(c.notes)}</dd>` : ''}</dl>` : ''}</div>`;

  // Food
  html += `<div class="section-lbl">🍽 Food</div><div class="card">
    ${diet ? `<div class="r-t" style="font-size:18px">${esc(diet.food)}</div><div class="muted" style="font-weight:700">${round(Number(diet.meal_g), 1)} g per meal × 4 = ${round(Number(diet.meal_g) * 4)} g a day · since ${esc(fmtDate(diet.from_date))}</div>` : `<div class="muted">No food set yet</div>`}
    <div class="btn-row"><button class="btn soft" data-act="diet" data-cat="${c.id}">${diet ? 'Change food / grams' : 'Set food'}</button></div>
    ${diets.length > 1 ? `<div class="section-lbl">Food history</div>` + diets.slice(1).map(d => `<div class="row"><div class="grow"><div class="r-t">${esc(d.food)}</div><div class="r-s">${round(Number(d.meal_g), 1)} g × 4</div></div><div class="r-time">from ${esc(fmtDate(d.from_date))}</div></div>`).join('') : ''}
  </div>`;

  // Medication
  html += `<div class="section-lbl">💊 Medication</div><div class="card">`;
  if (!activeMeds.length) html += `<div class="empty small">No current medication</div>`;
  activeMeds.forEach(m => { html += medRow(m); });
  html += `<div class="btn-row"><button class="btn soft" data-act="med-edit" data-cat="${c.id}">＋ Add medication</button></div>`;
  if (pastMeds.length) html += `<details style="margin-top:10px"><summary class="muted small" style="font-weight:800">Past medication (${pastMeds.length})</summary>${pastMeds.map(medRow).join('')}</details>`;
  html += `</div>`;

  // Weight
  html += `<div class="section-lbl">⚖️ Weight</div><div class="card">${weightChart(weights, c.color)}
    <div class="btn-row"><button class="btn soft" data-act="weight" data-cat="${c.id}">Log weight</button></div></div>`;

  // Quick buttons + trends
  html += `<div class="section-lbl">⭐ Quick buttons & last 14 days</div><div class="card" style="--c:${esc(c.color)}">`;
  counters.forEach(k => {
    html += `<div class="row"><div class="r-ico">${esc(k.emoji || '⭐')}</div><div class="grow"><div class="r-t">${esc(k.label)}</div>${bars(c.id, e => e.kind === 'counter' && e.ref_id === k.id)}</div>
      <button class="icon-btn" data-act="counter-del" data-id="${k.id}" aria-label="Remove button">🗑</button></div>`;
  });
  [['🤮', 'Puked', e => e.kind === 'vomit'], ['💩', 'Litter issues', e => e.kind === 'litter'], ['📝', 'Other behaviour', e => e.kind === 'behavior']].forEach(([ico, lbl, p]) => {
    if (S.events.some(e => e.cat_id === c.id && p(e) && diffDays(evDay(e.at), t) < 14))
      html += `<div class="row"><div class="r-ico">${ico}</div><div class="grow"><div class="r-t">${lbl}</div>${bars(c.id, p)}</div></div>`;
  });
  html += `<div class="btn-row"><button class="btn soft" data-act="add-counter" data-cat="${c.id}">＋ Add quick button</button></div></div>`;

  html += `<div class="btn-row"><button class="btn soft" data-act="cat-health" data-cat="${c.id}">💉 Health records</button><button class="btn soft" data-act="cat-history" data-cat="${c.id}">📖 History</button></div>`;
  return html;
}
function medRow(m) {
  const kind = m.kind === 'as_needed' ? 'As needed' : m.kind === 'course' ? 'Course' : 'Daily';
  const times = m.times && m.times.length ? m.times.join(', ') : '';
  const range = `${fmtDate(m.start_date, false)}${m.end_date ? ` → ${fmtDate(m.end_date, false)}` : ' → ongoing'}`;
  return `<div class="row" data-act="med-edit" data-id="${m.id}"><div class="r-ico">💊</div><div class="grow"><div class="r-t">${esc(m.name)}${m.dose ? ` · ${esc(m.dose)}` : ''}</div>
    <div class="r-s">${esc([kind, times, range].filter(Boolean).join(' · '))}</div></div></div>`;
}
function bars(catId, pred) {
  const t = today(), counts = [];
  for (let i = 13; i >= 0; i--) { const d = addDays(t, -i); counts.push(evCount(catId, pred, d)); }
  const max = Math.max(1, ...counts), total = counts.reduce((a, b) => a + b, 0);
  return `<div class="bars">${counts.map(n => `<div style="height:${n ? Math.max(8, n / max * 100) : 3}%" title="${n}"></div>`).join('')}</div>
    <div class="bars-lbl"><span>2 weeks ago</span><span>${total} total · today ${counts[13]}</span></div>`;
}
function weightChart(ws, color) {
  if (!ws.length) return `<div class="empty small">No weights yet</div>`;
  const last = ws[ws.length - 1], first = ws[0];
  const change = ws.length > 1 ? round(Number(last.value) - Number(first.value), 2) : 0;
  let svg = '';
  if (ws.length > 1) {
    const W = 320, H = 110, P = 10;
    const xs = ws.map(w => new Date(w.at).getTime()), ys = ws.map(w => Number(w.value));
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys) - .1, y1 = Math.max(...ys) + .1;
    const X = x => P + (x1 === x0 ? .5 : (x - x0) / (x1 - x0)) * (W - 2 * P), Y = y => H - P - (y - y0) / (y1 - y0) * (H - 2 * P);
    const pts = ws.map((w, i) => `${X(xs[i]).toFixed(1)},${Y(ys[i]).toFixed(1)}`).join(' ');
    svg = `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="${esc(color)}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
      ${ws.map((w, i) => `<circle cx="${X(xs[i]).toFixed(1)}" cy="${Y(ys[i]).toFixed(1)}" r="3.5" fill="#fff" stroke="${esc(color)}" stroke-width="2" vector-effect="non-scaling-stroke"/>`).join('')}</svg>
      <div class="bars-lbl"><span>${esc(fmtDate(evDay(first.at), false))}</span><span>${esc(fmtDate(evDay(last.at), false))}</span></div>`;
  }
  return `<div style="display:flex;align-items:baseline;gap:10px"><div style="font-size:26px;font-weight:800">${round(Number(last.value), 2)} kg</div>
    <div class="muted small" style="font-weight:700">${esc(fmtDate(evDay(last.at)))}${ws.length > 1 ? ` · ${change > 0 ? '+' : ''}${change} kg since ${esc(fmtDate(evDay(first.at), false))}` : ''}</div></div>${svg}`;
}

/* ---------- sheets ---------- */
function mealSheet(catId, slotK, day = today()) {
  const c = cat(catId), s = SLOT[slotK], m = mealFor(catId, day, slotK), diet = currentDiet(catId);
  const defTime = m ? toLocalInput(m.at) : (day === today() ? toLocalInput() : `${day}T${s.time || (slotK === 'morning' ? '08:00' : '23:00')}`);
  openSheet(`<h2>${esc(c.name)} · ${s.ico} ${s.name}${s.time ? ` ${s.time}` : ''}</h2>
    <div class="sheet-sub">${day === today() ? 'Today' : esc(fmtDayLabel(day))}${m ? ` · logged by ${esc(whoName(m.by_email))} at ${esc(fmtTime(m.at))}` : ''}</div>
    <div class="big-opts">${Object.entries(AMT).map(([k, a]) => `<button class="big-opt ${m && m.amount === k ? 'sel' : ''}" data-amt="${k}"><span class="bo-ico">${a.ico}</span>${a.t}</button>`).join('')}</div>
    <details ${!diet || !Number(diet.meal_g) ? 'open' : ''}><summary class="muted small" style="font-weight:800;margin:8px 2px">Food, grams & time: ${esc(m?.food || diet?.food || 'not set')} · ${esc(m?.served_g ?? diet?.meal_g ?? '?')} g</summary>
      <label class="f"><span>Food</span><input class="inp" id="ml-food" value="${esc(m?.food ?? diet?.food ?? '')}"></label>
      <div class="two"><label class="f"><span>Served (g)</span><input class="inp" id="ml-g" inputmode="decimal" value="${esc(m?.served_g ?? diet?.meal_g ?? '')}"></label>
      <label class="f"><span>Time</span><input class="inp" type="datetime-local" id="ml-at" value="${esc(defTime)}"></label></div></details>
    ${m ? `<div class="btn-row"><button class="btn danger" id="ml-del">Clear this meal</button></div>` : ''}`,
  sh => {
    sh.querySelectorAll('[data-amt]').forEach(b => b.onclick = () => busy(b, async () => {
      const row = { cat_id: catId, day, slot: slotK, amount: b.dataset.amt, food: $('#ml-food', sh).value.trim() || null, served_g: num($('#ml-g', sh).value), at: fromLocalInput($('#ml-at', sh).value), by_email: m ? m.by_email : S.user.email };
      const data = await run(sb.from('meals').upsert(row, { onConflict: 'cat_id,day,slot' }).select().single());
      S.meals = S.meals.filter(x => x.id !== data.id && !(x.cat_id === catId && x.day === day && x.slot === slotK)).concat(data);
      closeSheet(); render();
      toast(`${AMT[b.dataset.amt].ico} ${c.name}: ${AMT[b.dataset.amt].t.toLowerCase()}`);
    }));
    const del = $('#ml-del', sh);
    if (del) del.onclick = () => busy(del, async () => { await remove('meals', m.id); closeSheet(); });
  });
}

async function logEvent(row, msg) {
  const ev = await insert('events', row);
  toast(msg, [{ t: 'Undo', fn: () => remove('events', ev.id) }, { t: 'Details', fn: () => eventSheet(ev.id) }]);
  return ev;
}
function eventSheet(id) {
  const e = byId(S.events, id); if (!e) return;
  const c = cat(e.cat_id), d = evDisplay(e);
  const isLitter = e.kind === 'litter', isWeight = e.kind === 'weight';
  openSheet(`<h2>${d.ico} ${esc(c?.name)} · ${esc(d.t)}</h2>
    <div class="sheet-sub">${esc(fmtDayLabel(evDay(e.at)))} at ${esc(fmtTime(e.at))}${e.by_email ? ` · by ${esc(whoName(e.by_email))}` : ''}</div>
    ${isLitter ? `<div class="chips" id="ev-lt">${LITTER.map(([l, i]) => `<button class="chip ${e.label === l ? 'sel' : ''}" data-l="${esc(l)}">${i} ${esc(l)}</button>`).join('')}</div>` : ''}
    ${isWeight ? `<label class="f"><span>Weight (kg)</span><input class="inp" id="ev-val" inputmode="decimal" value="${esc(e.value)}"></label>` : ''}
    <label class="f"><span>Note</span><textarea class="inp" id="ev-note" placeholder="Anything worth remembering…">${esc(e.kind === 'med_given' ? '' : e.note || '')}</textarea></label>
    <label class="f"><span>When</span><input class="inp" type="datetime-local" id="ev-at" value="${esc(toLocalInput(e.at))}"></label>
    <div class="btn-row"><button class="btn danger" id="ev-del">Delete</button><button class="btn" id="ev-save">Save</button></div>`,
  sh => {
    let label = e.label;
    if (isLitter) sh.querySelectorAll('#ev-lt [data-l]').forEach(b => b.onclick = () => { label = b.dataset.l; sh.querySelectorAll('#ev-lt .chip').forEach(x => x.classList.toggle('sel', x === b)); });
    if (e.kind === 'med_given') $('#ev-note', sh).closest('label').hidden = true;
    $('#ev-save', sh).onclick = e2 => busy(e2.currentTarget, async () => {
      const patch = { at: fromLocalInput($('#ev-at', sh).value) };
      if (e.kind !== 'med_given') patch.note = $('#ev-note', sh).value.trim() || null;
      if (isLitter) patch.label = label;
      if (isWeight) { const v = num($('#ev-val', sh).value); if (v == null) { toast('Enter a weight'); return; } patch.value = v; }
      await update('events', e.id, patch); closeSheet();
    });
    $('#ev-del', sh).onclick = e2 => busy(e2.currentTarget, async () => { await remove('events', e.id); closeSheet(); toast('Deleted'); });
  });
}
function litterSheet(catId) {
  const c = cat(catId);
  openSheet(`<h2>💩 ${esc(c.name)} · Litter issue</h2><div class="sheet-sub">What did you notice?</div>
    <div class="big-opts" id="lt">${LITTER.map(([l, i]) => `<button class="big-opt" data-l="${esc(l)}"><span class="bo-ico">${i}</span>${esc(l)}</button>`).join('')}</div>
    <label class="f"><span>Note (optional)</span><textarea class="inp" id="lt-note"></textarea></label>
    <button class="btn full" id="lt-save" disabled>Save</button>`,
  sh => {
    let label = null;
    sh.querySelectorAll('#lt [data-l]').forEach(b => b.onclick = () => { label = b.dataset.l; sh.querySelectorAll('#lt .big-opt').forEach(x => x.classList.toggle('sel', x === b)); $('#lt-save', sh).disabled = false; });
    $('#lt-save', sh).onclick = e => busy(e.currentTarget, async () => {
      await logEvent({ cat_id: catId, kind: 'litter', label, note: $('#lt-note', sh).value.trim() || null }, `💩 ${c.name}: ${label}`);
      closeSheet();
    });
  });
}
function weightSheet(catId) {
  const c = cat(catId);
  const last = S.events.find(e => e.cat_id === catId && e.kind === 'weight');
  openSheet(`<h2>⚖️ ${esc(c.name)} · Weight</h2><div class="sheet-sub">${last ? `Last: ${round(Number(last.value), 2)} kg on ${esc(fmtDate(evDay(last.at)))}` : 'First weigh-in'}</div>
    <div class="two"><label class="f"><span>Weight (kg)</span><input class="inp" id="w-val" inputmode="decimal" placeholder="4.25"></label>
    <label class="f"><span>When</span><input class="inp" type="datetime-local" id="w-at" value="${esc(toLocalInput())}"></label></div>
    <button class="btn full" id="w-save">Save</button>`,
  sh => {
    setTimeout(() => $('#w-val', sh).focus(), 150);
    $('#w-save', sh).onclick = e => busy(e.currentTarget, async () => {
      const v = num($('#w-val', sh).value);
      if (v == null || v <= 0 || v > 30) { toast('Enter the weight in kg, e.g. 4.25'); return; }
      await insert('events', { cat_id: catId, kind: 'weight', value: v, at: fromLocalInput($('#w-at', sh).value) });
      closeSheet(); toast(`⚖️ ${c.name}: ${v} kg saved`);
    });
  });
}
function behaviorSheet(catId) {
  const c = cat(catId);
  openSheet(`<h2>📝 ${esc(c.name)} · Behaviour</h2><div class="sheet-sub">Describe anything unusual</div>
    <label class="f"><span>What happened?</span><textarea class="inp" id="b-note" placeholder="e.g. hiding under the bed all afternoon"></textarea></label>
    <label class="f"><span>When</span><input class="inp" type="datetime-local" id="b-at" value="${esc(toLocalInput())}"></label>
    <label class="check"><input type="checkbox" id="b-keep"> Make this a one-tap quick button for ${esc(c.name)}</label>
    <div id="b-keep-f" hidden><div class="two"><label class="f"><span>Button name</span><input class="inp" id="b-label" maxlength="30"></label>
      <label class="f"><span>Emoji</span><input class="inp" id="b-emoji" value="⭐" maxlength="4"></label></div></div>
    <button class="btn full" id="b-save">Save</button>`,
  sh => {
    const keep = $('#b-keep', sh);
    keep.onchange = () => { $('#b-keep-f', sh).hidden = !keep.checked; if (keep.checked && !$('#b-label', sh).value) $('#b-label', sh).value = $('#b-note', sh).value.trim().slice(0, 30); };
    $('#b-save', sh).onclick = e => busy(e.currentTarget, async () => {
      const note = $('#b-note', sh).value.trim(), at = fromLocalInput($('#b-at', sh).value);
      if (keep.checked) {
        const label = $('#b-label', sh).value.trim() || note.slice(0, 30);
        if (!label) { toast('Give the button a name'); return; }
        const k = await insert('counters', { cat_id: catId, label, emoji: $('#b-emoji', sh).value.trim() || '⭐', sort: S.counters.length });
        await insert('events', { cat_id: catId, kind: 'counter', label, ref_id: k.id, note: note && note !== label ? note : null, at });
        closeSheet(); toast(`New quick button “${label}” added`);
      } else {
        if (!note) { toast('Write what happened'); return; }
        await insert('events', { cat_id: catId, kind: 'behavior', note, at });
        closeSheet(); toast(`📝 Saved for ${c.name}`);
      }
    });
  });
}
function counterAddSheet(catId) {
  const c = cat(catId);
  openSheet(`<h2>＋ Quick button for ${esc(c.name)}</h2><div class="sheet-sub">One tap logs it instantly, with the time</div>
    <div class="two"><label class="f"><span>Name</span><input class="inp" id="k-label" maxlength="30" placeholder="e.g. Cough attack"></label>
    <label class="f"><span>Emoji</span><input class="inp" id="k-emoji" value="⭐" maxlength="4"></label></div>
    <div class="chips">${['😮‍💨', '🤧', '😾', '🙀', '😿', '🫣', '🐾', '⭐'].map(x => `<button class="chip" data-e="${x}">${x}</button>`).join('')}</div>
    <div class="btn-row"><button class="btn" id="k-save">Add button</button></div>`,
  sh => {
    sh.querySelectorAll('[data-e]').forEach(b => b.onclick = () => { $('#k-emoji', sh).value = b.dataset.e; });
    $('#k-save', sh).onclick = e => busy(e.currentTarget, async () => {
      const label = $('#k-label', sh).value.trim();
      if (!label) { toast('Give it a name'); return; }
      await insert('counters', { cat_id: catId, label, emoji: $('#k-emoji', sh).value.trim() || '⭐', sort: S.counters.length });
      closeSheet(); toast(`“${label}” added for ${c.name}`);
    });
  });
}
function dietSheet(catId) {
  const c = cat(catId), d = currentDiet(catId);
  const prevFoods = [...new Set(S.diets.map(x => x.food))];
  openSheet(`<h2>🍽 ${esc(c.name)}'s food</h2><div class="sheet-sub">Changing it starts a new entry in the food history from today</div>
    <label class="f"><span>Food (brand, type, wet/dry)</span><input class="inp" id="d-food" list="d-foods" value="${esc(d?.food && d.food !== 'Not set' ? d.food : '')}" placeholder="e.g. Royal Canin Renal (dry)"></label>
    <datalist id="d-foods">${prevFoods.map(f => `<option value="${esc(f)}">`).join('')}</datalist>
    <label class="f"><span>Grams per meal (4 meals a day)</span><input class="inp" id="d-g" inputmode="decimal" value="${esc(d && Number(d.meal_g) ? d.meal_g : '')}" placeholder="e.g. 15"></label>
    <div class="muted small" id="d-total" style="font-weight:700;margin:0 2px 10px"></div>
    <button class="btn full" id="d-save">Save</button>`,
  sh => {
    const upd = () => { const g = num($('#d-g', sh).value); $('#d-total', sh).textContent = g ? `= ${round(g * 4, 1)} g a day` : ''; };
    $('#d-g', sh).oninput = upd; upd();
    $('#d-save', sh).onclick = e => busy(e.currentTarget, async () => {
      const food = $('#d-food', sh).value.trim(), g = num($('#d-g', sh).value);
      if (!food || g == null) { toast('Fill in the food and grams'); return; }
      if (d && d.from_date === today()) await update('diets', d.id, { food, meal_g: g });
      else await insert('diets', { cat_id: catId, food, meal_g: g, from_date: today() });
      closeSheet(); toast(`Food updated for ${c.name}`);
    });
  });
}
function medSheet(catId, medId) {
  const m = medId ? byId(S.meds, medId) : null;
  catId = m ? m.cat_id : catId;
  const c = cat(catId);
  let kind = m?.kind || 'daily';
  openSheet(`<h2>💊 ${m ? 'Edit' : 'New'} medication · ${esc(c.name)}</h2><div class="sheet-sub">Shows up on Today to tick off when given</div>
    <div class="two"><label class="f"><span>Name</span><input class="inp" id="md-name" value="${esc(m?.name || '')}" placeholder="e.g. Vitamins"></label>
    <label class="f"><span>Dose</span><input class="inp" id="md-dose" value="${esc(m?.dose || '')}" placeholder="e.g. 1 tablet"></label></div>
    <label class="f"><span>Type</span><div class="seg" id="md-kind">
      <button data-k="daily">Every day</button><button data-k="course">Course</button><button data-k="as_needed">As needed</button></div></label>
    <div class="muted small" id="md-help" style="font-weight:700;margin:-2px 2px 6px"></div>
    <label class="f" id="md-times-f"><span>Times (optional, e.g. 08:00, 20:00)</span><input class="inp" id="md-times" value="${esc((m?.times || []).join(', '))}" placeholder="leave empty for once a day, any time"></label>
    <div class="two"><label class="f"><span>Start</span><input class="inp" type="date" id="md-start" value="${esc(m?.start_date || today())}"></label>
    <label class="f"><span>End (optional)</span><input class="inp" type="date" id="md-end" value="${esc(m?.end_date || '')}"></label></div>
    <div class="chips" id="md-quick"><button class="chip" data-d="5">5 days</button><button class="chip" data-d="7">1 week</button><button class="chip" data-d="14">2 weeks</button><button class="chip" data-m="1">1 month</button><button class="chip" data-m="6">6 months</button></div>
    <label class="f"><span>Notes</span><textarea class="inp" id="md-notes" placeholder="with food, prescribed by…">${esc(m?.notes || '')}</textarea></label>
    ${m && m.kind !== 'as_needed' && m.active ? `<button class="btn cal full" id="md-cal" style="margin-top:6px">📅 Daily reminder in calendar</button>` : ''}
    <div class="btn-row">${m ? `<button class="btn danger" id="md-del">Delete</button>${m.active ? `<button class="btn soft" id="md-stop">Stop</button>` : ''}` : ''}<button class="btn" id="md-save">Save</button></div>`,
  sh => {
    const help = { daily: 'Every day — leave End empty if ongoing.', course: 'For a set number of days, at set times.', as_needed: 'Log it only when you give it.' };
    const setKind = k => { kind = k; sh.querySelectorAll('#md-kind button').forEach(b => b.classList.toggle('sel', b.dataset.k === k)); $('#md-help', sh).textContent = help[k]; $('#md-times-f', sh).hidden = k === 'as_needed'; };
    sh.querySelectorAll('#md-kind button').forEach(b => b.onclick = e => { e.preventDefault(); setKind(b.dataset.k); });
    setKind(kind);
    sh.querySelectorAll('#md-quick .chip').forEach(b => b.onclick = () => {
      const st = $('#md-start', sh).value || today();
      $('#md-end', sh).value = b.dataset.d ? addDays(st, Number(b.dataset.d) - 1) : addDays(addMonths(st, Number(b.dataset.m)), -1);
    });
    $('#md-save', sh).onclick = e => busy(e.currentTarget, async () => {
      const name = $('#md-name', sh).value.trim();
      if (!name) { toast('Give the medication a name'); return; }
      const times = kind === 'as_needed' ? [] : $('#md-times', sh).value.split(/[,;\s]+/).map(x => x.trim()).filter(Boolean).map(x => {
        const mm = x.match(/^(\d{1,2})[:.]?(\d{2})?$/); return mm ? `${pad(Math.min(23, +mm[1]))}:${mm[2] || '00'}` : null; }).filter(Boolean);
      const row = { cat_id: catId, name, dose: $('#md-dose', sh).value.trim() || null, kind, times: [...new Set(times)],
        start_date: $('#md-start', sh).value || today(), end_date: $('#md-end', sh).value || null, notes: $('#md-notes', sh).value.trim() || null };
      if (row.end_date && row.end_date < row.start_date) { toast('End date is before the start'); return; }
      const saved = m ? await update('meds', m.id, { ...row, active: row.end_date && row.end_date < today() ? m.active : true }) : await insert('meds', row);
      if (saved.kind !== 'as_needed' && saved.active && (!saved.end_date || saved.end_date >= today())) medCalSheet(saved.id, true);
      else { closeSheet(); toast(`💊 ${name} saved`); }
    });
    const cal = $('#md-cal', sh);
    if (cal) cal.onclick = () => medCalSheet(m.id);
    const del = $('#md-del', sh);
    if (del) del.onclick = () => confirmSheet('Delete medication?', `This removes ${m.name}. The history of given doses stays.`, 'Delete', () => remove('meds', m.id));
    const stop = $('#md-stop', sh);
    if (stop) stop.onclick = () => busy(stop, async () => { await update('meds', m.id, { active: false, end_date: today() < m.start_date ? m.start_date : today() }); closeSheet(); toast(`${m.name} stopped`); });
  });
}
function medCalUrl(m, time) {
  const c = cat(m.cat_id);
  const start = m.start_date > today() ? m.start_date : today();
  const [h, mi] = time.split(':').map(Number);
  const st = `${start.replaceAll('-', '')}T${pad(h)}${pad(mi)}00`;
  const endMin = h * 60 + mi + 15;
  const en = `${start.replaceAll('-', '')}T${pad(Math.min(23, Math.floor(endMin / 60)))}${pad(endMin >= 24 * 60 ? 59 : endMin % 60)}00`;
  const rule = `RRULE:FREQ=DAILY${m.end_date ? `;UNTIL=${m.end_date.replaceAll('-', '')}T235959Z` : ''}`;
  const details = `${m.name}${m.dose ? ` – ${m.dose}` : ''} for ${c?.name}${m.notes ? '\n' + m.notes : ''}\nTick it off in Cat Tracker when given.`;
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`💊 ${c?.name} – ${m.name}`)}&dates=${st}/${en}&ctz=Europe/Athens&recur=${encodeURIComponent(rule)}&details=${encodeURIComponent(details)}`;
}
function medCalSheet(medId, justSaved) {
  const m = byId(S.meds, medId); if (!m) return;
  const c = cat(m.cat_id), times = m.times && m.times.length ? [...m.times].sort() : null;
  const until = m.end_date ? `until ${fmtDate(m.end_date)}` : 'with no end date';
  openSheet(`<h2>📅 Reminder for ${esc(m.name)}</h2>
    <div class="sheet-sub">${justSaved ? 'Saved ✓ · ' : ''}${esc(c?.name)} · every day ${esc(until)}</div>
    ${times ? times.map(t => `<a class="btn cal full" style="margin-top:8px" href="${esc(medCalUrl(m, t))}" target="_blank" rel="noopener">📅 Add daily ${esc(t)} reminder</a>`).join('')
      : `<label class="f"><span>Remind at</span><input class="inp" type="time" id="mc-time" value="20:00"></label>
         <a class="btn cal full" id="mc-link" href="${esc(medCalUrl(m, '20:00'))}" target="_blank" rel="noopener">📅 Add daily reminder</a>`}
    <div class="muted small" style="text-align:center;margin:8px 0 0;font-weight:600">Opens Google Calendar: pick the family calendar, then Save${times && times.length > 1 ? ' (once for each time)' : ''}</div>
    <div class="btn-row"><button class="btn soft" data-act="close">${justSaved ? 'Skip' : 'Done'}</button></div>`,
  sh => {
    const ti = $('#mc-time', sh);
    if (ti) ti.oninput = () => { if (/^\d{2}:\d{2}$/.test(ti.value)) $('#mc-link', sh).href = medCalUrl(m, ti.value); };
  });
}
async function medTap(medId, key) {
  const m = byId(S.meds, medId), c = cat(m.cat_id);
  const snapshot = `${m.name}${m.dose ? ` (${m.dose})` : ''}`;
  if (key === 'now') { await logEvent({ cat_id: m.cat_id, kind: 'med_given', ref_id: m.id, label: 'now', note: snapshot }, `💊 ${c.name}: ${m.name} given`); return; }
  const ev = S.events.find(e => e.kind === 'med_given' && e.ref_id === m.id && e.label === key && evDay(e.at) === today());
  if (ev) {
    openSheet(`<h2>💊 ${esc(m.name)}${key !== 'day' ? ` · ${esc(key)}` : ''}</h2>
      <div class="sheet-sub">Given to ${esc(c.name)} by ${esc(whoName(ev.by_email))} at ${esc(fmtTime(ev.at))}</div>
      <div class="btn-row"><button class="btn soft" data-act="close">OK</button><button class="btn danger" id="mt-undo">Not given — undo</button></div>`,
    sh => { $('#mt-undo', sh).onclick = e => busy(e.currentTarget, async () => { await remove('events', ev.id); closeSheet(); }); });
    return;
  }
  const ev2 = await insert('events', { cat_id: m.cat_id, kind: 'med_given', ref_id: m.id, label: key, note: snapshot });
  toast(`💊 ${c.name}: ${m.name} ✓`, [{ t: 'Undo', fn: () => remove('events', ev2.id) }]);
}
function healthSheet(id, preCat) {
  const r = id ? byId(S.health, id) : null;
  let kind = r?.kind || 'vaccine';
  let catId = r?.cat_id || preCat || (S.healthCat !== 'all' ? S.healthCat : S.cats[0]?.id);
  openSheet(`<h2>${r ? 'Edit record' : 'New health record'}</h2>
    <div class="chips" id="h-cat" style="margin:8px 0">${S.cats.map(c => `<button class="chip" data-c="${c.id}">${avatar(c, 'sm')} ${esc(c.name)}</button>`).join('')}</div>
    <div class="seg" id="h-kind">${Object.entries(HKIND).map(([k, K]) => `<button data-k="${k}">${K.ico} ${K.one}</button>`).join('')}</div>
    <label class="f"><span id="h-title-l">Name</span><input class="inp" id="h-title" value="${esc(r?.title || '')}"></label>
    <div class="chips" id="h-sugg"></div>
    <label class="f"><span id="h-date-l">Date</span><input class="inp" type="date" id="h-date" value="${esc(r?.on_date || today())}"></label>
    <label class="f"><span>Next due (optional)</span><input class="inp" type="date" id="h-next" value="${esc(r?.next_due || '')}"></label>
    <div class="chips" id="h-quick"><button class="chip" data-m="1">+1 month</button><button class="chip" data-m="3">+3 months</button><button class="chip" data-m="6">+6 months</button><button class="chip" data-m="12">+1 year</button><button class="chip" data-m="36">+3 years</button></div>
    <label class="f"><span>Notes</span><textarea class="inp" id="h-notes" placeholder="product, vet's advice, batch number…">${esc(r?.notes || '')}</textarea></label>
    <div class="btn-row">${r ? `<button class="btn danger" id="h-del">Delete</button>` : ''}<button class="btn" id="h-save">Save</button></div>`,
  sh => {
    const setCat = id2 => { catId = id2; sh.querySelectorAll('#h-cat .chip').forEach(b => b.classList.toggle('sel', b.dataset.c === id2)); };
    const setKind = k => {
      kind = k; sh.querySelectorAll('#h-kind button').forEach(b => b.classList.toggle('sel', b.dataset.k === k));
      const prev = [...new Set(S.health.filter(x => x.kind === k).map(x => x.title))];
      const sugg = [...new Set([...prev, ...HKIND[k].sugg])].slice(0, 8);
      $('#h-sugg', sh).innerHTML = sugg.map(s => `<button class="chip" data-s="${esc(s)}">${esc(s)}</button>`).join('');
      $('#h-sugg', sh).querySelectorAll('[data-s]').forEach(b => b.onclick = () => { $('#h-title', sh).value = b.dataset.s; });
      $('#h-date-l', sh).textContent = k === 'vet' ? 'Visit / appointment date' : 'Date given';
      $('#h-title-l', sh).textContent = k === 'vet' ? 'Reason' : 'Name';
    };
    sh.querySelectorAll('#h-cat .chip').forEach(b => b.onclick = () => setCat(b.dataset.c));
    sh.querySelectorAll('#h-kind button').forEach(b => b.onclick = e => { e.preventDefault(); setKind(b.dataset.k); });
    sh.querySelectorAll('#h-quick .chip').forEach(b => b.onclick = () => { $('#h-next', sh).value = addMonths($('#h-date', sh).value || today(), Number(b.dataset.m)); });
    setCat(catId); setKind(kind);
    $('#h-save', sh).onclick = e => busy(e.currentTarget, async () => {
      const row = { cat_id: catId, kind, title: $('#h-title', sh).value.trim(), on_date: $('#h-date', sh).value, next_due: $('#h-next', sh).value || null, notes: $('#h-notes', sh).value.trim() || null };
      if (!row.cat_id || !row.title || !row.on_date) { toast('Pick a cat, a name and a date'); return; }
      const saved = r ? await update('health', r.id, row) : await insert('health', row);
      healthViewSheet(saved.id, true);
    });
    const del = $('#h-del', sh);
    if (del) del.onclick = () => confirmSheet('Delete this record?', `${r.title} for ${cat(r.cat_id)?.name}`, 'Delete', () => remove('health', r.id));
  });
}
function healthViewSheet(id, justSaved) {
  const r = byId(S.health, id); if (!r) return;
  const c = cat(r.cat_id), K = HKIND[r.kind], u = healthCal(r), t = today();
  const appt = r.kind === 'vet' && r.on_date >= t;
  openSheet(`<h2>${K.ico} ${esc(r.title)}</h2><div class="sheet-sub">${esc(c?.name)} · ${K.one}${justSaved ? ' · saved ✓' : ''}</div>
    <div class="card"><dl class="kv"><dt>${appt ? 'Appointment' : r.kind === 'vet' ? 'Visit' : 'Given'}</dt><dd>${esc(fmtDate(r.on_date))}</dd>
      ${r.next_due ? `<dt>Next due</dt><dd>${esc(fmtDate(r.next_due))} ${isLatestOfKind(r) ? dueBadge(diffDays(t, r.next_due)) : ''}</dd>` : ''}
      ${r.notes ? `<dt>Notes</dt><dd style="white-space:pre-wrap">${esc(r.notes)}</dd>` : ''}</dl></div>
    ${u ? `<a class="btn cal full" href="${esc(u)}" target="_blank" rel="noopener">📅 Add ${appt ? 'appointment' : 'reminder'} to family calendar</a>
      <div class="muted small" style="text-align:center;margin:6px 0 0;font-weight:600">Opens Google Calendar: pick the family calendar, then Save</div>` : ''}
    <div class="btn-row"><button class="btn soft" data-act="close">Done</button><button class="btn soft" id="hv-edit">Edit</button>
      ${!appt && r.next_due ? `<button class="btn soft" id="hv-again">Log next dose</button>` : ''}</div>`,
  sh => {
    $('#hv-edit', sh).onclick = () => healthSheet(r.id);
    const again = $('#hv-again', sh);
    if (again) again.onclick = () => {
      healthSheet(null, r.cat_id);
      const s2 = $('#sheet');
      s2.querySelector(`#h-kind [data-k="${r.kind}"]`)?.click();
      $('#h-title', s2).value = r.title;
      if (r.next_due && r.on_date) { const months = Math.round(diffDays(r.on_date, r.next_due) / 30.44); if (months > 0) $('#h-next', s2).value = addMonths(today(), months); }
    };
  });
}
function catSheet(id) {
  const c = id ? cat(id) : null;
  let color = c?.color || COLORS[S.cats.length % COLORS.length], photo = c?.photo || null;
  openSheet(`<h2>${c ? `Edit ${esc(c.name)}` : 'New cat'}</h2>
    <div style="display:flex;align-items:center;gap:14px;margin:10px 0"><div id="cs-av"></div>
      <label class="btn soft" style="flex:1">📷 ${photo ? 'Change photo' : 'Add photo'}<input type="file" accept="image/*" id="cs-photo" hidden></label>
      ${photo ? `<button class="btn soft" id="cs-nophoto">Remove</button>` : ''}</div>
    <label class="f"><span>Name</span><input class="inp" id="cs-name" value="${esc(c?.name || '')}"></label>
    <label class="f"><span>Colour</span><div class="swatches" id="cs-col">${COLORS.map(x => `<button class="swatch" data-c="${x}" style="background:${x}"></button>`).join('')}</div></label>
    <div class="two"><label class="f"><span>Birthday</span><input class="inp" type="date" id="cs-bday" value="${esc(c?.birthday || '')}"></label>
    <label class="f"><span>Microchip</span><input class="inp" id="cs-chip" value="${esc(c?.microchip || '')}"></label></div>
    <label class="f"><span>Vet (name, phone)</span><input class="inp" id="cs-vet" value="${esc(c?.vet || '')}"></label>
    <label class="f"><span>Notes (allergies, character…)</span><textarea class="inp" id="cs-notes">${esc(c?.notes || '')}</textarea></label>
    <div class="btn-row">${c ? `<button class="btn danger" id="cs-del">Remove cat</button>` : ''}<button class="btn" id="cs-save">Save</button></div>`,
  sh => {
    const drawAv = () => { $('#cs-av', sh).innerHTML = avatar({ name: $('#cs-name', sh).value || '?', color, photo }, 'lg'); sh.querySelectorAll('.swatch').forEach(b => b.classList.toggle('sel', b.dataset.c === color)); };
    drawAv();
    $('#cs-name', sh).oninput = drawAv;
    sh.querySelectorAll('.swatch').forEach(b => b.onclick = e => { e.preventDefault(); color = b.dataset.c; drawAv(); });
    $('#cs-photo', sh).onchange = async e => { const f = e.target.files[0]; if (!f) return; try { photo = await resizeImage(f); drawAv(); } catch (er) { toast('Could not read that photo'); } };
    const np = $('#cs-nophoto', sh); if (np) np.onclick = () => { photo = null; drawAv(); };
    $('#cs-save', sh).onclick = e => busy(e.currentTarget, async () => {
      const row = { name: $('#cs-name', sh).value.trim(), color, photo, birthday: $('#cs-bday', sh).value || null, microchip: $('#cs-chip', sh).value.trim() || null, vet: $('#cs-vet', sh).value.trim() || null, notes: $('#cs-notes', sh).value.trim() || null };
      if (!row.name) { toast('Give the cat a name'); return; }
      if (c) await update('cats', c.id, row); else await insert('cats', { ...row, sort: S.cats.length + 1 });
      closeSheet();
    });
    const del = $('#cs-del', sh);
    if (del) del.onclick = () => confirmSheet(`Remove ${c.name}?`, 'This deletes the cat and ALL their records (meals, health, history). Make a backup first if unsure.', 'Remove forever', async () => { await remove('cats', c.id); S.catId = null; render(); });
  });
}
function resizeImage(file, size = 360) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(img.width, img.height), cv = document.createElement('canvas');
      cv.width = cv.height = Math.min(size, s);
      cv.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url); res(cv.toDataURL('image/jpeg', .82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('bad image')); };
    img.src = url;
  });
}

/* ---------- backup ---------- */
async function exportAll() {
  toast('📦 Preparing backup…', [], 8000);
  try {
    const all = {};
    for (const t of TABLES) all[t] = await fetchAll(t, true);
    const cn = id => (all.cats.find(c => c.id === id) || {}).name || '';
    const when = iso => iso ? `${dayStr(new Date(iso))} ${fmtTime(iso)}` : '';
    const sheets = {
      Cats: all.cats.map(c => ({ Name: c.name, Birthday: c.birthday, Microchip: c.microchip, Vet: c.vet, Notes: c.notes })),
      Food: all.diets.map(d => ({ Cat: cn(d.cat_id), Food: d.food, 'Grams per meal': Number(d.meal_g), 'From': d.from_date })),
      Meals: all.meals.sort((a, b) => a.day.localeCompare(b.day)).map(m => ({ Cat: cn(m.cat_id), Day: m.day, Meal: SLOT[m.slot].name, Ate: AMT[m.amount].t, 'Served g': m.served_g == null ? '' : Number(m.served_g), Food: m.food, Time: when(m.at), By: m.by_email })),
      Health: all.health.map(r => ({ Cat: cn(r.cat_id), Type: HKIND[r.kind].one, Name: r.title, Date: r.on_date, 'Next due': r.next_due, Notes: r.notes })),
      Medications: all.meds.map(m => ({ Cat: cn(m.cat_id), Name: m.name, Dose: m.dose, Type: m.kind, Times: (m.times || []).join(', '), Start: m.start_date, End: m.end_date, Active: m.active, Notes: m.notes })),
    };
    const evs = all.events.sort((a, b) => a.at.localeCompare(b.at));
    const evRow = e => ({ Cat: cn(e.cat_id), Time: when(e.at), What: e.label || '', Note: e.note || '', By: e.by_email });
    sheets.Weight = evs.filter(e => e.kind === 'weight').map(e => ({ Cat: cn(e.cat_id), Time: when(e.at), 'Weight kg': Number(e.value), Note: e.note || '' }));
    sheets.Behaviour = evs.filter(e => e.kind === 'counter' || e.kind === 'behavior').map(evRow);
    sheets['Puke & litter'] = evs.filter(e => e.kind === 'vomit' || e.kind === 'litter').map(e => ({ ...evRow(e), What: e.kind === 'vomit' ? 'Puked' : e.label }));
    sheets['Meds given'] = evs.filter(e => e.kind === 'med_given').map(e => ({ Cat: cn(e.cat_id), Time: when(e.at), Medication: e.note, Dose: ['day', 'now'].includes(e.label) ? '' : e.label, By: e.by_email }));
    const name = `cat-tracker-backup-${today()}`;
    if (window.XLSX) {
      const wb = XLSX.utils.book_new();
      Object.entries(sheets).forEach(([n, rows]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{ '': 'No records' }]), n));
      XLSX.writeFile(wb, `${name}.xlsx`);
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(all, null, 1)], { type: 'application/json' }));
      a.download = `${name}.json`; a.click();
    }
    toast('✅ Backup downloaded');
  } catch (e) { console.error(e); toast('⚠️ Backup failed: ' + (e.message || e)); }
}

/* ---------- actions ---------- */
const ACT = {
  tab: d => { S.tab = d.tab; S.catId = null; render(); window.scrollTo(0, 0); },
  close: () => closeSheet(),
  retry: () => loadAll(),
  meal: d => mealSheet(d.cat, d.slot, d.day || today()),
  count: d => { const k = byId(S.counters, d.id); logEvent({ cat_id: k.cat_id, kind: 'counter', label: k.label, ref_id: k.id }, `${k.emoji || '⭐'} ${cat(k.cat_id).name}: ${k.label}`).catch(() => {}); },
  vomit: d => logEvent({ cat_id: d.cat, kind: 'vomit' }, `🤮 ${cat(d.cat).name} puked — logged`).catch(() => {}),
  litter: d => litterSheet(d.cat),
  weight: d => weightSheet(d.cat),
  behavior: d => behaviorSheet(d.cat),
  'today-cat': d => { S.todayCat = d.cat; try { localStorage.setItem('todayCat', d.cat); } catch (e) {} render(); },
  'add-counter': d => counterAddSheet(d.cat),
  'counter-del': d => { const k = byId(S.counters, d.id); confirmSheet(`Remove “${k.label}” button?`, 'Past entries stay in the history.', 'Remove', () => remove('counters', k.id)); },
  diet: d => dietSheet(d.cat),
  med: d => medTap(d.med, d.key).catch(() => {}),
  'med-edit': d => medSheet(d.cat, d.id),
  'open-cat': d => { if (S.tab !== 'cats' || S.catId !== d.cat) history.pushState({ cat: d.cat }, ''); S.tab = 'cats'; S.catId = d.cat; render(); window.scrollTo(0, 0); },
  back: () => history.back(),
  'cat-edit': d => catSheet(d.cat),
  'cat-add': () => catSheet(null),
  'cat-health': d => { S.tab = 'health'; S.healthCat = d.cat; S.catId = null; render(); window.scrollTo(0, 0); },
  'cat-history': d => { S.tab = 'history'; S.histCat = d.cat; S.histKind = 'all'; S.catId = null; render(); window.scrollTo(0, 0); },
  'health-cat': d => { S.healthCat = d.cat; render(); },
  'health-add': () => healthSheet(null),
  'health-view': d => healthViewSheet(d.id),
  'hist-cat': d => { S.histCat = d.cat; S.histLimit = 150; render(); },
  'hist-kind': d => { S.histKind = d.k; S.histLimit = 150; render(); },
  'hist-more': () => { S.histLimit += 150; render(); },
  'ev-edit': d => eventSheet(d.id),
  export: () => exportAll(),
  signout: () => confirmSheet('Sign out?', 'You will need your password to sign in again.', 'Sign out', async () => { await sb.auth.signOut(); }),
};
document.addEventListener('click', e => {
  const tabBtn = e.target.closest('#tabs button');
  if (tabBtn) { ACT.tab({ tab: tabBtn.dataset.tab }); return; }
  const el = e.target.closest('[data-act]');
  if (!el || el.tagName === 'A') return;
  const fn = ACT[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el.dataset, el); }
});

let swX = null, swY = null;
document.addEventListener('touchstart', e => { if (S.tab !== 'today' || sheetOpen || !e.target.closest('#today-swipe')) { swX = null; return; } swX = e.touches[0].clientX; swY = e.touches[0].clientY; }, { passive: true });
document.addEventListener('touchend', e => {
  if (swX == null) return;
  const dx = e.changedTouches[0].clientX - swX, dy = e.changedTouches[0].clientY - swY; swX = null;
  if (Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * .6) return;
  const i = S.cats.findIndex(c => c.id === S.todayCat), j = i + (dx < 0 ? 1 : -1);
  if (S.cats[j]) ACT['today-cat']({ cat: S.cats[j].id });
}, { passive: true });

/* ---------- auth & start ---------- */
function passwordSheet() {
  openSheet(`<h2>Set a new password</h2><label class="f"><span>New password</span><input class="inp" type="password" id="np" autocomplete="new-password"></label>
    <button class="btn full" id="np-save">Save password</button>`, sh => {
    $('#np-save', sh).onclick = e => busy(e.currentTarget, async () => {
      const p = $('#np', sh).value; if (p.length < 6) { toast('At least 6 characters'); return; }
      await run(sb.auth.updateUser({ password: p })); closeSheet(); toast('Password updated');
    });
  });
}
sb.auth.onAuthStateChange((event, session) => {
  const u = session?.user || null;
  const changed = (u?.id || null) !== (S.user?.id || null);
  S.user = u;
  if (event === 'PASSWORD_RECOVERY') setTimeout(passwordSheet, 300);
  if (!changed) return;
  if (u) { S.loaded = false; render(); setTimeout(() => { loadAll(); subscribe(); }, 0); }
  else { if (channel) { sb.removeChannel(channel); channel = null; } TABLES.forEach(t => S[t] = []); S.loaded = false; render(); }
});
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.user) loadAll(); });
setInterval(() => { if (S.user && S.loaded && document.visibilityState === 'visible' && !sheetOpen) render(); }, 60000); // keep "due" states fresh

sb.auth.getSession().then(({ data }) => { if (!data.session) render(); });
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
window.__cat = { S, render }; // for debugging
})();

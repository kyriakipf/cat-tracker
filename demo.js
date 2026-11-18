/* Demo mode: used when signed in as the demo account.
   Everything stays in this browser (made-up cats, nothing touches the real database). */
(() => {
'use strict';
const KEY = 'catDemoDB';
const DEMO_EMAIL = 'demo@cattracker.com';
const OTHER = 'partner@cattracker.com';
const TABLES = ['cats', 'diets', 'meals', 'counters', 'events', 'meds', 'health'];
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'd' + Math.random().toString(16).slice(2) + Date.now().toString(16));
const pad = n => String(n).padStart(2, '0');
const ds = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dayOff = n => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
const day = n => ds(dayOff(n));
const at = (n, h, m) => { const d = dayOff(n); d.setHours(h, m, 0, 0); return d.toISOString(); };
const nowIso = () => new Date().toISOString();

function seed() {
  const DB = Object.fromEntries(TABLES.map(t => [t, []]));
  const mk = (name, color, sort, extra = {}) => ({ id: uuid(), name, color, sort, photo: null, birthday: null, microchip: null, vet: null, notes: null, created_at: nowIso(), ...extra });
  const luna = mk('Luna', '#B79CE0', 1, { birthday: '2018-05-03', microchip: '941000024681357', vet: 'Happy Paws Clinic · 210 555 0101', notes: 'Sensitive stomach' });
  const milo = mk('Milo', '#F2A65A', 2, { birthday: '2021-09-14', vet: 'Happy Paws Clinic · 210 555 0101' });
  const pepper = mk('Pepper', '#6EC1C1', 3, { birthday: '2015-02-20', notes: 'Senior, kidney diet' });
  DB.cats = [luna, milo, pepper];
  const cats = DB.cats;

  DB.diets.push(
    { id: uuid(), cat_id: luna.id, food: 'Sensitive dry', meal_g: 14, from_date: day(-90), created_at: nowIso() },
    { id: uuid(), cat_id: luna.id, food: 'Gastro wet pouch', meal_g: 35, from_date: day(-12), created_at: nowIso() },
    { id: uuid(), cat_id: milo.id, food: 'Indoor adult dry', meal_g: 16, from_date: day(-60), created_at: nowIso() },
    { id: uuid(), cat_id: pepper.id, food: 'Renal care wet', meal_g: 40, from_date: day(-120), created_at: nowIso() });
  const foodOf = c => DB.diets.filter(d => d.cat_id === c.id).slice(-1)[0];

  const cough = { id: uuid(), cat_id: luna.id, label: 'Cough attack', emoji: '😮‍💨', sort: 0, created_at: nowIso() };
  const sneeze = { id: uuid(), cat_id: milo.id, label: 'Sneeze', emoji: '🤧', sort: 0, created_at: nowIso() };
  const zoom = { id: uuid(), cat_id: milo.id, label: 'Night zoomies', emoji: '🐾', sort: 1, created_at: nowIso() };
  DB.counters.push(cough, sneeze, zoom);

  // Meals: last 14 days, plus this morning
  const amounts = ['all', 'all', 'all', 'most', 'all', 'half', 'all', 'most'];
  const slotTimes = { morning: [7, 45], midday: [13, 30], evening: [19, 30], night: [23, 10] };
  for (let n = -14; n <= 0; n++) {
    cats.forEach((c, ci) => {
      const f = foodOf(c);
      Object.entries(slotTimes).forEach(([slot, [h, m]], si) => {
        if (n === 0 && slot !== 'morning') return;
        if (n < 0 && (n * 7 + ci * 3 + si) % 23 === 0) return; // the odd missed meal
        const amount = amounts[Math.abs(n * 5 + ci * 2 + si) % amounts.length];
        DB.meals.push({ id: uuid(), cat_id: c.id, day: day(n), slot, amount: c === pepper && slot === 'night' && n % 3 === 0 ? 'little' : amount,
          food: f.food, served_g: f.meal_g, at: at(n, h, m + ci * 2), by_email: (n + si) % 2 ? DEMO_EMAIL : OTHER });
      });
    });
  }

  const ev = (cat_id, kind, n, h, m, extra = {}) => DB.events.push({ id: uuid(), cat_id, kind, label: null, note: null, value: null, ref_id: null, at: at(n, h, m), by_email: (n % 2) ? DEMO_EMAIL : OTHER, ...extra });
  for (let n = -13; n <= 0; n++) {
    if (n % 2 === 0) ev(luna.id, 'counter', n, 10, 15, { label: cough.label, ref_id: cough.id });
    if (n > -5) ev(luna.id, 'counter', n, 21, 40, { label: cough.label, ref_id: cough.id });
    if (n % 3 === 0) ev(milo.id, 'counter', n, 8, 20, { label: sneeze.label, ref_id: sneeze.id });
    if (n % 4 === 1 || n === 0) ev(milo.id, 'counter', n - (n === 0 ? 1 : 0), 2, 30, { label: zoom.label, ref_id: zoom.id });
  }
  ev(luna.id, 'vomit', -9, 18, 5, { note: 'After eating too fast' });
  ev(luna.id, 'vomit', -3, 7, 30, { note: 'Hairball' });
  ev(pepper.id, 'vomit', -1, 22, 15);
  ev(luna.id, 'litter', -6, 9, 0, { label: 'Soft stool', note: 'Day after the food switch' });
  ev(pepper.id, 'litter', -2, 16, 40, { label: 'Straining' });
  ev(milo.id, 'behavior', -4, 15, 0, { note: 'Hiding under the bed most of the afternoon' });
  ev(pepper.id, 'behavior', -1, 11, 20, { note: 'Drinking more water than usual' });
  [[luna, [4.3, 4.25, 4.2, 4.18]], [milo, [5.1, 5.2, 5.3, 5.35]], [pepper, [3.9, 3.8, 3.72, 3.65]]].forEach(([c, ws]) =>
    ws.forEach((w, i) => ev(c.id, 'weight', -90 + i * 30, 9, 0, { value: w })));

  const vit = { id: uuid(), cat_id: pepper.id, name: 'Kidney supplement', dose: '1 scoop', kind: 'daily', times: [], start_date: day(-40), end_date: day(140), notes: 'Mix into wet food', active: true, created_at: nowIso() };
  const anti = { id: uuid(), cat_id: luna.id, name: 'Antibiotic', dose: '0.5 ml', kind: 'course', times: ['08:00', '20:00'], start_date: day(-3), end_date: day(3), notes: 'For the cough, from Dr. Smith', active: true, created_at: nowIso() };
  const calm = { id: uuid(), cat_id: milo.id, name: 'Calming treat', dose: '1 treat', kind: 'as_needed', times: [], start_date: day(-30), end_date: null, notes: 'Before car trips', active: true, created_at: nowIso() };
  DB.meds.push(vit, anti, calm);
  for (let n = -3; n <= 0; n++) {
    ev(pepper.id, 'med_given', n, 20, 5, { ref_id: vit.id, label: 'day', note: 'Kidney supplement (1 scoop)' });
    ev(luna.id, 'med_given', n, 8, 3, { ref_id: anti.id, label: '08:00', note: 'Antibiotic (0.5 ml)' });
    if (n < 0) ev(luna.id, 'med_given', n, 20, 10, { ref_id: anti.id, label: '20:00', note: 'Antibiotic (0.5 ml)' });
  }
  ev(milo.id, 'med_given', -8, 9, 0, { ref_id: calm.id, label: 'now', note: 'Calming treat (1 treat)' });

  const h = (cat_id, kind, title, on, next, extra = {}) => DB.health.push({ id: uuid(), cat_id, kind, title, on_date: on, next_due: next, repeat_months: null, done_at: null, appt_time: null, notes: null, created_at: nowIso(), ...extra });
  cats.forEach(c => h(c.id, 'antiparasitic', 'Spot-on (all-in-one)', day(-85), day(5), { repeat_months: 3 }));
  cats.forEach(c => h(c.id, 'antiparasitic', 'Dewormer', day(-200), day(-18), { repeat_months: 6 }));
  h(luna.id, 'vaccine', 'Tricat (core)', day(-340), day(25), { repeat_months: 12 });
  h(milo.id, 'vaccine', 'Tricat (core)', day(-100), day(265), { repeat_months: 12 });
  h(milo.id, 'vaccine', 'Rabies', day(-100), day(995), { repeat_months: 36 });
  h(pepper.id, 'vaccine', 'Tricat (core)', day(-500), null, { notes: 'Vet said to skip boosters while on kidney diet' });
  h(luna.id, 'vet', 'Cough check', day(-3), null, { appt_time: '18:00', done_at: at(-3, 18, 45), notes: 'Mild bronchitis. Antibiotic for 7 days, recheck if no better.' });
  h(pepper.id, 'vet', 'Blood test', day(2), null, { appt_time: '10:30' });
  cats.forEach(c => h(c.id, 'vet', 'Annual check-up', day(12), null, { appt_time: '17:30' }));
  DB.seeded = ds(new Date());
  return DB;
}

let DB = null;
function load() {
  try { DB = JSON.parse(localStorage.getItem(KEY)); } catch (e) { DB = null; }
  if (!DB || !TABLES.every(t => Array.isArray(DB[t])) || DB.seeded !== ds(new Date())) { DB = seed(); save(); } // fresh sample data every day
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) {} }

const defaults = {
  cats: { color: '#F2A65A', sort: 0, photo: null, created_at: nowIso },
  diets: { from_date: () => ds(new Date()), created_at: nowIso },
  meals: { at: nowIso, by_email: () => DEMO_EMAIL },
  counters: { emoji: '⭐', sort: 0, created_at: nowIso },
  events: { at: nowIso, by_email: () => DEMO_EMAIL, label: null, note: null, value: null, ref_id: null },
  meds: { times: () => [], active: true, kind: 'daily', start_date: () => ds(new Date()), end_date: null, created_at: nowIso },
  health: { created_at: nowIso, next_due: null, notes: null, repeat_months: null, done_at: null, appt_time: null },
};
const withDef = (t, r) => { const o = { id: uuid(), ...r }; for (const [k, v] of Object.entries(defaults[t] || {})) if (o[k] === undefined) o[k] = typeof v === 'function' ? v() : v; return o; };
const clone = x => JSON.parse(JSON.stringify(x));

class Query {
  constructor(t) { this.t = t; this.op = 'select'; this.f = []; }
  select() { return this; }
  order() { return this; }
  range(a, b) { this.r = [a, b]; return this; }
  gte(c, v) { this.f.push(r => r[c] >= v); return this; }
  eq(c, v) { this.f.push(r => r[c] === v); return this; }
  in(c, v) { this.f.push(r => v.includes(r[c])); return this; }
  insert(row) { this.op = 'insert'; this.row = row; return this; }
  upsert(row, o) { this.op = 'upsert'; this.row = row; this.oc = o.onConflict.split(','); return this; }
  update(p) { this.op = 'update'; this.patch = p; return this; }
  delete() { this.op = 'delete'; return this; }
  single() { this.one = true; return this; }
  then(res, rej) { return Promise.resolve().then(() => this.exec()).then(res, rej); }
  exec() {
    if (!DB) load();
    const L = DB[this.t], match = r => this.f.every(f => f(r));
    let out = [];
    if (this.op === 'select') { out = L.filter(match); if (this.r) out = out.slice(this.r[0], this.r[1] + 1); }
    else if (this.op === 'insert') { out = [].concat(this.row).map(r => withDef(this.t, r)); L.push(...out); }
    else if (this.op === 'upsert') {
      const ex = L.find(r => this.oc.every(c => r[c] === this.row[c]));
      if (ex) { Object.assign(ex, this.row); out = [ex]; } else { const o = withDef(this.t, this.row); L.push(o); out = [o]; }
    }
    else if (this.op === 'update') { out = L.filter(match); out.forEach(r => Object.assign(r, this.patch)); }
    else if (this.op === 'delete') {
      const del = L.filter(match); DB[this.t] = L.filter(r => !del.includes(r));
      if (this.t === 'cats') TABLES.forEach(k => { if (k !== 'cats') DB[k] = DB[k].filter(r => !del.some(c => c.id === r.cat_id)); });
    }
    if (this.op !== 'select') save();
    out = clone(out);
    return { data: this.one ? (out[0] || null) : out, error: null };
  }
}

window.CatDemo = {
  email: DEMO_EMAIL,
  isDemo: email => (email || '').toLowerCase() === DEMO_EMAIL,
  client: { from: t => new Query(t) },
  reset() { DB = seed(); save(); },
};
})();

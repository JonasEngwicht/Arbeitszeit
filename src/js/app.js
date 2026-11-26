import {
  calcDay, parseTime, parseDuration, formatHM, formatDecimal, formatClock, formatEuro, wageCents,
  belowMinWage, minWageAt, restViolations, weekSummary, monthSummary, quittingTime, sumRows,
  toIso, parseIso, addDays, mondayOf, isoWeek, dailyTarget, WEEKDAYS, WEEKDAYS_SHORT, MONTHS,
  dayInfo, holidayName, accountBalance, defaultSurcharges, salaryToHourly, hourlyToSalary,
  encodeShare, decodeShare, daysInMonth, DAY_TYPES,
} from './core.js';
import { STATES } from './config.js';
import * as store from './store.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const TABS = ['tag', 'woche', 'monat', 'feierabend', 'addieren', 'dezimal', 'lohn'];
const todayIso = () => toIso(new Date());
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const fmtDate = (iso, opts = { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }) => parseIso(iso).toLocaleDateString('de-DE', opts);

const DEFAULT_PROFILE = () => ({
  id: `p${Date.now().toString(36)}`, name: 'Mein Job', weeklyMinutes: 2400, workdays: [1, 2, 3, 4, 5],
  wage: null, minor: false, autoDeduct: false, bakery: false, state: '', startBalance: 0, surcharges: defaultSurcharges(),
});

const state = {
  profiles: [], profile: null, entries: {},
  day: todayIso(), dayDirty: false, week: todayIso(), month: null, tab: 'tag',
  addRows: [],
};

/* ---------- Hilfen ---------- */

let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

function opts() {
  const p = state.profile;
  return { minor: p.minor, autoDeduct: p.autoDeduct, bakery: p.bakery };
}

function noteHtml(list) {
  return list.map((w) => `<li class="note ${w.level}">${esc(w.text)}</li>`).join('');
}

function isWorkday(iso) {
  return state.profile.workdays.includes(parseIso(iso).getDay());
}

// Minutenfeld: "30" → 30, "0:30" → 30
function parseMinutes(v) {
  const t = String(v ?? '').trim();
  if (!t) return null;
  if (/^\d+$/.test(t)) return +t;
  return parseDuration(t);
}

function normalizeTimeInput(el) {
  const v = el.value.trim();
  if (!v) { el.removeAttribute('aria-invalid'); return; }
  const m = parseTime(v);
  if (m === null) { el.setAttribute('aria-invalid', 'true'); return; }
  el.removeAttribute('aria-invalid');
  el.value = m === 1440 ? '24:00' : formatClock(m);
}

function saldoToDate(days) {
  const t = todayIso();
  if (!days.length || days[0].date > t || days[days.length - 1].date <= t) return null;
  const st = accStart();
  return days.filter((d) => d.date <= t && st && d.date >= st).reduce((a, d) => a + d.diff, 0);
}
// Kontobeginn: ab hier zählen leere Tage als Minus (davor und in der Zukunft bleiben sie neutral)
const accStart = () => state.profile.accountStart || Object.keys(state.entries).sort()[0] || null;
const isFutureEmpty = (d) => !d.valid && d.type === 'work' && (d.date > todayIso() || !accStart() || d.date < accStart());
const typeTag = (d) => (d.type !== 'work' ? `<span class="tag">${DAY_TYPES[d.type]}</span>` : '');
const holTag = (d) => (d.holiday ? `<span class="hol">${esc(d.holiday)}</span>` : '');

function sumBox(k, v, s = '', cls = '') {
  return `<div class="sum"><div class="k">${k}</div><div class="v ${cls}">${v}</div>${s ? `<div class="s">${s}</div>` : ''}</div>`;
}
const signCls = (m) => (m > 0 ? 'pos' : m < 0 ? 'neg' : '');

function download(name, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* ---------- Daten ---------- */

async function loadProfiles() {
  state.profiles = await store.getAll('profiles');
  if (!state.profiles.length) {
    const p = DEFAULT_PROFILE();
    state.profiles = [p];
    await store.put('profiles', p);
  }
  const activeId = await store.getMeta('activeProfile');
  state.profile = state.profiles.find((p) => p.id === activeId) || state.profiles[0];
  for (const p of state.profiles) if (!p.surcharges) p.surcharges = defaultSurcharges();
  await loadEntries();
}

async function loadEntries() {
  const list = await store.getEntries(state.profile.id);
  state.entries = {};
  for (const e of list) state.entries[e.date] = e;
}

async function saveEntry(date, data) {
  const empty = !data.start && !data.end && (!data.type || data.type === 'work');
  if (empty) {
    delete state.entries[date];
    await store.del('entries', `${state.profile.id}|${date}`);
    return;
  }
  const e = { key: `${state.profile.id}|${date}`, profileId: state.profile.id, date, ...data, updated: Date.now() };
  state.entries[date] = e;
  await store.put('entries', e);
  if (!state.persisted) { state.persisted = true; store.persist(); }
}

async function saveProfile() {
  await store.put('profiles', state.profile);
}

/* ---------- Tabs ---------- */

function selectTab(name, { focus = false, scroll = false, hash = true } = {}) {
  if (!TABS.includes(name)) name = 'tag';
  state.tab = name;
  for (const t of TABS) {
    const btn = $(`tab-${t}`);
    const on = t === name;
    btn.setAttribute('aria-selected', String(on));
    btn.tabIndex = on ? 0 : -1;
    $(t).hidden = !on;
  }
  if (focus) $(`tab-${name}`).focus();
  if (hash) history.replaceState(null, '', name === 'tag' ? location.pathname : `#${name}`);
  if (name === 'woche') renderWeek();
  if (name === 'monat') renderMonth();
  if (name === 'feierabend') renderQuit();
  if (name === 'addieren') renderAddRows();
  if (name === 'lohn') computeSalary();
  if (scroll) $('calc').scrollIntoView({ block: 'start' });
  $(`tab-${name}`).scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function bindTabs() {
  const list = document.querySelector('.tabs');
  list.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (b) selectTab(b.dataset.tab);
  });
  list.addEventListener('keydown', (e) => {
    const i = TABS.indexOf(state.tab);
    let n = null;
    if (e.key === 'ArrowRight') n = TABS[(i + 1) % TABS.length];
    if (e.key === 'ArrowLeft') n = TABS[(i - 1 + TABS.length) % TABS.length];
    if (e.key === 'Home') n = TABS[0];
    if (e.key === 'End') n = TABS[TABS.length - 1];
    if (n) { e.preventDefault(); selectTab(n, { focus: true }); }
  });
  window.addEventListener('hashchange', () => {
    const h = location.hash.slice(1);
    if (TABS.includes(h)) selectTab(h, { scroll: true, hash: false });
    else if (h.startsWith('teilen=')) showShared();
  });
}

/* ---------- Tag ---------- */

function breakRow(b, i) {
  const n = i + 1;
  const isRange = b.kind === 'range';
  return `<div class="brk" data-kind="${isRange ? 'range' : 'min'}">
    <select class="in brk-kind" aria-label="Art der Pause ${n}"><option value="min"${isRange ? '' : ' selected'}>Minuten</option><option value="range"${isRange ? ' selected' : ''}>von – bis</option></select>
    ${isRange
    ? `<span class="brk-range"><input class="in in-time brk-from" type="text" inputmode="numeric" autocomplete="off" placeholder="12:00" value="${esc(b.from || '')}" aria-label="Pause ${n} von"><span class="unit">–</span><input class="in in-time brk-to" type="text" inputmode="numeric" autocomplete="off" placeholder="12:30" value="${esc(b.to || '')}" aria-label="Pause ${n} bis"></span>`
    : `<span class="brk-min"><input class="in in-num brk-minutes" type="text" inputmode="numeric" autocomplete="off" value="${b.minutes ?? ''}" placeholder="30" aria-label="Pause ${n} in Minuten"> <span class="unit">Min.</span></span>`}
    <button type="button" class="icon-btn brk-del" aria-label="Pause ${n} entfernen">×</button>
  </div>`;
}

function renderBreaks(breaks) {
  $('d-breaks').innerHTML = breaks.map(breakRow).join('');
}

function readBreaks() {
  return [...$('d-breaks').querySelectorAll('.brk')].map((row) => {
    if (row.dataset.kind === 'range') {
      const f = parseTime(row.querySelector('.brk-from').value);
      const t = parseTime(row.querySelector('.brk-to').value);
      return { kind: 'range', from: f === null ? row.querySelector('.brk-from').value.trim() : formatClock(f), to: t === null ? row.querySelector('.brk-to').value.trim() : formatClock(t) };
    }
    const v = parseMinutes(row.querySelector('.brk-minutes').value);
    return { kind: 'min', minutes: v === null ? null : Math.max(0, v) };
  });
}

function readDay() {
  const s = parseTime($('d-start').value);
  const e = parseTime($('d-end').value);
  const type = $('d-type').value || 'work';
  if (type !== 'work') return { start: '', end: '', breaks: [], type };
  return {
    start: s === null ? $('d-start').value.trim() : formatClock(s),
    end: e === null ? $('d-end').value.trim() : (e === 1440 ? '24:00' : formatClock(e)),
    breaks: readBreaks().filter((b) => (b.kind === 'min' ? b.minutes : b.from || b.to)),
    type,
  };
}

function writeDay(entry) {
  $('d-type').value = entry?.type || 'work';
  $('d-start').value = entry?.start || '';
  $('d-end').value = entry?.end || '';
  $('d-start').removeAttribute('aria-invalid');
  $('d-end').removeAttribute('aria-invalid');
  renderBreaks(entry ? (entry.breaks?.length ? entry.breaks : []) : [{ kind: 'min', minutes: 30 }]);
}

function updateSaveState() {
  const el = $('d-save');
  const saved = !!state.entries[state.day];
  const label = fmtDate(state.day, { weekday: 'short', day: '2-digit', month: '2-digit' });
  if (saved) { el.textContent = `✓ Gespeichert für ${label}`; el.className = 'save-state saved'; }
  else if (state.dayDirty) { el.textContent = ''; el.className = 'save-state'; }
  else { el.textContent = `Wird beim Bearbeiten für ${label} gespeichert`; el.className = 'save-state'; }
  $('d-clear').hidden = !saved;
  const prev = state.entries[addDays(state.day, -1)];
  $('d-copy-prev').hidden = !prev;
  if (prev) $('d-copy-prev').textContent = prev.type && prev.type !== 'work' ? `Gestern kopieren (${DAY_TYPES[prev.type]})` : `Gestern kopieren (${prev.start}–${prev.end})`;
}

let stampTimer = null;
function computeDay() {
  const d = readDay();
  const p = state.profile;
  const type = d.type || 'work';
  const isToday = state.day === todayIso();
  $('tag').classList.toggle('nonwork', type !== 'work');
  // Stempeluhr: Beginn ohne Ende am heutigen Tag = Schicht läuft
  const running = type === 'work' && isToday && parseTime(d.start) !== null && !d.end;
  const calcIn = running ? { ...d, end: formatClock(nowMin()) } : d;
  const info = dayInfo(state.day, calcIn, p);
  const r = type === 'work' ? calcDay({ ...calcIn, ...opts(), date: state.day }) : { valid: false, warnings: [], breakTotal: 0, deducted: 0 };
  const shown = type === 'work' ? (r.valid ? r.net : null) : info.credit;
  $('r-label').textContent = running ? 'Arbeitszeit bisher' : type === 'work' ? 'Arbeitszeit' : `${DAY_TYPES[type]}${info.credit ? ' – angerechnet' : ''}`;
  $('r-hm').textContent = shown === null ? '–:––' : formatHM(shown);
  $('r-dec').textContent = shown === null ? '–' : formatDecimal(shown);
  $('r-next').hidden = !r.nextDay;
  $('r-gross').textContent = r.valid ? `${formatHM(r.gross)} h` : '–';
  $('r-break').textContent = `${formatHM(r.breakTotal + r.deducted)} h`;
  $('r-gross').parentElement.hidden = type !== 'work';
  $('r-break').parentElement.hidden = type !== 'work';
  $('r-night-wrap').hidden = !(r.valid && r.night > 0);
  $('r-night-wrap').querySelector('dt').textContent = p.bakery ? 'Nachtarbeit (22–5 Uhr)' : 'Nachtarbeit (23–6 Uhr)';
  $('r-night').textContent = `${formatHM(r.night || 0)} h`;
  const sur = r.valid && info.surcharge ? info.surcharge.cents : 0;
  const showPay = shown !== null && shown > 0 && p.wage > 0;
  $('r-pay-wrap').hidden = !showPay;
  if (showPay) $('r-pay').textContent = formatEuro(wageCents(shown, p.wage) + sur);
  $('r-sur-wrap').hidden = !(showPay && sur > 0);
  $('r-sur').textContent = formatEuro(sur);
  const hasDiff = type === 'work' ? r.valid && !running : true;
  $('r-diff-wrap').hidden = !hasDiff;
  $('r-diff').textContent = `${formatHM(info.diff, { sign: true })} h`;
  $('r-diff').className = signCls(info.diff);

  const st = $('d-stamp');
  const todays = state.entries[todayIso()];
  const clockedIn = !!(todays && (!todays.type || todays.type === 'work') && todays.start && !todays.end);
  st.textContent = clockedIn ? `Eingestempelt seit ${todays.start} Uhr` : 'Stempeluhr: speichert die aktuelle Uhrzeit';
  st.classList.toggle('run', clockedIn);
  $('d-in').classList.toggle('on', clockedIn);
  clearInterval(stampTimer);
  if (running) stampTimer = setInterval(() => { if (state.tab === 'tag' && document.activeElement?.tagName !== 'INPUT') computeDay(); }, 30000);

  const notes = [...r.warnings];
  if (info.holiday) notes.push({ level: 'info', code: 'holiday', text: `Gesetzlicher Feiertag: ${info.holiday}. Das Soll für diesen Tag entfällt.` });
  if (type === 'urlaub' || type === 'krank') notes.push({ level: 'info', code: 'credit', text: info.credit ? `${DAY_TYPES[type]}: Deine tägliche Sollzeit von ${formatHM(info.credit)} h wird gutgeschrieben.` : `${DAY_TYPES[type]}: An diesem Tag hast du kein Soll – es wird nichts gutgeschrieben.` });
  if (type === 'ausgleich') notes.push({ level: 'info', code: 'comp', text: 'Überstundenabbau: Der Tag zählt mit 0 Stunden und verringert dein Überstundenkonto um die Sollzeit.' });
  if (running) notes.push({ level: 'info', code: 'run', text: `Die Schicht läuft seit ${d.start} Uhr. Tippe auf „Gehen“, wenn du Feierabend machst.` });
  if (r.valid) {
    const neighbours = [addDays(state.day, -1), addDays(state.day, 1)]
      .map((date) => state.entries[date] && { ...state.entries[date], date }).filter(Boolean);
    const rest = restViolations([{ ...calcIn, date: state.day }, ...neighbours], p.minor);
    for (const v of rest) {
      const other = v.date === state.day ? v.prevDate : v.date;
      notes.push({ level: 'warn', code: 'rest', text: `${v.text} – zur Schicht am ${fmtDate(other, { weekday: 'short', day: '2-digit', month: '2-digit' })}.` });
    }
    if (p.wage > 0 && belowMinWage(p.wage, state.day)) {
      notes.push({ level: 'warn', code: 'minwage', text: `Dein Stundenlohn liegt unter dem gesetzlichen Mindestlohn von ${formatEuro(Math.round(minWageAt(state.day) * 100))} pro Stunde.` });
    }
    if (p.surcharges?.enabled && !(p.wage > 0)) notes.push({ level: 'info', code: 'surwage', text: 'Für Zuschläge bitte in den Einstellungen einen Stundenlohn eintragen.' });
  }
  const hasProblem = notes.some((n) => n.level === 'warn' || n.level === 'error');
  let html = notes.map((w) => (w.code === 'break' && r.missing > 0
    ? `<li class="note ${w.level} note-act"><span>${esc(w.text)}</span><button type="button" class="btn-fix" id="d-fix-break" data-missing="${r.missing}">Pause automatisch anpassen</button></li>`
    : `<li class="note ${w.level}">${esc(w.text)}</li>`)).join('');
  if (r.valid && !running && !hasProblem && r.net > 0) html = `<li class="note ok">Pausen und Höchstarbeitszeit nach Arbeitszeitgesetz eingehalten.</li>${html}`;
  if (type === 'work' && !r.valid) html = `<li class="note info">Gib Beginn und Ende ein, zum Beispiel 8 und 1630.</li>${noteHtml(notes.filter((n) => n.code === 'holiday'))}`;
  $('r-notes').innerHTML = html;
  return { d, r };
}

const saveDaySoon = debounce(async () => {
  const d = readDay();
  if (d.type === 'work') {
    const okStart = parseTime(d.start) !== null;
    const okEnd = parseTime(d.end) !== null;
    // unvollständig – noch nicht speichern (nur Beginn ist erlaubt: Stempeluhr)
    if ((d.start && !okStart) || (d.end && !okEnd) || (!d.start && d.end)) return;
  }
  await saveEntry(state.day, d);
  updateSaveState();
}, 400);

function onDayInput() {
  state.dayDirty = true;
  computeDay();
  saveDaySoon();
}

function loadDay(date) {
  state.day = date;
  state.dayDirty = false;
  $('d-date').value = date;
  const e = state.entries[date];
  if (e) writeDay(e);
  else if (date !== todayIso() || state.dayTouched) writeDay(null);
  computeDay();
  updateSaveState();
}

function bindDay() {
  const form = $('tag');
  form.addEventListener('input', (e) => {
    if (e.target.id === 'd-date') return;
    state.dayTouched = true;
    onDayInput();
  });
  form.addEventListener('change', (e) => {
    if (e.target.classList.contains('brk-kind')) {
      const row = e.target.closest('.brk');
      const breaks = readBreaks();
      const idx = [...$('d-breaks').children].indexOf(row);
      breaks[idx] = e.target.value === 'range' ? { kind: 'range', from: '', to: '' } : { kind: 'min', minutes: null };
      renderBreaks(breaks);
      $('d-breaks').children[idx].querySelector('input').focus();
      onDayInput();
    }
  });
  form.addEventListener('focusout', (e) => {
    if (e.target.classList.contains('in-time')) normalizeTimeInput(e.target);
  });
  $('calc').addEventListener('focusin', (e) => {
    if (e.target.matches('input.in-time, input.in-num')) e.target.select();
  });
  $('d-start').addEventListener('input', (e) => {
    const v = e.target.value;
    if (e.inputType && e.inputType.startsWith('insert') && (/^\d{4}$/.test(v) || /^\d{1,2}:\d{2}$/.test(v)) && parseTime(v) !== null) {
      normalizeTimeInput(e.target);
      $('d-end').focus();
    }
  });
  form.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !e.target.matches('input.in-time, input.in-num')) return;
    e.preventDefault();
    const list = [...form.querySelectorAll('#d-start, #d-end, #d-breaks input')];
    const next = list[list.indexOf(e.target) + 1];
    if (next) next.focus(); else e.target.blur();
  });
  $('d-in').addEventListener('click', async () => {
    const t = todayIso();
    const cur = state.entries[t];
    if (cur && (cur.end || (cur.type && cur.type !== 'work'))) {
      if (state.day !== t) loadDay(t);
      return toast('Für heute gibt es schon einen Eintrag.');
    }
    if (cur && cur.start) { if (state.day !== t) loadDay(t); return toast(`Du bist seit ${cur.start} Uhr eingestempelt.`); }
    state.dayTouched = true;
    await saveEntry(t, { start: formatClock(nowMin()), end: '', breaks: [], type: 'work' });
    loadDay(t);
    toast(`Kommen gespeichert: ${state.entries[t].start} Uhr`);
  });
  $('d-out').addEventListener('click', async () => {
    const t = todayIso();
    let cur = state.entries[t];
    // Nachtschicht: gestern eingestempelt und noch offen
    let date = t;
    const y = addDays(t, -1);
    if (!(cur && cur.start && !cur.end) && state.entries[y] && state.entries[y].start && !state.entries[y].end) { cur = state.entries[y]; date = y; }
    if (!cur || !cur.start || (cur.type && cur.type !== 'work')) return toast('Bitte zuerst „Kommen“ tippen oder den Beginn eintragen.');
    state.dayTouched = true;
    const end = formatClock(nowMin());
    await saveEntry(date, { start: cur.start, end, breaks: cur.breaks || [], type: 'work' });
    loadDay(date);
    toast(`Gehen gespeichert: ${end} Uhr`);
  });
  $('r-notes').addEventListener('click', (e) => {
    const btn = e.target.closest('#d-fix-break');
    if (!btn) return;
    const missing = +btn.dataset.missing || 0;
    if (!missing) return;
    const breaks = readBreaks().filter((b) => (b.kind === 'min' ? b.minutes : b.from || b.to));
    // Vorhandene Minutenpause (ab 15 Min.) verlängern, sonst neue Pause anlegen
    const target = breaks.find((b) => b.kind === 'min' && b.minutes >= 15);
    if (target) target.minutes += missing;
    else breaks.push({ kind: 'min', minutes: Math.max(missing, 15) });
    renderBreaks(breaks);
    state.dayTouched = true;
    onDayInput();
    toast(`Pause um ${missing} Min. ergänzt`);
    $('r-copy').focus({ preventScroll: true });
  });
  $('d-type').addEventListener('change', () => {
    state.dayTouched = true;
    onDayInput();
  });
  $('d-date').addEventListener('change', () => {
    if ($('d-date').value) { state.dayTouched = true; loadDay($('d-date').value); }
  });
  $('d-add-break').addEventListener('click', () => {
    const b = readBreaks();
    b.push({ kind: 'min', minutes: null });
    renderBreaks(b);
    const rows = $('d-breaks').children;
    rows[rows.length - 1].querySelector('input').focus();
  });
  $('d-breaks').addEventListener('click', (e) => {
    const del = e.target.closest('.brk-del');
    if (!del) return;
    const idx = [...$('d-breaks').children].indexOf(del.closest('.brk'));
    const b = readBreaks();
    b.splice(idx, 1);
    renderBreaks(b);
    onDayInput();
    $('d-add-break').focus();
  });
  document.querySelector('.chips').addEventListener('click', (e) => {
    const c = e.target.closest('[data-tpl]');
    if (!c) return;
    if (state.day !== $('d-date').value && $('d-date').value) state.day = $('d-date').value;
    const [s, en, br] = c.dataset.tpl.split('|');
    writeDay({ start: s, end: en, breaks: [{ kind: 'min', minutes: +br }] });
    state.dayTouched = true;
    onDayInput();
  });
  $('d-copy-prev').addEventListener('click', () => {
    const prev = state.entries[addDays(state.day, -1)];
    if (!prev) return;
    writeDay({ start: prev.start, end: prev.end, breaks: JSON.parse(JSON.stringify(prev.breaks || [])) });
    state.dayTouched = true;
    onDayInput();
    toast('Vortag übernommen');
  });
  $('d-clear').addEventListener('click', async () => {
    await saveEntry(state.day, { start: '', end: '' });
    state.dayTouched = true;
    writeDay(null);
    state.dayDirty = false;
    computeDay();
    updateSaveState();
    toast('Eintrag gelöscht');
  });
  $('r-copy').addEventListener('click', async () => {
    const text = `${$('r-hm').textContent} h (${$('r-dec').textContent} h)`;
    try { await navigator.clipboard.writeText(text); toast(`Kopiert: ${text}`); } catch { toast(text); }
  });
}

/* ---------- Woche ---------- */

function isSimpleBreaks(b) {
  return !b || b.length === 0 || (b.length === 1 && b[0].kind === 'min');
}
function breakSum(b) {
  return (b || []).reduce((a, x) => a + (x.kind === 'min' ? (x.minutes || 0) : ((parseTime(x.to) - parseTime(x.from) + 1440) % 1440 || 0)), 0);
}

function renderWeek() {
  const w = weekSummary(state.entries, state.week, state.profile);
  const sun = addDays(w.monday, 6);
  $('w-title').innerHTML = `KW ${w.week}<small>${fmtDate(w.monday, { day: '2-digit', month: '2-digit' })} – ${fmtDate(sun, { day: '2-digit', month: '2-digit', year: 'numeric' })}</small>`;
  $('w-body').innerHTML = w.days.map((d) => {
    const e = d.entry;
    const wd = parseIso(d.date).getDay();
    const simple = isSimpleBreaks(e?.breaks);
    const pause = e ? breakSum(e.breaks) : '';
    const cells = d.type !== 'work'
      ? `<td class="wtype" colspan="3">${typeTag(d)}</td>`
      : `<td data-l="Beginn"><input class="in in-time" data-f="start" type="text" inputmode="numeric" autocomplete="off" value="${esc(e?.start || '')}" aria-label="${WEEKDAYS[wd]} Beginn"></td>
      <td data-l="Ende"><input class="in in-time" data-f="end" type="text" inputmode="numeric" autocomplete="off" value="${esc(e?.end || '')}" aria-label="${WEEKDAYS[wd]} Ende"></td>
      <td data-l="Pause"><input class="in in-num" data-f="pause" type="text" inputmode="numeric" autocomplete="off" value="${pause === 0 ? '0' : pause}" ${simple ? '' : `readonly title="Mehrere Pausen – im Tagesrechner bearbeiten"`} aria-label="${WEEKDAYS[wd]} Pause in Minuten"></td>`;
    return `<tr class="day-row${wd === 0 || wd === 6 ? ' weekend' : ''}${d.date === todayIso() ? ' today' : ''}" data-date="${d.date}">
      <td class="day"><button type="button" class="btn-link w-open" data-date="${d.date}" aria-label="${WEEKDAYS[wd]} ${fmtDate(d.date, { day: '2-digit', month: '2-digit' })} im Tagesrechner öffnen">${WEEKDAYS_SHORT[wd]} ${fmtDate(d.date, { day: '2-digit', month: '2-digit' })}</button> <span class="netm" data-netm></span>${holTag(d)}</td>
      ${cells}
      <td class="num net" data-net></td>
      <td class="num diff" data-diff></td>
    </tr><tr class="rowwarn" data-warn="${d.date}" hidden><td colspan="6"><ul class="notes"></ul></td></tr>`;
  }).join('');
  updateWeekComputed();
}

function updateWeekComputed() {
  const w = weekSummary(state.entries, state.week, state.profile);
  const rest = restViolations(
    [addDays(w.monday, -1), ...w.days.map((d) => d.date)].map((d) => state.entries[d] && { ...state.entries[d], date: d }).filter(Boolean),
    state.profile.minor,
  );
  for (const d of w.days) {
    const tr = $('w-body').querySelector(`tr[data-date="${d.date}"]`);
    if (!tr) continue;
    const valid = d.valid;
    const has = valid || d.credit > 0;
    tr.querySelector('[data-net]').textContent = has ? `${formatHM(d.net + d.credit)} h` : '–';
    tr.querySelector('[data-netm]').textContent = has ? `· ${formatHM(d.net + d.credit)} h` : '';
    const diffEl = tr.querySelector('[data-diff]');
    const show = (valid || d.soll > 0 || d.type !== 'work') && !isFutureEmpty(d);
    diffEl.textContent = show ? formatHM(d.diff, { sign: true }) : '';
    diffEl.className = `num diff ${signCls(d.diff)}`;
    const notes = (valid ? d.result.warnings.filter((x) => x.level !== 'info' || x.code === 'max') : [])
      .concat(rest.filter((v) => v.date === d.date).map((v) => ({ level: 'warn', text: v.text })));
    const wr = $('w-body').querySelector(`tr[data-warn="${d.date}"]`);
    wr.hidden = !notes.length;
    wr.querySelector('ul').innerHTML = noteHtml(notes);
  }
  const p = state.profile;
  const wToDate = saldoToDate(w.days);
  let html = sumBox('Ist', `${formatHM(w.total + w.credit)} h`, w.credit ? `davon ${formatHM(w.credit)} h Urlaub/Krank` : `${formatDecimal(w.total)} h dezimal`)
    + sumBox('Soll', `${formatHM(w.soll)} h`, `${w.days.filter((d) => d.soll > 0).length} Arbeitstage`)
    + sumBox('Saldo', `${formatHM(w.saldo, { sign: true })} h`, wToDate !== null ? `bis heute: ${formatHM(wToDate, { sign: true })} h` : (w.saldo > 0 ? 'Überstunden' : w.saldo < 0 ? 'Minusstunden' : 'ausgeglichen'), signCls(w.saldo));
  html += p.wage > 0 ? sumBox('Brutto', formatEuro(w.pay), w.surchargeCents ? `inkl. ${formatEuro(w.surchargeCents)} Zuschläge` : `${formatEuro(Math.round(p.wage * 100))}/h`) : sumBox('Nachtarbeit', `${formatHM(w.night)} h`, p.bakery ? '22–5 Uhr' : '23–6 Uhr');
  $('w-sum').innerHTML = html;
  const notes = [];
  if (!p.minor && w.total > 48 * 60) notes.push({ level: 'info', text: 'Mehr als 48 Stunden in dieser Woche: Das ist nur zulässig, wenn du im Schnitt von 6 Monaten auf höchstens 48 Stunden pro Woche kommst.' });
  if (p.minor && w.total > 40 * 60) notes.push({ level: 'error', text: 'Jugendliche dürfen höchstens 40 Stunden pro Woche arbeiten (§ 8 JArbSchG).' });
  if (!Object.keys(state.entries).length) notes.push({ level: 'info', text: 'Trage Beginn, Ende und Pause pro Tag ein – alles wird automatisch in deinem Browser gespeichert.' });
  $('w-notes').innerHTML = noteHtml(notes);
}

const weekTimers = {};
function saveWeekRow(date) {
  clearTimeout(weekTimers[date]);
  weekTimers[date] = setTimeout(() => saveWeekRowNow(date), 350);
}
async function saveWeekRowNow(date) {
  const tr = $('w-body').querySelector(`tr[data-date="${date}"]`);
  if (!tr) return;
  if (!tr.querySelector('[data-f="start"]')) return;
  const val = (f) => tr.querySelector(`[data-f="${f}"]`).value.trim();
  const s = parseTime(val('start'));
  const e = parseTime(val('end'));
  const old = state.entries[date];
  if ((val('start') || val('end')) && (s === null || e === null)) return;
  const breaks = isSimpleBreaks(old?.breaks)
    ? (() => { const m = parseMinutes(val('pause')); return m ? [{ kind: 'min', minutes: m }] : []; })()
    : old.breaks;
  await saveEntry(date, { start: s === null ? '' : formatClock(s), end: e === null ? '' : (e === 1440 ? '24:00' : formatClock(e)), breaks, type: 'work' });
  updateWeekComputed();
  if (date === state.day) loadDay(date);
}

function bindWeek() {
  $('w-prev').addEventListener('click', () => { state.week = addDays(mondayOf(state.week), -7); renderWeek(); });
  $('w-next').addEventListener('click', () => { state.week = addDays(mondayOf(state.week), 7); renderWeek(); });
  $('w-body').addEventListener('input', (e) => {
    const tr = e.target.closest('tr[data-date]');
    if (!tr) return;
    const f = e.target.dataset.f;
    // Pause vorbelegen, wenn ein neuer Tag begonnen wird
    const pauseEl = tr.querySelector('[data-f="pause"]');
    if ((f === 'start' || f === 'end') && !state.entries[tr.dataset.date] && pauseEl.value === '') pauseEl.value = '30';
    saveWeekRow(tr.dataset.date);
  });
  $('w-body').addEventListener('focusout', (e) => {
    if (e.target.classList.contains('in-time')) normalizeTimeInput(e.target);
  });
  $('w-body').addEventListener('click', (e) => {
    const b = e.target.closest('.w-open');
    if (b) openDay(b.dataset.date);
  });
  $('w-fill').addEventListener('click', async () => {
    const w = weekSummary(state.entries, state.week, state.profile);
    const src = w.days.find((d) => d.valid);
    if (!src) return toast('Trage zuerst einen Tag mit Beginn und Ende ein.');
    const targets = w.days.filter((d) => !d.entry && d.soll > 0);
    if (!targets.length) return toast('Alle Arbeitstage dieser Woche sind schon ausgefüllt.');
    for (const d of targets) {
      await saveEntry(d.date, { start: src.entry.start, end: src.entry.end, breaks: JSON.parse(JSON.stringify(src.entry.breaks || [])), type: 'work' });
    }
    renderWeek();
    if (targets.some((d) => d.date === state.day)) loadDay(state.day);
    toast(`${targets.length} Tag${targets.length > 1 ? 'e' : ''} mit ${src.entry.start}–${src.entry.end} ausgefüllt`);
  });
}

function openDay(date) {
  state.dayTouched = true;
  loadDay(date);
  selectTab('tag', { scroll: true });
  $('d-start').focus({ preventScroll: true });
}

/* ---------- Monat ---------- */

function monthData() {
  const [y, m] = state.month;
  return monthSummary(state.entries, y, m, state.profile);
}

function renderMonth() {
  const [y, m] = state.month;
  const s = monthData();
  const p = state.profile;
  $('m-title').innerHTML = `${MONTHS[m - 1]} ${y}<small>${esc(p.name)}</small>`;
  const mToDate = saldoToDate(s.days);
  const lastIso = s.days[s.days.length - 1].date;
  const acc = accountBalance(state.entries, p, lastIso < todayIso() ? lastIso : todayIso());
  const absent = [s.count.urlaub && 'Urlaub', s.count.krank && 'Krank'].filter(Boolean).join('/');
  let html = sumBox('Ist', `${formatHM(s.total + s.credit)} h`, s.credit ? `davon ${formatHM(s.credit)} h ${absent}` : `${formatDecimal(s.total)} h dezimal`)
    + sumBox('Soll', `${formatHM(s.soll)} h`, `${s.days.filter((d) => d.soll > 0).length} Arbeitstage`)
    + sumBox('Saldo', `${formatHM(s.saldo, { sign: true })} h`, mToDate !== null ? `bis heute: ${formatHM(mToDate, { sign: true })} h` : `${formatDecimal(s.saldo, { sign: true })} h dezimal`, signCls(s.saldo))
    + (acc.start && acc.start <= lastIso
      ? sumBox('Überstundenkonto', `${formatHM(acc.balance, { sign: true })} h`, `Stand ${fmtDate(lastIso < todayIso() ? lastIso : todayIso(), { day: '2-digit', month: '2-digit' })}, seit ${fmtDate(acc.start, { day: '2-digit', month: '2-digit', year: '2-digit' })}`, signCls(acc.balance))
      : sumBox('Überstunden', `${formatHM(s.overtime)} h`, `${s.workedDays} Tage gearbeitet`));
  if (p.wage > 0) html += sumBox('Brutto', formatEuro(s.pay), s.surchargeCents ? `inkl. ${formatEuro(s.surchargeCents)} Zuschläge` : `${formatEuro(Math.round(p.wage * 100))}/h`);
  if (s.night > 0) html += sumBox('Nachtarbeit', `${formatHM(s.night)} h`, p.bakery ? '22–5 Uhr' : '23–6 Uhr');
  $('m-sum').innerHTML = html;

  const notes = [];
  for (const v of s.rest) notes.push({ level: 'warn', text: `${fmtDate(v.date, { weekday: 'short', day: '2-digit', month: '2-digit' })}: ${v.text}` });
  const over10 = s.days.filter((d) => d.result?.warnings.some((w) => w.code === 'max')).length;
  if (over10) notes.push({ level: 'error', text: `An ${over10} Tag${over10 > 1 ? 'en' : ''} mehr als ${p.minor ? 8 : 10} Stunden gearbeitet.` });
  const lack = s.days.filter((d) => d.result?.missing > 0).length;
  if (lack) notes.push({ level: 'warn', text: `An ${lack} Tag${lack > 1 ? 'en' : ''} fehlt Pflichtpause.` });
  if (p.wage > 0 && belowMinWage(p.wage, `${y}-${String(m).padStart(2, '0')}-01`)) notes.push({ level: 'warn', text: `Dein Stundenlohn liegt unter dem Mindestlohn von ${formatEuro(Math.round(minWageAt(`${y}-${String(m).padStart(2, '0')}-01`) * 100))}.` });
  if (!p.minijob) { /* Minijob-Check nur, wenn in den Einstellungen aktiviert */ } else if (s.overMinijob) notes.push({ level: 'warn', text: `Minijob-Check: Dein Monatsbrutto von ${formatEuro(s.pay)} liegt über der Minijob-Grenze von ${formatEuro(s.minijobLimit * 100)}.` });
  else if (p.wage > 0 && s.pay > 0) notes.push({ level: 'info', text: `Minijob-Check: Bis zur Grenze von ${formatEuro(s.minijobLimit * 100)} bleiben dir noch ${formatEuro(s.minijobLimit * 100 - s.pay)}.` });
  const nEntries = Object.keys(state.entries).length;
  if (nEntries >= 10 && (!state.lastBackup || Date.now() - state.lastBackup > 30 * 864e5)) notes.push({ level: 'info', text: 'Tipp: Sichere deine Einträge gelegentlich über „Datensicherung“ weiter unten – oder installiere den Rechner als App, dann bleiben sie dauerhaft erhalten.' });
  $('m-notes').innerHTML = noteHtml(notes);

  $('m-list').innerHTML = s.days.map((d) => {
    const wd = parseIso(d.date).getDay();
    const e = d.entry;
    const valid = d.valid;
    const warn = valid && (d.result.missing > 0 || d.result.warnings.some((w) => w.code === 'max') || s.rest.some((v) => v.date === d.date));
    const future = isFutureEmpty(d);
    const hol = d.holiday ? `<span class="tag h">${esc(d.holiday)}</span> ` : '';
    const times = hol + (valid ? `${e.start}–${e.end}${d.result.nextDay ? ' (+1)' : ''} · ${d.result.breakTotal} Min. Pause`
      : d.type !== 'work' ? typeTag(d)
        : e && e.start && !e.end ? `${e.start}– läuft` : (d.soll > 0 && !future ? 'kein Eintrag' : ''));
    return `<li class="${wd === 0 || wd === 6 ? 'we' : ''}${d.date === todayIso() ? ' today' : ''}"><button type="button" data-date="${d.date}" aria-label="${WEEKDAYS[wd]} ${fmtDate(d.date, { day: '2-digit', month: '2-digit' })} öffnen">
      <span class="md">${WEEKDAYS_SHORT[wd]} ${fmtDate(d.date, { day: '2-digit', month: '2-digit' })}</span>
      <span class="mt">${times}</span>
      <span class="mn${warn ? ' warn-dot' : ''}">${valid || d.credit ? `${formatHM(d.net + d.credit)} h` : ''}</span>
      <span class="mx ${signCls(d.diff)}">${(valid || d.soll || d.type === 'ausgleich') && !future ? formatHM(d.diff, { sign: true }) : ''}</span>
    </button></li>`;
  }).join('');
}

function bindMonth() {
  $('m-prev').addEventListener('click', () => {
    let [y, m] = state.month; m--; if (m < 1) { m = 12; y--; } state.month = [y, m]; renderMonth();
  });
  $('m-next').addEventListener('click', () => {
    let [y, m] = state.month; m++; if (m > 12) { m = 1; y++; } state.month = [y, m]; renderMonth();
  });
  $('m-list').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-date]');
    if (b) openDay(b.dataset.date);
  });
  document.querySelector('.export').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-export]');
    if (!b) return;
    const kind = b.dataset.export;
    const data = exportPayload();
    if (kind === 'print') return printMonth(data);
    try {
      const ex = await import('./export.js');
      const { name, blob } = ex.exportMonth(kind, data);
      download(name, blob);
    } catch (err) {
      toast('Export fehlgeschlagen. Bitte erneut versuchen.');
      console.error(err);
    }
  });
  $('b-export').addEventListener('click', async () => {
    const data = await store.exportAll();
    download(`arbeitszeit-backup-${todayIso()}.json`, new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
    state.lastBackup = Date.now();
    store.setMeta('lastBackup', state.lastBackup);
    renderMonth();
  });
  $('b-import').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const res = await store.importAll(JSON.parse(await file.text()));
      await loadProfiles();
      renderSettings();
      loadDay(state.day);
      renderMonth();
      toast(`${res.entries} Einträge wiederhergestellt`);
    } catch {
      toast('Die Datei konnte nicht gelesen werden.');
    }
    e.target.value = '';
  });
  $('m-share').addEventListener('click', async () => {
    const [y, m] = state.month;
    const prefix = `${y}-${String(m).padStart(2, '0')}-`;
    if (!Object.keys(state.entries).some((d) => d.startsWith(prefix))) return toast('In diesem Monat gibt es noch keine Einträge.');
    const url = `${location.origin}/#teilen=${encodeShare(state.entries, state.profile, y, m)}`;
    try {
      if (navigator.share) await navigator.share({ title: `Arbeitszeit ${MONTHS[m - 1]} ${y}`, url });
      else { await navigator.clipboard.writeText(url); toast('Link kopiert'); }
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      try { await navigator.clipboard.writeText(url); toast('Link kopiert'); } catch { toast('Der Link konnte nicht kopiert werden.'); }
    }
  });
  $('tpl-download').addEventListener('click', async () => {
    const ex = await import('./export.js');
    const { name, blob } = ex.excelTemplate(new Date().getFullYear(), new Date().getMonth() + 1);
    download(name, blob);
  });
}

function exportPayload() {
  const s = monthData();
  const [y, m] = state.month;
  const p = state.profile;
  return {
    year: y, month: m, title: `${MONTHS[m - 1]} ${y}`, profile: p.name, wage: p.wage || 0,
    rows: s.days.map((d) => {
      const wd = parseIso(d.date).getDay();
      const valid = d.valid;
      const note = [d.type !== 'work' ? DAY_TYPES[d.type] : '', d.holiday || ''].filter(Boolean).join(', ');
      return {
        date: d.date, dateDe: fmtDate(d.date, { day: '2-digit', month: '2-digit', year: 'numeric' }), weekday: WEEKDAYS_SHORT[wd],
        start: valid ? d.entry.start : '', end: valid ? d.entry.end : '', breakMin: valid ? d.result.breakTotal + d.result.deducted : '',
        net: valid ? d.net : (d.credit ? d.credit : null), soll: d.soll, diff: d.diff, night: valid ? d.result.night : 0, nextDay: valid && d.result.nextDay, note,
      };
    }),
    total: s.total + s.credit, soll: s.soll, saldo: s.saldo, overtime: s.overtime, pay: s.pay, night: s.night, surcharge: s.surchargeCents,
  };
}

function printMonth(data) {
  const area = $('print-area');
  area.innerHTML = `<h1>Stundenzettel ${esc(data.title)}</h1><p>${esc(data.profile)} · Name: ________________________</p>
    <table><thead><tr><th>Datum</th><th>Tag</th><th>Beginn</th><th>Ende</th><th>Pause</th><th>Arbeitszeit</th><th>Dezimal</th><th>+/−</th><th>Bemerkung</th></tr></thead><tbody>
    ${data.rows.map((r) => `<tr><td>${r.dateDe}</td><td>${r.weekday}</td><td>${r.start}</td><td>${r.end}${r.nextDay ? ' (+1)' : ''}</td><td>${r.breakMin === '' ? '' : `${r.breakMin} Min.`}</td><td>${r.net === null ? '' : formatHM(r.net)}</td><td>${r.net === null ? '' : formatDecimal(r.net)}</td><td>${r.net === null && !r.soll ? '' : formatHM(r.diff, { sign: true })}</td><td>${esc(r.note)}</td></tr>`).join('')}
    </tbody></table>
    <p><strong>Summe: ${formatHM(data.total)} h (${formatDecimal(data.total)} h)</strong> · Soll ${formatHM(data.soll)} h · Saldo ${formatHM(data.saldo, { sign: true })} h${data.wage ? ` · Brutto ${formatEuro(data.pay)}${data.surcharge ? ` (inkl. ${formatEuro(data.surcharge)} Zuschläge)` : ''}` : ''}</p>
    <div class="sig"><div>Datum, Unterschrift Arbeitnehmer/in</div><div>Datum, Unterschrift Arbeitgeber/in</div></div>
    <p style="font-size:8pt;color:#555">Erstellt mit derarbeitszeitrechner.de</p>`;
  document.body.classList.add('printing');
  const done = () => { document.body.classList.remove('printing'); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  window.print();
  setTimeout(done, 1000);
}

/* ---------- Feierabend ---------- */

let quitTimer = null;
function renderQuit() {
  const q = quittingTime({
    start: $('f-start').value, target: $('f-target').value,
    breakMinutes: parseMinutes($('f-break').value) || 0, minor: state.profile.minor,
  });
  if (!q) {
    $('f-end').textContent = '–:––';
    $('f-detail').textContent = 'Beginn und Sollzeit eingeben';
    $('f-left-wrap').hidden = true;
    return;
  }
  $('f-end').textContent = formatClock(q.end);
  $('f-next').hidden = !q.nextDay;
  $('f-detail').textContent = q.breakUsed
    ? `inkl. ${q.breakUsed} Min. Pause${q.required && q.breakUsed === q.required ? ' (gesetzliche Mindestpause)' : ''}`
    : 'ohne Pause – bis 6 Stunden ist keine Pause vorgeschrieben';
  $('f-latest').textContent = `${formatClock(q.latest)} Uhr${q.latestNextDay ? ' (+1 Tag)' : ''}`;
  $('f-latest').previousElementSibling.textContent = `Spätestens (${state.profile.minor ? '8' : '10'} h Höchstarbeitszeit)`;
  const s = parseTime($('f-start').value);
  const now = nowMin();
  const left = q.end - now;
  const running = s !== null && now >= s && left > 0;
  $('f-left-wrap').hidden = !running;
  if (running) $('f-left').textContent = `${formatHM(left)} h`;
  clearInterval(quitTimer);
  if (running) quitTimer = setInterval(() => { if (state.tab === 'feierabend') renderQuit(); }, 30000);
}

function bindQuit() {
  const p = $('feierabend');
  p.addEventListener('input', renderQuit);
  p.addEventListener('focusout', (e) => { if (e.target.id === 'f-start') { normalizeTimeInput(e.target); renderQuit(); } });
}

/* ---------- Addieren ---------- */

function renderAddRows() {
  if (!state.addRows.length) state.addRows = [{ op: '+', value: '' }, { op: '+', value: '' }, { op: '+', value: '' }];
  $('a-rows').innerHTML = state.addRows.map((r, i) => `<div class="arow">
    <select class="in" data-i="${i}" data-k="op" aria-label="Zeile ${i + 1}: addieren oder abziehen"><option value="+"${r.op === '+' ? ' selected' : ''}>+</option><option value="-"${r.op === '-' ? ' selected' : ''}>−</option></select>
    <input class="in in-val" data-i="${i}" data-k="value" type="text" inputmode="decimal" autocomplete="off" placeholder="${['7:45', '8:00-12:30', '3,5'][i % 3]}" value="${esc(r.value)}" aria-label="Zeile ${i + 1}: Dauer oder Zeitraum">
  </div>`).join('');
  computeAdd();
}
function computeAdd() {
  const s = sumRows(state.addRows);
  $('a-hm').textContent = formatHM(s.total);
  $('a-dec').textContent = formatDecimal(s.total);
  $('a-plus').textContent = `${formatHM(s.plus)} h`;
  $('a-minus').textContent = `${formatHM(s.minus)} h`;
}
const saveAdd = debounce(() => store.setMeta('addRows', state.addRows), 500);
function bindAdd() {
  $('a-rows').addEventListener('input', (e) => {
    const i = +e.target.dataset.i;
    state.addRows[i][e.target.dataset.k] = e.target.value;
    computeAdd();
    saveAdd();
  });
  $('a-rows').addEventListener('change', (e) => {
    if (e.target.dataset.k === 'op') { state.addRows[+e.target.dataset.i].op = e.target.value; computeAdd(); saveAdd(); }
  });
  $('a-rows').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.dataset.k === 'value') {
      e.preventDefault();
      const i = +e.target.dataset.i;
      if (i === state.addRows.length - 1) { state.addRows.push({ op: '+', value: '' }); renderAddRows(); }
      $('a-rows').querySelector(`input[data-i="${i + 1}"]`).focus();
    }
  });
  $('a-add').addEventListener('click', () => {
    state.addRows.push({ op: '+', value: '' });
    renderAddRows();
    $('a-rows').querySelector(`input[data-i="${state.addRows.length - 1}"]`).focus();
  });
  $('a-reset').addEventListener('click', () => { state.addRows = []; renderAddRows(); saveAdd(); });
}

/* ---------- Dezimal ---------- */

function computeDec() {
  const a = parseDuration($('z-hm').value);
  $('z-hm-out').textContent = a === null ? '–' : formatDecimal(a);
  const raw = $('z-dec').value.trim().replace(/h$/i, '');
  const b = /^-?\d*[.,]?\d*$/.test(raw) && raw ? parseDuration(raw.includes(',') || raw.includes('.') ? raw : `${raw},0`) : null;
  $('z-dec-out').textContent = b === null ? '–' : formatHM(b);
  const c = $('z-min').value.trim();
  $('z-min-out').textContent = /^\d+$/.test(c) ? formatDecimal(+c) : '–';
}
function bindDec() {
  $('dezimal').addEventListener('input', computeDec);
}

/* ---------- Einstellungen ---------- */

function renderSettings() {
  const p = state.profile;
  $('p-select').innerHTML = state.profiles.map((x) => `<option value="${x.id}"${x.id === p.id ? ' selected' : ''}>${esc(x.name)}</option>`).join('');
  $('p-name').value = p.name;
  $('p-weekly').value = String((p.weeklyMinutes ?? 2400) / 60).replace('.', ',');
  $('p-wage').value = p.wage ? String(p.wage).replace('.', ',') : '';
  $('p-minor').checked = !!p.minor;
  $('p-auto').checked = !!p.autoDeduct;
  $('p-bakery').checked = !!p.bakery;
  $('p-minijob').checked = !!p.minijob;
  $('p-state').innerHTML = `<option value="">Nur bundesweite Feiertage</option>${Object.entries(STATES).map(([k, v]) => `<option value="${k}"${p.state === k ? ' selected' : ''}>${v}</option>`).join('')}`;
  $('p-balance').value = p.startBalance ? formatHM(p.startBalance).replace('−', '-') : '';
  const sc = p.surcharges;
  $('p-sur').checked = !!sc.enabled;
  $('p-sur-box').hidden = !sc.enabled;
  for (const k of ['night', 'night04', 'sunday', 'holiday', 'special']) $(`p-sur-${k}`).value = String(sc[k]).replace('.', ',');
  $('p-days').innerHTML = [1, 2, 3, 4, 5, 6, 0].map((d) => `<label><input type="checkbox" value="${d}"${p.workdays.includes(d) ? ' checked' : ''} aria-label="${WEEKDAYS[d]}">${WEEKDAYS_SHORT[d]}</label>`).join('');
  $('p-delete').hidden = state.profiles.length < 2;
  $('p-delete').textContent = 'Diesen Job löschen';
  delete $('p-delete').dataset.confirm;
  $('f-target').value = formatHM(dailyTarget(p));
}

function refreshAll() {
  computeDay();
  if (state.tab === 'woche') updateWeekComputed();
  if (state.tab === 'monat') renderMonth();
  if (state.tab === 'feierabend') renderQuit();
}

const saveProfileSoon = debounce(saveProfile, 300);

function bindSettings() {
  const num = (v) => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
  $('settings').addEventListener('input', (e) => {
    const p = state.profile;
    const id = e.target.id;
    if (id === 'p-name') {
      p.name = e.target.value.trim() || 'Mein Job';
      $('p-select').querySelector(`option[value="${p.id}"]`).textContent = p.name;
    } else if (id === 'p-weekly') {
      const h = num(e.target.value);
      if (h !== null && h >= 0 && h <= 100) { p.weeklyMinutes = Math.round(h * 60); $('f-target').value = formatHM(dailyTarget(p)); }
    } else if (id === 'p-wage') {
      const w = num(e.target.value);
      p.wage = w && w > 0 ? Math.round(w * 100) / 100 : null;
    } else if (id === 'p-minor') p.minor = e.target.checked;
    else if (id === 'p-auto') p.autoDeduct = e.target.checked;
    else if (id === 'p-bakery') p.bakery = e.target.checked;
    else if (id === 'p-minijob') p.minijob = e.target.checked;
    else if (id === 'p-state') p.state = e.target.value;
    else if (id === 'p-balance') {
      const v = e.target.value.trim();
      const m = v === '' ? 0 : parseDuration(v);
      if (m === null) return;
      p.startBalance = m;
    } else if (id === 'p-sur') { p.surcharges.enabled = e.target.checked; $('p-sur-box').hidden = !e.target.checked; }
    else if (id.startsWith('p-sur-')) {
      const n = num(e.target.value);
      if (n === null || n < 0 || n > 500) return;
      p.surcharges[id.slice(6)] = n;
    }
    else if (e.target.closest('#p-days')) {
      p.workdays = [...$('p-days').querySelectorAll('input:checked')].map((x) => +x.value);
      $('f-target').value = formatHM(dailyTarget(p));
    } else return;
    saveProfileSoon();
    refreshAll();
  });
  $('p-select').addEventListener('change', async (e) => {
    await switchProfile(e.target.value);
  });
  $('p-new').addEventListener('click', async () => {
    const base = state.profile;
    const p = { ...DEFAULT_PROFILE(), name: `Job ${state.profiles.length + 1}`, weeklyMinutes: base.weeklyMinutes, workdays: [...base.workdays], state: base.state || '' };
    state.profiles.push(p);
    await store.put('profiles', p);
    await switchProfile(p.id);
    $('p-name').focus();
    $('p-name').select();
  });
  $('p-delete').addEventListener('click', async (e) => {
    const b = e.currentTarget;
    if (!b.dataset.confirm) {
      b.dataset.confirm = '1';
      b.textContent = `Wirklich „${state.profile.name}“ mit allen Einträgen löschen? Nochmal tippen.`;
      return;
    }
    const id = state.profile.id;
    await store.deleteProfileEntries(id);
    await store.del('profiles', id);
    state.profiles = state.profiles.filter((p) => p.id !== id);
    await switchProfile(state.profiles[0].id);
    toast('Job gelöscht');
  });
}

async function switchProfile(id) {
  state.profile = state.profiles.find((p) => p.id === id) || state.profiles[0];
  await store.setMeta('activeProfile', state.profile.id);
  await loadEntries();
  renderSettings();
  state.dayTouched = true;
  loadDay(state.day);
  refreshAll();
}

/* ---------- Lohn (Gehalt ↔ Stundenlohn) ---------- */

const numDe = (v) => { const n = parseFloat(String(v).trim().replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
function numFlex(v) {
  const t = String(v).trim();
  // "3.000" oder "3.000,50" = Tausenderpunkt; "17.5" = Dezimalpunkt
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) return numDe(t);
  const n = parseFloat(t.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
function computeSalary() {
  const sal = numFlex($('g-salary').value);
  const hrs = numFlex($('g-hours').value);
  const rate = salaryToHourly(sal, hrs);
  $('g-rate').textContent = rate === null ? '–' : formatEuro(Math.round(rate * 100));
  $('g-detail').textContent = rate === null ? 'Monatsgehalt und Wochenstunden eingeben' : `${formatEuro(Math.round(sal * 100))} × 3 ÷ 13 ÷ ${String(hrs).replace('.', ',')} Stunden`;
  const notes = [];
  if (rate !== null) {
    const min = minWageAt(todayIso());
    notes.push(rate < min
      ? { level: 'warn', text: `Das liegt unter dem gesetzlichen Mindestlohn von ${formatEuro(Math.round(min * 100))} pro Stunde.` }
      : { level: 'ok', text: `Über dem gesetzlichen Mindestlohn von ${formatEuro(Math.round(min * 100))} pro Stunde.` });
  }
  $('g-notes').innerHTML = noteHtml(notes);
  $('g-apply').hidden = rate === null;
  const back = hourlyToSalary(numFlex($('g-rate-in').value), hrs);
  $('g-salary-out').textContent = back === null ? '–' : formatEuro(Math.round(back * 100));
  return rate;
}
function bindSalary() {
  $('lohn').addEventListener('input', computeSalary);
  $('g-apply').addEventListener('click', async () => {
    const rate = computeSalary();
    if (rate === null) return;
    state.profile.wage = rate;
    await saveProfile();
    renderSettings();
    refreshAll();
    toast(`Stundenlohn ${formatEuro(Math.round(rate * 100))} übernommen`);
  });
}

/* ---------- Geteilter Monat (Daten nur im URL-Fragment) ---------- */

function showShared() {
  const m = location.hash.match(/^#teilen=([A-Za-z0-9_-]+)$/);
  const box = $('shared');
  if (!m) { box.hidden = true; return false; }
  const data = decodeShare(m[1]);
  if (!data) { box.hidden = true; toast('Der geteilte Link ist ungültig oder unvollständig.'); return false; }
  const s = monthSummary(data.entries, data.year, data.month, data.profile);
  const rows = s.days.filter((d) => d.entry).map((d) => {
    const wd = parseIso(d.date).getDay();
    return `<tr><td>${WEEKDAYS_SHORT[wd]} ${fmtDate(d.date, { day: '2-digit', month: '2-digit' })}</td><td>${d.valid ? `${esc(d.entry.start)}–${esc(d.entry.end)}` : esc(DAY_TYPES[d.type] || '')}</td><td>${d.valid ? `${d.result.breakTotal} Min.` : ''}</td><td><strong>${d.valid || d.credit ? formatHM(d.net + d.credit) : ''}</strong></td></tr>`;
  }).join('');
  box.innerHTML = `<h2>Geteilter Monat: ${MONTHS[data.month - 1]} ${data.year}</h2>
    <p class="hint">${esc(data.profile.name)} · nur Ansicht – deine eigenen Daten bleiben unverändert.</p>
    <div class="sum-grid">${sumBox('Ist', `${formatHM(s.total + s.credit)} h`, `${formatDecimal(s.total + s.credit)} h dezimal`)}${sumBox('Soll', `${formatHM(s.soll)} h`)}${sumBox('Saldo', `${formatHM(s.saldo, { sign: true })} h`, '', signCls(s.saldo))}${sumBox('Arbeitstage', String(s.workedDays))}</div>
    <div class="table-wrap"><table><thead><tr><th scope="col">Tag</th><th scope="col">Zeit</th><th scope="col">Pause</th><th scope="col">Stunden</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="btn-row"><button type="button" class="btn" id="s-import">Als neuen Job übernehmen</button><button type="button" class="btn-ghost" id="s-close">Schließen</button></div>`;
  box.hidden = false;
  const close = () => { box.hidden = true; history.replaceState(null, '', location.pathname); };
  $('s-close').addEventListener('click', close);
  $('s-import').addEventListener('click', async () => {
    const p = { ...DEFAULT_PROFILE(), ...data.profile, name: `${data.profile.name} (geteilt)` };
    state.profiles.push(p);
    await store.put('profiles', p);
    for (const [date, e] of Object.entries(data.entries)) {
      await store.put('entries', { key: `${p.id}|${date}`, profileId: p.id, date, start: e.start, end: e.end, breaks: e.breaks, type: e.type, updated: Date.now() });
    }
    await switchProfile(p.id);
    state.month = [data.year, data.month];
    close();
    selectTab('monat', { scroll: true });
    toast('Monat als neuer Job übernommen');
  });
  box.scrollIntoView({ block: 'start' });
  return true;
}

/* ---------- App installieren / offline ---------- */

function initPwa() {
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
  let deferred = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    $('install-box').hidden = false;
  });
  $('install').addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice.catch(() => {});
    deferred = null;
    $('install-box').hidden = true;
  });
  window.addEventListener('appinstalled', () => { $('install-box').hidden = true; });
}

/* ---------- Start ---------- */

async function init() {
  const now = new Date();
  state.month = [now.getFullYear(), now.getMonth() + 1];
  bindTabs();
  bindDay();
  bindWeek();
  bindMonth();
  bindQuit();
  bindAdd();
  bindDec();
  bindSettings();
  bindSalary();
  initPwa();
  try {
    await loadProfiles();
    state.addRows = (await store.getMeta('addRows', [])) || [];
    state.lastBackup = await store.getMeta('lastBackup', 0);
  } catch {
    state.profiles = [DEFAULT_PROFILE()];
    state.profile = state.profiles[0];
  }
  renderSettings();
  const t = todayIso();
  state.day = t;
  $('d-date').value = t;
  const todays = state.entries[t];
  if (todays) writeDay(todays);
  if (todays?.start) $('f-start').value = todays.start;
  computeDay();
  updateSaveState();
  computeDec();
  computeSalary();
  $('g-hours').value = String((state.profile.weeklyMinutes ?? 2400) / 60).replace('.', ',');
  computeSalary();
  const h = location.hash.slice(1);
  if (TABS.includes(h)) selectTab(h, { scroll: true, hash: false });
  else showShared();
  // Tageswechsel und Rückkehr in den Tab: Anzeige auffrischen
  document.addEventListener('visibilitychange', () => { if (!document.hidden && state.tab === 'tag' && document.activeElement?.tagName !== 'INPUT') computeDay(); });
}

init();

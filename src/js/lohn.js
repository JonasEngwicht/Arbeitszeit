// Oberfläche des Stundenlohnrechners (/stundenlohnrechner). Rechnet mit dem Rechenkern aus core.js.
import { salaryInfo, wageInfo, formatEuro, toIso } from './core.js';
import { netSalary, taxYearFor } from './netto.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const euro = (v) => formatEuro(Math.round(v * 100));
const dec = (v, digits = 2) => v.toFixed(digits).replace('.', ',');
const num = (v) => String(v).replace('.', ',');
const todayIso = () => toIso(new Date());

// "3.000" oder "3.000,50" = Tausenderpunkt; "17.5" = Dezimalpunkt
function numFlex(v) {
  const t = String(v).trim().replace(/\s|€/g, '');
  if (!t) return null;
  const n = /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t) ? parseFloat(t.replace(/\./g, '').replace(',', '.')) : parseFloat(t.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
const noteHtml = (list) => list.map((w) => `<li class="note ${w.level}">${esc(w.text)}</li>`).join('');

function notesFor(info, minijob) {
  const notes = [];
  notes.push(info.belowMinWage
    ? { level: 'warn', text: `Das liegt unter dem gesetzlichen Mindestlohn von ${euro(info.minWage)} pro Stunde.` }
    : { level: 'ok', text: `Über dem gesetzlichen Mindestlohn von ${euro(info.minWage)} pro Stunde.` });
  if (minijob) {
    const max = `Bei diesem Stundenlohn sind höchstens ${dec(info.minijobMaxHours, 1)} Stunden im Monat möglich.`;
    notes.push(info.overMinijob
      ? { level: 'warn', text: `Über der Minijob-Grenze von ${euro(info.minijobLimit)} im Monat. ${max}` }
      : { level: 'ok', text: `Innerhalb der Minijob-Grenze von ${euro(info.minijobLimit)} im Monat. ${max}` });
  }
  return notes;
}

function computeSalary() {
  const amount = numFlex($('s-amount').value);
  const hours = numFlex($('s-hours').value);
  const period = $('s-period').value;
  const info = salaryInfo({ amount, period, weeklyHours: hours, iso: todayIso() });
  $('s-copy').hidden = !info;
  renderNet(info, hours);
  if (!info) {
    $('s-rate').textContent = '–';
    $('s-detail').textContent = hours === 0 ? 'Wochenstunden müssen größer als 0 sein' : 'Gehalt und Wochenstunden eingeben';
    for (const id of ['s-month', 's-year', 's-mh']) $(id).textContent = '–';
    $('s-notes').innerHTML = '';
    return;
  }
  $('s-rate').textContent = euro(info.rate);
  $('s-detail').textContent = `${euro(info.monthly)} × 3 ÷ 13 ÷ ${num(hours)} Stunden`;
  $('s-month').textContent = euro(info.monthly);
  $('s-year').textContent = euro(info.yearly);
  $('s-mh').textContent = `${dec(info.monthlyHours)} h`;
  $('s-notes').innerHTML = noteHtml(notesFor(info, $('s-minijob').checked));
}

// Netto-Schätzung: Steuerklasse wählbar, sonst ohne Kinder und ohne Kirchensteuer
function renderNet(info, hours) {
  const out = $('s-net');
  if (!info) { out.textContent = '–'; return; }
  const year = taxYearFor(Number(todayIso().slice(0, 4)));
  const r = netSalary({ year, grossMonthly: info.monthly, taxClass: Number($('s-class').value), minijobLimit: info.minijobLimit });
  if (r.zone === 'minijob') {
    out.textContent = 'Minijob: Der Lohn wird in der Regel ohne Steuerabzug ausgezahlt.';
    return;
  }
  const perHour = Math.round(r.net / ((hours * 13) / 3));
  out.textContent = `ca. ${formatEuro(perHour)} netto pro Stunde · ${formatEuro(r.net)} im Monat${r.zone === 'midijob' ? ' (Übergangsbereich nicht eingerechnet, tatsächlich etwas mehr)' : ''}${r.draft ? ` · Werte ${r.year} vorläufig` : ''}`;
}

function computeWage() {
  const rate = numFlex($('w-rate').value);
  const hours = numFlex($('w-hours').value);
  const info = wageInfo({ rate, weeklyHours: hours, iso: todayIso() });
  $('w-copy').hidden = !info;
  if (!info) {
    $('w-month').textContent = '–';
    $('w-detail').textContent = hours === 0 ? 'Wochenstunden müssen größer als 0 sein' : 'Stundenlohn und Wochenstunden eingeben';
    for (const id of ['w-year', 'w-mh']) $(id).textContent = '–';
    $('w-notes').innerHTML = '';
    return;
  }
  $('w-month').textContent = euro(info.monthly);
  $('w-detail').textContent = `${euro(rate)} × ${num(hours)} Stunden × 13 ÷ 3`;
  $('w-year').textContent = euro(info.yearly);
  $('w-mh').textContent = `${dec(info.monthlyHours)} h`;
  $('w-notes').innerHTML = noteHtml(notesFor(info, $('s-minijob').checked));
}

function bindCopy(btn, source) {
  $(btn).addEventListener('click', async () => {
    const b = $(btn);
    try {
      await navigator.clipboard.writeText($(source).textContent);
      b.textContent = 'Kopiert';
    } catch {
      b.textContent = 'Nicht möglich';
    }
    setTimeout(() => { b.textContent = 'Kopieren'; }, 1600);
  });
}

function init() {
  $('salary').addEventListener('input', () => { computeSalary(); computeWage(); });
  $('salary').addEventListener('change', () => { computeSalary(); computeWage(); });
  $('wage').addEventListener('input', computeWage);
  bindCopy('s-copy', 's-rate');
  bindCopy('w-copy', 'w-month');
  computeSalary();
  computeWage();
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}
init();

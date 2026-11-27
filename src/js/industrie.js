// Oberfläche des Industrieminuten-Rechners (/industrieminuten-rechner). Rechnet mit dem Rechenkern aus core.js.
import {
  parseNormalTime, parseDecimalHours, spanInfo, formatHM, formatDecimal,
  minutesToIndustry, industryToMinutes,
} from './core.js';

const $ = (id) => document.getElementById(id);
const int = (v) => (/^\d{1,5}$/.test(String(v).trim()) ? +String(v).trim() : null);
const nf = (n) => n.toLocaleString('de-DE');
const mark = (el, bad) => { if (bad) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid'); };

/* ---------- 1: Normalzeit ⇄ Industriezeit (beide Felder steuern dasselbe Ergebnis) ---------- */
function showMain(min, source) {
  const ok = min !== null;
  $('c-copy').hidden = !ok;
  if (!ok) {
    $('c-out').textContent = '–';
    $('c-detail').textContent = source === 'hm' ? 'Zeit als Stunden:Minuten eingeben, zum Beispiel 7:45' : 'Industriezeit als Kommazahl eingeben, zum Beispiel 7,75';
    for (const id of ['c-min', 'c-ind']) $(id).textContent = '–';
    return;
  }
  const hm = formatHM(min);
  const dec = formatDecimal(min);
  if (source === 'hm') {
    $('c-label').textContent = 'Industriezeit';
    $('c-out').textContent = `${dec} h`;
    $('c-detail').textContent = `${hm} Stunden = ${dec} Industriestunden`;
  } else {
    $('c-label').textContent = 'Normalzeit';
    $('c-out').textContent = `${hm} h`;
    $('c-detail').textContent = `${dec} Industriestunden = ${Math.floor(min / 60)} Std. ${min % 60} Min.`;
  }
  $('c-min').textContent = `${nf(min)} Min.`;
  $('c-ind').textContent = nf(minutesToIndustry(min));
}
function fromHM() {
  const min = parseNormalTime($('c-hm').value);
  mark($('c-hm'), min === null && $('c-hm').value.trim() !== '');
  mark($('c-dec'), false);
  if (min !== null) $('c-dec').value = formatDecimal(min);
  showMain(min, 'hm');
}
function fromDec() {
  const min = parseDecimalHours($('c-dec').value);
  mark($('c-dec'), min === null && $('c-dec').value.trim() !== '');
  mark($('c-hm'), false);
  if (min !== null) $('c-hm').value = formatHM(min);
  showMain(min, 'dec');
}

/* ---------- 2: Arbeitszeit von–bis in Industriezeit ---------- */
function computeSpan() {
  const pause = $('v-break').value.trim() === '' ? 0 : int($('v-break').value);
  const info = pause === null ? null : spanInfo($('v-start').value, $('v-end').value, pause);
  $('v-copy').hidden = !info;
  if (!info) {
    $('v-out').textContent = '–';
    $('v-detail').textContent = 'Beginn, Ende und Pause in Minuten eingeben';
    for (const id of ['v-hm', 'v-gross']) $(id).textContent = '–';
    return;
  }
  $('v-out').textContent = `${formatDecimal(info.net)} h`;
  $('v-detail').textContent = `= ${formatHM(info.net)} Stunden Arbeitszeit${info.nextDay ? ' (Ende am nächsten Tag)' : ''}`;
  $('v-hm').textContent = `${formatHM(info.net)} h`;
  $('v-gross').textContent = `${formatHM(info.gross)} h`;
}

/* ---------- 3: Minuten ⇄ Industrieminuten ---------- */
function minToInd() {
  const m = int($('m-min').value);
  mark($('m-min'), m === null && $('m-min').value.trim() !== '');
  if (m !== null) $('m-ind').value = String((m / 0.6).toFixed(2)).replace(/\.?0+$/, '').replace('.', ',');
  $('m-out').textContent = m === null ? '–' : `${nf(m)} Minuten = ${$('m-ind').value} Industrieminuten = ${(m / 60).toFixed(2).replace('.', ',')} Stunden`;
}
function indToMin() {
  const raw = $('m-ind').value.trim().replace(',', '.');
  const i = /^\d{1,5}(\.\d{1,2})?$/.test(raw) ? parseFloat(raw) : null;
  mark($('m-ind'), i === null && raw !== '');
  if (i !== null) $('m-min').value = String(industryToMinutes(i));
  $('m-out').textContent = i === null ? '–' : `${$('m-ind').value.trim()} Industrieminuten = ${nf(industryToMinutes(i))} Minuten = ${(i / 100).toFixed(2).replace('.', ',')} Stunden`;
}

function bindCopy(btn, source) {
  $(btn).addEventListener('click', async () => {
    const b = $(btn);
    try {
      await navigator.clipboard.writeText($(source).textContent.replace(/\s*h$/, ''));
      b.textContent = 'Kopiert';
    } catch {
      b.textContent = 'Nicht möglich';
    }
    setTimeout(() => { b.textContent = 'Kopieren'; }, 1600);
  });
}

function init() {
  $('c-hm').addEventListener('input', fromHM);
  $('c-dec').addEventListener('input', fromDec);
  $('span').addEventListener('input', computeSpan);
  $('m-min').addEventListener('input', minToInd);
  $('m-ind').addEventListener('input', indToMin);
  bindCopy('c-copy', 'c-out');
  bindCopy('v-copy', 'v-out');
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}
init();

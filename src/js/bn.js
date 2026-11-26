// Oberfläche des Brutto-Netto-Rechners (/brutto-netto-rechner). Rechnet mit netto.js und core.js.
import { netSalary, grossForNet, TAX_YEARS, taxYearFor } from './netto.js';
import { hourlyToSalary, formatEuro, minijobAt, toIso } from './core.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const euro = (cents) => formatEuro(cents);
const pct = (v, digits = 2) => `${v.toFixed(digits).replace('.', ',').replace(/,?0+$/, '')} %`;
const noteHtml = (list) => list.map((w) => `<li class="note ${w.level}">${esc(w.text)}</li>`).join('');

// "3.000" oder "3.000,50" = Tausenderpunkt; "17.5" = Dezimalpunkt
function numFlex(v) {
  const t = String(v).trim().replace(/\s|€|%/g, '');
  if (!t) return null;
  const n = /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t) ? parseFloat(t.replace(/\./g, '').replace(',', '.')) : parseFloat(t.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function options() {
  const children = Number($('b-children').value);
  return {
    year: Number($('b-year').value),
    taxClass: Number($('b-class').value),
    state: $('b-state').value,
    church: $('b-church').checked,
    children,
    childAllowances: Number($('b-zkf').value),
    childless: children === 0 && $('b-age').checked,
    kvAdd: numFlex($('b-kvz').value) ?? undefined,
  };
}

function monthlyGross() {
  const amount = numFlex($('b-gross').value);
  const period = $('b-period').value;
  const hours = numFlex($('b-hours').value);
  if (!(amount > 0)) return { monthly: null, hours };
  if (period === 'year') return { monthly: amount / 12, hours };
  if (period === 'hour') return { monthly: hourlyToSalary(amount, hours), hours };
  return { monthly: amount, hours };
}

function setRows(r) {
  const rows = [
    ['Lohnsteuer', r.lst, ''],
    ['Solidaritätszuschlag', r.soli, ''],
    ['Kirchensteuer', r.kist, r.rates.church ? `${r.rates.church} % der Lohnsteuer` : ''],
    ['Krankenversicherung', r.kv, pct(r.rates.kv)],
    ['Pflegeversicherung', r.pv, pct(r.rates.pv)],
    ['Rentenversicherung', r.rv, pct(r.rates.rv)],
    ['Arbeitslosenversicherung', r.av, pct(r.rates.av)],
  ];
  $('b-rows').innerHTML = rows.map(([label, cents, hint]) => `<tr><th scope="row">${label}${hint ? ` <span class="bn-hint">${hint}</span>` : ''}</th><td>${euro(cents)}</td></tr>`).join('')
    + `<tr class="bn-sum"><th scope="row">Steuern gesamt</th><td>${euro(r.taxes)}</td></tr>`
    + `<tr class="bn-sum"><th scope="row">Sozialabgaben gesamt</th><td>${euro(r.social)}</td></tr>`;
}

function compute() {
  const { monthly, hours } = monthlyGross();
  const opt = options();
  $('b-age-wrap').hidden = opt.children > 0;
  $('b-hours-wrap').classList.toggle('need', $('b-period').value === 'hour');
  const year = taxYearFor(opt.year);
  const r = monthly === null ? null : netSalary({ ...opt, grossMonthly: monthly, minijobLimit: minijobAt(`${year}-06-30`) });
  $('b-copy').hidden = !r;
  $('b-detail-box').hidden = !r;
  if (!r) {
    $('b-net').textContent = '–';
    $('b-sub').textContent = $('b-period').value === 'hour' && !(hours > 0) ? 'Stundenlohn und Wochenstunden eingeben' : 'Bruttolohn eingeben';
    $('b-notes').innerHTML = '';
    computeReverse();
    return;
  }
  const notes = [];
  if (r.zone === 'minijob') {
    $('b-net').textContent = '–';
    $('b-sub').textContent = `${euro(r.gross)} im Monat liegen in der Minijob-Grenze`;
    $('b-detail-box').hidden = true;
    $('b-copy').hidden = true;
    notes.push({ level: 'info', text: 'Minijob: Hier gelten Pauschalabgaben des Arbeitgebers statt der normalen Abzüge. In der Regel wird der Lohn ohne Steuerabzug ausgezahlt; nur der Eigenanteil zur Rentenversicherung geht ab, wenn du dich nicht befreien lässt. Diesen Fall rechnet der Rechner nicht.' });
  } else {
    $('b-net').textContent = euro(r.net);
    const perHour = hours > 0 ? ` · ${euro(Math.round(r.net / ((hours * 13) / 3)))} pro Stunde` : '';
    $('b-sub').textContent = `${euro(r.net * 12)} im Jahr${perHour}`;
    setRows(r);
    const pNet = Math.round((r.net / r.gross) * 100);
    const pTax = Math.round((r.taxes / r.gross) * 100);
    const pSoc = 100 - pNet - pTax;
    $('b-bar-net').style.width = `${pNet}%`;
    $('b-bar-tax').style.width = `${pTax}%`;
    $('b-bar-soc').style.width = `${pSoc}%`;
    $('b-bar').setAttribute('aria-label', `Von ${euro(r.gross)} brutto bleiben ${pNet} % netto, ${pTax} % sind Steuern, ${pSoc} % Sozialabgaben`);
    $('b-legend').textContent = `Netto ${pNet} % · Steuern ${pTax} % · Sozialabgaben ${pSoc} %`;
    $('b-gross-out').textContent = `${euro(r.gross)} brutto im Monat`;
    if (r.zone === 'midijob') notes.push({ level: 'info', text: 'Übergangsbereich (Midijob bis 2.000 € im Monat): Hier zahlst du geringere Sozialbeiträge. Das rechnet der Rechner nicht ein, dein tatsächliches Netto ist etwas höher.' });
  }
  if (TAX_YEARS[r.year].draft) notes.push({ level: 'warn', text: `Werte für ${r.year} vorläufig: gerechnet nach dem Entwurf des Bundesfinanzministeriums. Die endgültigen Werte können abweichen.` });
  $('b-notes').innerHTML = noteHtml(notes);
  computeReverse();
}

function computeReverse() {
  const target = numFlex($('n-net').value);
  const opt = options();
  const gross = target > 0 ? grossForNet(target, opt) : null;
  $('n-gross').textContent = gross === null ? '–' : euro(Math.round(gross * 100));
  $('n-detail').textContent = gross === null ? 'Wunsch-Netto eingeben' : `nötiges Brutto im Monat für ${euro(Math.round(target * 100))} netto · ${euro(Math.round(gross * 1200))} im Jahr`;
  $('n-apply').hidden = gross === null;
  return gross;
}

function init() {
  $('bn').addEventListener('input', compute);
  $('bn').addEventListener('change', compute);
  // Zahl der Kinderfreibeträge folgt der Kinderzahl, bis sie von Hand geändert wird
  let zkfTouched = false;
  $('b-zkf').addEventListener('change', () => { zkfTouched = true; });
  $('b-children').addEventListener('change', () => {
    if (!zkfTouched) $('b-zkf').value = String(Math.min(6, Number($('b-children').value)));
    compute();
  });
  $('n-apply').addEventListener('click', () => {
    const gross = computeReverse();
    if (gross === null) return;
    $('b-period').value = 'month';
    $('b-gross').value = gross.toFixed(2).replace('.', ',');
    compute();
    $('rechner').scrollIntoView({ block: 'start' });
  });
  $('b-copy').addEventListener('click', async () => {
    const b = $('b-copy');
    try {
      await navigator.clipboard.writeText($('b-net').textContent);
      b.textContent = 'Kopiert';
    } catch {
      b.textContent = 'Nicht möglich';
    }
    setTimeout(() => { b.textContent = 'Kopieren'; }, 1600);
  });
  // Standardjahr: das laufende Kalenderjahr, sonst das nächstliegende vorhandene
  $('b-year').value = String(taxYearFor(Number(toIso(new Date()).slice(0, 4))));
  compute();
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}
init();

// Build ohne Abhängigkeiten: rendert die Seite vor und schreibt alles nach public/.
// Aufruf: npm run build
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, copyFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  calcDay, formatHM, formatDecimal, formatEuro, weeklyToMonthly, toIso, parseIso, MONTHS,
  salaryToHourly, salaryInfo, wageInfo, minijobMaxHours,
} from '../src/js/core.js';
import { LAW, STATES } from '../src/js/config.js';
import { netSalary, grossForNet, TAX_YEARS, taxYears, taxYearFor, MIDIJOB_MAX } from '../src/js/netto.js';
import { FAQ } from '../src/faq.mjs';
import { faqStundenlohn } from '../src/faq-stundenlohn.mjs';
import { faqBruttoNetto } from '../src/faq-brutto-netto.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => join(root, 'src', p);
const out = join(root, 'public');
const site = JSON.parse(readFileSync(src('site.json'), 'utf8'));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

/* ---------- JS-Module mit Inhalts-Hash (lange cachebar) ---------- */
const jsDir = src('js');
const jsFiles = readdirSync(jsDir).filter((f) => f.endsWith('.js')).sort();
const hash = createHash('sha256');
for (const f of jsFiles) hash.update(readFileSync(join(jsDir, f)));
const version = hash.digest('hex').slice(0, 10);
const assetsPath = `/assets/${version}`;
mkdirSync(join(out, 'assets', version), { recursive: true });
for (const f of jsFiles) {
  const code = readFileSync(join(jsDir, f), 'utf8')
    .replace(/^\s*\/\/.*$/gm, '') // Zeilenkommentare
    .replace(/\n{2,}/g, '\n');
  writeFileSync(join(out, 'assets', version, f), code);
}

/* ---------- CSS ---------- */
const css = readFileSync(src('styles.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\s*\n\s*/g, '')
  .replace(/\s*([{};,])\s*/g, '$1')
  .replace(/;}/g, '}');

/* ---------- Vorgerendertes Ergebnis ---------- */
const pre = calcDay({ start: '08:00', end: '16:30', breaks: [{ kind: 'min', minutes: 30 }] });

/* ---------- Tabellen ---------- */
let decRows = '';
for (let i = 1; i <= 20; i++) {
  decRows += '<tr>';
  for (const m of [i, i + 20, i + 40]) decRows += `<td>${m} Min.</td><td>${formatDecimal(m).replace(/^0,/, '0,')} h</td>`;
  decRows += '</tr>';
}
let monthRows = '';
for (const h of [10, 12, 15, 19.5, 20, 25, 30, 35, 37, 37.5, 38, 38.5, 39, 40, 42, 45, 48]) {
  const m = weeklyToMonthly(h * 60);
  monthRows += `<tr><td>${String(h).replace('.', ',')} h</td><td>${formatHM(m)} h</td><td>${formatDecimal(m)} h</td></tr>`;
}

/* ---------- FAQ ---------- */
const renderFaq = (list) => `<div class="faq">${list.map((f, i) => `<details${i === 0 ? ' open' : ''}><summary><h3>${esc(f.q)}</h3></summary><p>${esc(f.a)}</p></details>`).join('')}</div>`;
const faqEntity = (list) => list.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } }));
const jsonldString = (obj) => JSON.stringify(obj).replace(/</g, '\\u003c');
const faqHtml = renderFaq(FAQ);

/* ---------- Gemeinsame Bausteine aller Seiten ---------- */
const year = new Date().getFullYear();
const today = toIso(new Date());
// Rechner-Seiten: Reihenfolge = Reihenfolge in Navigation und Fußzeile
const TOOLS = [
  { path: '/', label: 'Arbeitszeitrechner', short: 'Arbeitszeit' },
  { path: '/stundenlohnrechner', label: 'Stundenlohnrechner', short: 'Stundenlohn' },
  { path: '/brutto-netto-rechner', label: 'Brutto-Netto-Rechner', short: 'Brutto-Netto' },
];
const otherTools = (current) => TOOLS.filter((t) => t.path !== current);
const brandSvg = '<svg aria-hidden="true" width="26" height="26" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="currentColor"/><circle cx="16" cy="16" r="9" fill="none" stroke="#fff" stroke-width="2.5"/><path d="M16 10.5V16l3.5 2.5" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></svg>';
const headCommon = `<meta name="theme-color" content="#0b5cad" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0f1720" media="(prefers-color-scheme: dark)">
<meta name="color-scheme" content="light dark">
<link rel="icon" href="/favicon.ico?v=2" sizes="32x32">
<link rel="icon" href="/favicon.svg?v=2" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png?v=2">
<link rel="manifest" href="/site.webmanifest">`;
const header = (current) => `<header class="top">
  <div class="wrap top-in">
    <a class="brand" href="/" aria-label="derarbeitszeitrechner.de – Startseite">${brandSvg}<span>derarbeitszeitrechner<span class="tld">.de</span></span></a>
    <nav class="topnav" aria-label="Rechner">${otherTools(current).map((t, i) => `<a${i ? ' class="wide"' : ''} href="${t.path}" aria-label="${t.label}"><span class="nav-l">${t.label}</span><span class="nav-s" aria-hidden="true">${t.short}</span></a>`).join('')}</nav>
  </div>
</header>`;
const navToolsWide = (current) => otherTools(current).map((t) => `<a class="wide" href="${t.path}">${t.label}</a>`).join('\n      ');
const footNav = `<nav aria-label="Rechner">${TOOLS.map((t) => `<a href="${t.path}">${t.label}</a>`).join(' ')}</nav>
    <nav aria-label="Rechtliches"><a href="/impressum">Impressum</a> <a href="/datenschutz">Datenschutz</a> <a href="/kontakt">Kontakt</a></nav>`;
const footer = (tagline) => `<footer class="foot">
  <div class="wrap foot-in">
    <p>© ${year} derarbeitszeitrechner.de${tagline ? ` – ${tagline}` : ''}</p>
    ${footNav}
  </div>
</footer>`;
const moreTools = (current) => `<p class="more-tools">Weitere Rechner: ${otherTools(current).map((t) => `<a href="${t.path}">${t.label}</a>`).join(' · ')}</p>`;

/* ---------- Rechtswerte als Text (aus config.js, damit nichts von Hand gepflegt wird) ---------- */
const euro = (v) => formatEuro(Math.round(v * 100));
const dateDe = (iso) => { const d = parseIso(iso); return `${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
const currentAndNext = (list) => {
  let cur = list[0];
  for (const item of list) if (item.from <= today) cur = item;
  return { cur, next: list.find((item) => item.from > today) || null };
};
const minWage = currentAndNext(LAW.minWage);
const minijob = currentAndNext(LAW.minijobLimit);

const jsonld = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebApplication',
      '@id': `${site.url}/#app`,
      name: 'Arbeitszeitrechner & Stundenrechner online',
      url: `${site.url}/`,
      description: 'Arbeitszeit und Arbeitsstunden online berechnen: mit Pausen, Nachtschicht, Woche und Monat, Industrieminuten, Lohn und Prüfung nach Arbeitszeitgesetz. Kostenlos und ohne Anmeldung.',
      applicationCategory: 'UtilitiesApplication',
      operatingSystem: 'Alle (Webbrowser)',
      inLanguage: 'de-DE',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
      featureList: 'Arbeitszeit mit mehreren Pausen, Nachtschicht, Pflichtpausen-Prüfung, Wochen- und Monatsansicht, Gleitzeit- und Überstundenkonto, Feierabendrechner, Stunden addieren, Dezimal- und Industrieminuten-Rechner, Stundenlohn, Export als Excel, CSV und PDF',
    },
    {
      '@type': 'FAQPage',
      '@id': `${site.url}/#faq`,
      mainEntity: faqEntity(FAQ),
    },
  ],
};

const fill = (tpl, map) => tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => {
  if (!(k in map)) throw new Error(`Platzhalter {{${k}}} nicht befüllt`);
  return map[k];
});

const index = fill(readFileSync(src('index.html'), 'utf8'), {
  URL: site.url,
  ASSETS: assetsPath,
  CSS: css,
  JSONLD: jsonldString(jsonld),
  TODAY: today,
  PRE_HM: formatHM(pre.net),
  PRE_DEC: formatDecimal(pre.net),
  PRE_GROSS: formatHM(pre.gross),
  PRE_BREAK: formatHM(pre.breakTotal),
  DECIMAL_TABLE: decRows,
  MONTH_TABLE: monthRows,
  FAQ_HTML: faqHtml,
  STAND: site.stand,
  YEAR: String(year),
  NAV_TOOLS: navToolsWide('/'),
  MORE_TOOLS: moreTools('/'),
  FOOT_NAV: footNav,
});
writeFileSync(join(out, 'index.html'), index);

/* ---------- Netto-Beispielwerte (aus dem Netto-Rechenkern) ---------- */
const taxYear = taxYearFor(year);
const TP = TAX_YEARS[taxYear];
const cents = (c) => formatEuro(c);
const centsShort = (c) => formatEuro(c).replace(/,00 €$/, ' €');
const pctDe = (v) => `${v.toFixed(2).replace('.', ',').replace(/,?0+$/, '')} %`;
const net = (grossMonthly, extra = {}) => netSalary({ year: taxYear, grossMonthly, ...extra });
const nx = net(3000);
const monthHours = (h) => (h * 13) / 3;

/* ---------- Stundenlohnrechner ---------- */
const ex = salaryInfo({ amount: 3000, weeklyHours: 40, iso: today });
const mw = wageInfo({ rate: minWage.cur.value, weeklyHours: 40, iso: today });
const euroShort = (v) => euro(v).replace(/,00 €$/, ' €');
const dec1 = (v) => v.toFixed(1).replace('.', ',');
const mjHours = minijobMaxHours(minWage.cur.value, today);
const lohnValues = {
  exSalary: euroShort(ex.monthly), exHours: '40', exRate: euro(ex.rate),
  exRate35: euro(salaryToHourly(3000, 35)), exRate30: euro(salaryToHourly(3000, 30)),
  minWage: euro(minWage.cur.value), minWageMonth: euro(mw.monthly),
  minWageNextFaq: minWage.next ? `Ab ${dateDe(minWage.next.from)} steigt der Mindestlohn auf ${euro(minWage.next.value)}; das sind dann ${euro(wageInfo({ rate: minWage.next.value, weeklyHours: 40, iso: minWage.next.from }).monthly)} im Monat.` : '',
  minijob: euroShort(minijob.cur.value), minijobHours: dec1(mjHours), minijobHoursWeek: dec1(Math.floor((mjHours * 3) / 13 * 10) / 10),
  taxYear: String(taxYear), exNetHour: cents(Math.round(nx.net / monthHours(40))), exNetMonth: cents(nx.net),
};
const faqLohn = faqStundenlohn(lohnValues).map((f) => ({ q: f.q, a: f.a.trim() }));
let salaryRows = '';
for (let g = 1500; g <= 6000; g += 250) {
  salaryRows += `<tr><td>${euroShort(g)}</td>${[40, 35, 30, 20].map((h) => `<td>${euro(salaryToHourly(g, h))}</td>`).join('')}</tr>`;
}
const lohnTitle = `Stundenlohnrechner ${year} – brutto & netto berechnen`;
const lohnDescription = 'Stundenlohn berechnen: Gehalt in Stundenlohn umrechnen und zurück, brutto und netto. Mit Formel, Tabelle und Mindestlohn-Check. Kostenlos, ohne Anmeldung.';
const lohnJsonld = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebApplication',
      '@id': `${site.url}/stundenlohnrechner#app`,
      name: 'Stundenlohnrechner',
      url: `${site.url}/stundenlohnrechner`,
      description: lohnDescription,
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Alle (Webbrowser)',
      inLanguage: 'de-DE',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
      featureList: 'Monatsgehalt oder Jahresgehalt in Stundenlohn umrechnen, Stundenlohn in Monatslohn und Jahreslohn umrechnen, Mindestlohn-Prüfung, Minijob-Prüfung, Tabelle Gehalt in Stundenlohn',
    },
    { '@type': 'FAQPage', '@id': `${site.url}/stundenlohnrechner#faq`, mainEntity: faqEntity(faqLohn) },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Arbeitszeitrechner', item: `${site.url}/` },
        { '@type': 'ListItem', position: 2, name: 'Stundenlohnrechner', item: `${site.url}/stundenlohnrechner` },
      ],
    },
  ],
};
const lohnPage = fill(readFileSync(src('stundenlohnrechner.html'), 'utf8'), {
  URL: site.url,
  ASSETS: assetsPath,
  CSS: css,
  HEAD_COMMON: headCommon,
  HEADER: header('/stundenlohnrechner'),
  FOOTER: footer('kostenloser Stundenlohnrechner'),
  MORE_TOOLS: moreTools('/stundenlohnrechner'),
  JSONLD: jsonldString(lohnJsonld),
  TITLE: esc(lohnTitle),
  DESCRIPTION: esc(lohnDescription),
  YEAR: String(year),
  STAND: site.stand,
  FAQ_HTML: renderFaq(faqLohn),
  SALARY_TABLE: salaryRows,
  EX_SALARY_RAW: '3000',
  EX_SALARY: euro(ex.monthly),
  EX_SALARY_SHORT: '3.000',
  EX_SALARY_E: euroShort(ex.monthly),
  EX_YEAR_E: euroShort(ex.yearly),
  EX_HOURS: '40',
  EX_RATE: euro(ex.rate),
  EX_YEAR: euro(ex.yearly),
  EX_MONTH_HOURS: ex.monthlyHours.toFixed(2).replace('.', ','),
  MINWAGE: euro(minWage.cur.value),
  MINWAGE_RAW: minWage.cur.value.toFixed(2).replace('.', ','),
  MINWAGE_MONTH: euro(mw.monthly),
  MINWAGE_YEAR: euro(mw.yearly),
  MINWAGE_SENTENCE: `Der gesetzliche Mindestlohn beträgt seit ${dateDe(minWage.cur.from)} <strong>${euro(minWage.cur.value)} pro Stunde</strong>${minWage.next ? ` und steigt zum ${dateDe(minWage.next.from)} auf <strong>${euro(minWage.next.value)}</strong>` : ''}.`,
  MINIJOB_SENTENCE: `Die Minijob-Grenze liegt bei ${euroShort(minijob.cur.value)} im Monat${minijob.next ? ` (ab ${dateDe(minijob.next.from)}: ${euroShort(minijob.next.value)})` : ''}.`,
  MINIJOB_HOURS: lohnValues.minijobHours,
  MINIJOB_HOURS_WEEK: lohnValues.minijobHoursWeek,
  PT_SALARY: euroShort(1500),
  PT_HOURS: '20',
  PT_RATE: euro(salaryToHourly(1500, 20)),
  PT2_HOURS: '30',
  PT2_SALARY: euroShort((ex.monthly * 30) / 40),
  TAX_YEAR: String(taxYear),
  EX_NET_HOUR: cents(Math.round(nx.net / monthHours(40))),
  EX_NET_MONTH: cents(nx.net),
});
writeFileSync(join(out, 'stundenlohnrechner.html'), lohnPage);

/* ---------- Brutto-Netto-Rechner ---------- */
const bnRows = (r) => [
  ['Lohnsteuer', r.lst, ''],
  ['Solidaritätszuschlag', r.soli, ''],
  ['Kirchensteuer', r.kist, r.rates.church ? `${r.rates.church} % der Lohnsteuer` : ''],
  ['Krankenversicherung', r.kv, pctDe(r.rates.kv)],
  ['Pflegeversicherung', r.pv, pctDe(r.rates.pv)],
  ['Rentenversicherung', r.rv, pctDe(r.rates.rv)],
  ['Arbeitslosenversicherung', r.av, pctDe(r.rates.av)],
].map(([label, c, hint]) => `<tr><th scope="row">${label}${hint ? ` <span class="bn-hint">${hint}</span>` : ''}</th><td>${cents(c)}</td></tr>`).join('')
  + `<tr class="bn-sum"><th scope="row">Steuern gesamt</th><td>${cents(r.taxes)}</td></tr>`
  + `<tr class="bn-sum"><th scope="row">Sozialabgaben gesamt</th><td>${cents(r.social)}</td></tr>`;
const pNet = Math.round((nx.net / nx.gross) * 100);
const pTax = Math.round((nx.taxes / nx.gross) * 100);
const revNet = 2500;
const revGross = grossForNet(revNet, { year: taxYear });
const mwGross = mw.monthly;
const mwNet = net(mwGross);
const hourRate = 20;
const hourGross = wageInfo({ rate: hourRate, weeklyHours: 40, iso: today }).monthly;
const hourNet = net(hourGross);
const nxBY = net(3000, { state: 'BY', church: true });
const nxNW = net(3000, { state: 'NW', church: true });
const nxSN = net(3000, { state: 'SN' });
const classInfo = [
  [1, 'I', 'Ledig, geschieden oder verwitwet', {}],
  [2, 'II', 'Alleinerziehend (hier mit einem Kind)', { children: 1, childAllowances: 1 }],
  [3, 'III', 'Verheiratet, höheres Einkommen (Partner in V)', {}],
  [4, 'IV', 'Verheiratet, ähnlich hohe Einkommen', {}],
  [5, 'V', 'Verheiratet, niedrigeres Einkommen (Partner in III)', {}],
  [6, 'VI', 'Zweiter und jeder weitere Job', {}],
];
const classTable = classInfo.map(([k, roman, who, extra]) => `<tr><td>${roman}</td><td>${who}</td><td>${cents(net(3000, { taxClass: k, ...extra }).net)}</td></tr>`).join('');
let netRows = '';
for (let g = 2500; g <= 7000; g += 500) {
  netRows += `<tr><td>${euroShort(g)}</td>${[1, 3, 5].map((k) => `<td>${cents(net(g, { taxClass: k }).net)}</td>`).join('')}</tr>`;
}
const bnValues = {
  year: String(taxYear), exGross: '3.000 €', exNet: cents(nx.net), exTaxes: cents(nx.taxes), exSocial: cents(nx.social),
  exNet3: cents(net(3000, { taxClass: 3 }).net), exNet5: cents(net(3000, { taxClass: 5 }).net),
  kvAdd: pctDe(TP.KV_ZUSATZ_SCHNITT), kvRate: pctDe(nx.rates.kv), pvRate: pctDe(TP.PVSATZAN / 10000),
  pvRateChildless: pctDe((TP.PVSATZAN + TP.PV_ZUSCHLAG) / 10000), rvRate: pctDe(nx.rates.rv), avRate: pctDe(nx.rates.av),
  revNet: euroShort(revNet), revGross: euro(revGross),
  minWage: euro(minWage.cur.value), minWageGross: euro(mwGross), minWageNet: cents(mwNet.net),
  minWageNetHour: cents(Math.round(mwNet.net / monthHours(40))),
};
const faqBn = faqBruttoNetto(bnValues);
const bnTitle = `Brutto-Netto-Rechner ${year} – Nettogehalt berechnen`;
const bnDescription = 'Brutto-Netto-Rechner: Nettogehalt aus Monatsgehalt oder Stundenlohn berechnen, mit Steuerklasse, Bundesland und allen Abzügen. Kostenlos, ohne Anmeldung.';
const bnJsonld = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebApplication',
      '@id': `${site.url}/brutto-netto-rechner#app`,
      name: 'Brutto-Netto-Rechner',
      url: `${site.url}/brutto-netto-rechner`,
      description: bnDescription,
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Alle (Webbrowser)',
      inLanguage: 'de-DE',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
      featureList: 'Netto aus Monatsgehalt, Jahresgehalt oder Stundenlohn, Steuerklassen I bis VI, Kirchensteuer nach Bundesland, Kinderfreibeträge, Zusatzbeitrag der Krankenkasse, Netto in Brutto umrechnen',
    },
    { '@type': 'FAQPage', '@id': `${site.url}/brutto-netto-rechner#faq`, mainEntity: faqEntity(faqBn) },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Arbeitszeitrechner', item: `${site.url}/` },
        { '@type': 'ListItem', position: 2, name: 'Brutto-Netto-Rechner', item: `${site.url}/brutto-netto-rechner` },
      ],
    },
  ],
};
const draftNote = `Werte für ${taxYear} vorläufig: gerechnet nach dem Entwurf des Bundesfinanzministeriums. Die endgültigen Werte können abweichen.`;
const bnPage = fill(readFileSync(src('brutto-netto-rechner.html'), 'utf8'), {
  URL: site.url,
  ASSETS: assetsPath,
  CSS: css,
  HEAD_COMMON: headCommon,
  HEADER: header('/brutto-netto-rechner'),
  FOOTER: footer('kostenloser Brutto-Netto-Rechner'),
  MORE_TOOLS: moreTools('/brutto-netto-rechner'),
  JSONLD: jsonldString(bnJsonld),
  TITLE: esc(bnTitle),
  DESCRIPTION: esc(bnDescription),
  YEAR: String(taxYear),
  STAND: site.stand,
  FAQ_HTML: renderFaq(faqBn),
  STATE_OPTIONS: Object.entries(STATES).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join(''),
  YEAR_OPTIONS: taxYears().map((y) => `<option value="${y}"${y === taxYear ? ' selected' : ''}>${y}${TAX_YEARS[y].draft ? ' (vorläufig)' : ''}</option>`).join(''),
  KV_ADD_RAW: String(TP.KV_ZUSATZ_SCHNITT).replace('.', ','),
  EX_GROSS_RAW: '3000',
  EX_GROSS: cents(nx.gross),
  EX_GROSS_E: '3.000 €',
  EX_NET: cents(nx.net),
  EX_NET_E: cents(nx.net),
  EX_NET_YEAR: cents(nx.net * 12),
  EX_NET_HOUR: cents(Math.round(nx.net / monthHours(40))),
  EX_NOTES: TP.draft ? `<li class="note warn">${esc(draftNote)}</li>` : '',
  EX_P_NET: String(pNet),
  EX_P_TAX: String(pTax),
  EX_P_SOC: String(100 - pNet - pTax),
  EX_ROWS: bnRows(nx),
  EX_TAXES: cents(nx.taxes),
  EX_SOCIAL: cents(nx.social),
  REV_NET_RAW: String(revNet),
  REV_NET: cents(revNet * 100),
  REV_NET_E: euroShort(revNet),
  REV_GROSS: euro(revGross),
  REV_GROSS_E: euro(revGross),
  REV_GROSS_YEAR: euro(revGross * 12),
  SOLZFREI: euroShort(TP.SOLZFREI),
  KV_RATE: bnValues.kvRate,
  KV_ADD: bnValues.kvAdd,
  PV_RATE: bnValues.pvRate,
  PV_RATE_CHILDLESS: bnValues.pvRateChildless,
  PV_RATE_SN: pctDe(TP.PVSATZAN_SACHSEN / 10000),
  RV_RATE: bnValues.rvRate,
  AV_RATE: bnValues.avRate,
  BBG_KV: euro(TP.BBGKV / 12),
  BBG_RV: euroShort(TP.BBGRVALV / 12),
  DRAFT_SENTENCE: TP.draft ? ` Die Werte für ${taxYear} beruhen auf dem Entwurf des Bundesfinanzministeriums und sind vorläufig.` : '',
  CLASS_TABLE: classTable,
  HOUR_RATE: euroShort(hourRate),
  HOUR_GROSS: euro(hourGross),
  HOUR_NET: cents(hourNet.net),
  HOUR_NET_HOUR: cents(Math.round(hourNet.net / monthHours(40))),
  KIST_BY: cents(nxBY.kist),
  KIST_NW: cents(nxNW.kist),
  PV_DIFF_SN: cents(nxSN.pv - nx.pv),
  HALF_FULL_GROSS: '5.000 €',
  HALF_FULL_NET: cents(net(5000).net),
  HALF_GROSS: '2.500 €',
  HALF_NET: cents(net(2500).net),
  MINIJOB: euroShort(minijob.cur.value),
  MIDIJOB: euroShort(MIDIJOB_MAX),
  NET_TABLE: netRows,
  SOURCE_PAP: esc(TP.source),
});
writeFileSync(join(out, 'brutto-netto-rechner.html'), bnPage);

/* ---------- Unterseiten ---------- */
function page({ title, description, body, robots = 'index,follow', path }) {
  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(description)}"><meta name="robots" content="${robots}">
${path ? `<link rel="canonical" href="${site.url}${path}">` : ''}
${headCommon}<style>${css}</style></head>
<body>${header(path || '')}
<main class="wrap legal">${body}</main>
${footer('')}
</body></html>`;
}

const missing = [];
const need = (v, label) => { if (v) return esc(v); missing.push(label); return `<em>[${label} ergänzen]</em>`; };
const addr = `${esc(site.owner)}<br>${need(site.street, 'Straße und Hausnummer')}<br>${need(site.zipCity, 'PLZ und Ort')}`;
const mail = site.email ? `<a href="mailto:${esc(site.email)}">${esc(site.email)}</a>` : need('', 'E-Mail-Adresse');

writeFileSync(join(out, 'impressum.html'), page({
  title: 'Impressum – derarbeitszeitrechner.de', description: 'Impressum von derarbeitszeitrechner.de', path: '/impressum',
  body: `<h1>Impressum</h1>
<h2>Angaben gemäß § 5 DDG</h2><p>${addr}</p>
<h2>Kontakt</h2><p>E-Mail: ${mail}${site.phone ? `<br>Telefon: ${esc(site.phone)}` : ''}</p>
<h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2><p>${addr}</p>
<h2>Haftung für Inhalte</h2><p>Die Inhalte und Berechnungen dieser Website wurden mit größter Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte und Rechenergebnisse kann jedoch keine Gewähr übernommen werden. Die Ergebnisse stellen keine Rechtsberatung dar. Tarifverträge, Betriebsvereinbarungen und Arbeitsverträge können abweichende Regelungen enthalten.</p>
<h2>Haftung für Links</h2><p>Diese Website enthält Links zu externen Websites Dritter, auf deren Inhalte kein Einfluss besteht. Für diese fremden Inhalte ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich. Bei Bekanntwerden von Rechtsverletzungen werden derartige Links umgehend entfernt.</p>
<h2>Verbraucherstreitbeilegung</h2><p>Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>`,
}));

writeFileSync(join(out, 'datenschutz.html'), page({
  title: 'Datenschutzerklärung – derarbeitszeitrechner.de', description: 'Datenschutzerklärung von derarbeitszeitrechner.de: Deine Eingaben bleiben auf deinem Gerät.', path: '/datenschutz',
  body: `<h1>Datenschutzerklärung</h1>
<p><strong>Kurz gesagt:</strong> Der Arbeitszeitrechner funktioniert vollständig in deinem Browser. Deine eingegebenen Arbeitszeiten, Pausen, Stundenlöhne und Profile werden ausschließlich lokal auf deinem Gerät gespeichert und nicht an uns oder Dritte übertragen. Es gibt kein Konto, keine Cookies und keine Werbung.</p>
<h2>1. Verantwortlicher</h2><p>${addr}<br>E-Mail: ${mail}</p>
<h2>2. Hosting und Server-Logfiles</h2><p>Diese Website wird über das Netzwerk der Cloudflare, Inc., 101 Townsend St., San Francisco, CA 94107, USA, ausgeliefert. Beim Aufruf der Website verarbeitet Cloudflare technisch notwendige Daten wie IP-Adresse, Zeitpunkt des Abrufs, aufgerufene Adresse, Browser-Typ und Betriebssystem, um die Seite auszuliefern und vor Angriffen zu schützen. Rechtsgrundlage ist unser berechtigtes Interesse an einer sicheren und schnellen Bereitstellung der Website (Art. 6 Abs. 1 lit. f DSGVO). Mit Cloudflare besteht ein Auftragsverarbeitungsvertrag. Cloudflare ist unter dem EU-US Data Privacy Framework zertifiziert; zusätzlich gelten die Standardvertragsklauseln der EU-Kommission. Weitere Informationen: <a href="https://www.cloudflare.com/de-de/privacypolicy/" rel="noopener">Datenschutzerklärung von Cloudflare</a>.</p>
<h2>3. Lokale Speicherung im Browser</h2><p>Damit deine Einträge nach dem Neuladen erhalten bleiben, speichert der Rechner sie in der IndexedDB bzw. im lokalen Speicher deines Browsers. Diese Daten verlassen dein Gerät nicht und sind für uns nicht einsehbar. Die Speicherung ist für die von dir ausdrücklich gewünschte Funktion unbedingt erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG). Damit der Rechner auch ohne Internetverbindung funktioniert, legt ein Service Worker die Dateien der Website im Cache deines Browsers ab; dabei werden keine personenbezogenen Daten gespeichert. Wenn du einen Monat über „Als Link teilen“ weitergibst, stehen die Zeiten im Teil der Adresse hinter dem #-Zeichen; dieser Teil wird von Browsern nicht an unseren Server übertragen. Du kannst die Daten jederzeit löschen, indem du Einträge im Rechner entfernst oder die Websitedaten in deinem Browser löschst. Über „Datensicherung“ kannst du sie selbst als Datei exportieren.</p>
<h2>4. Cookies, Reichweitenmessung und Werbung</h2><p>Diese Website setzt keine Cookies, verwendet keine Tracking- oder Analysedienste und zeigt keine Werbung. Sollte sich das ändern, wird diese Datenschutzerklärung vorher angepasst und – soweit erforderlich – deine Einwilligung eingeholt.</p>
<h2>5. Kontakt per E-Mail</h2><p>Wenn du uns per E-Mail kontaktierst, verarbeiten wir deine Angaben zur Bearbeitung der Anfrage (Art. 6 Abs. 1 lit. b bzw. f DSGVO) und löschen sie, sobald sie nicht mehr erforderlich sind.</p>
<h2>6. Deine Rechte</h2><p>Du hast das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21 DSGVO). Außerdem kannst du dich bei einer Datenschutz-Aufsichtsbehörde beschweren, zum Beispiel bei der Landesbeauftragten für den Datenschutz und für das Recht auf Akteneinsicht Brandenburg.</p>
<p>Stand: ${esc(site.stand)}</p>`,
}));

writeFileSync(join(out, 'kontakt.html'), page({
  title: 'Kontakt – derarbeitszeitrechner.de', description: 'Kontakt zu derarbeitszeitrechner.de', path: '/kontakt',
  body: `<h1>Kontakt</h1><p>Fragen, Fehler gefunden oder eine Idee für den Rechner? Schreib uns gern:</p><p>E-Mail: ${mail}</p><p>Bitte schicke uns keine Arbeitszeitdaten – der Rechner speichert sie absichtlich nur auf deinem Gerät.</p>`,
}));

writeFileSync(join(out, '404.html'), page({
  title: 'Seite nicht gefunden – derarbeitszeitrechner.de', description: 'Diese Seite gibt es nicht.', robots: 'noindex',
  body: '<h1>Seite nicht gefunden</h1><p>Diese Seite gibt es nicht. <a href="/">Zum Arbeitszeitrechner</a></p>',
}));

/* ---------- Statisches ---------- */
const staticDir = src('static');
if (existsSync(staticDir)) for (const f of readdirSync(staticDir)) copyFileSync(join(staticDir, f), join(out, f));

writeFileSync(join(out, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /impressum\n\nSitemap: ${site.url}/sitemap.xml\n`);
const lastmod = today;
writeFileSync(join(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>${site.url}/</loc><lastmod>${lastmod}</lastmod></url>
<url><loc>${site.url}/stundenlohnrechner</loc><lastmod>${lastmod}</lastmod></url>
<url><loc>${site.url}/brutto-netto-rechner</loc><lastmod>${lastmod}</lastmod></url>
<url><loc>${site.url}/datenschutz</loc></url>
<url><loc>${site.url}/kontakt</loc></url>
</urlset>
`);

/* ---------- Service Worker (offline) ---------- */
const precache = ['/', '/stundenlohnrechner', '/brutto-netto-rechner', ...jsFiles.map((f) => `${assetsPath}/${f}`), '/favicon.svg', '/icon-192.png', '/site.webmanifest'];
writeFileSync(join(out, 'sw.js'), `// automatisch erzeugt von scripts/build.mjs
const CACHE = 'azr-${version}-${createHash('sha256').update(index).update(lohnPage).update(bnPage).digest('hex').slice(0, 8)}';
const PRECACHE = ${JSON.stringify(precache)};
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('azr-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    })));
    return;
  }
  // Seiten und übrige Dateien: zuerst Netz (immer aktuell), offline aus dem Cache
  e.respondWith(fetch(req).then((res) => {
    if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: req.mode === 'navigate' }).then((hit) => hit || (req.mode === 'navigate' ? caches.match(url.pathname.replace(/\\/$/, '') || '/').then((page) => page || caches.match('/')) : Response.error()))));
});
`);

if (missing.length) console.warn(`⚠ Impressum/Datenschutz: bitte in src/site.json ergänzen: ${[...new Set(missing)].join(', ')}`);
console.log(`✓ public/ gebaut (Assets ${assetsPath}, ${jsFiles.length} Module)`);

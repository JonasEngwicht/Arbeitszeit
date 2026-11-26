// Build ohne Abhängigkeiten: rendert die Seite vor und schreibt alles nach public/.
// Aufruf: npm run build
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, copyFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calcDay, formatHM, formatDecimal, weeklyToMonthly, toIso } from '../src/js/core.js';
import { FAQ } from '../src/faq.mjs';

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
const faqHtml = `<div class="faq">${FAQ.map((f, i) => `<details${i === 0 ? ' open' : ''}><summary><h3>${esc(f.q)}</h3></summary><p>${esc(f.a)}</p></details>`).join('')}</div>`;

const jsonld = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebApplication',
      '@id': `${site.url}/#app`,
      name: 'Arbeitszeitrechner & Stundenrechner',
      url: `${site.url}/`,
      description: 'Arbeitszeit und Stunden berechnen: mit Pausen, Nachtschicht, Woche und Monat, Dezimal-Umrechnung, Lohn und Prüfung nach Arbeitszeitgesetz. Kostenlos und ohne Anmeldung.',
      applicationCategory: 'UtilitiesApplication',
      operatingSystem: 'Alle (Webbrowser)',
      inLanguage: 'de-DE',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
      featureList: 'Arbeitszeit mit mehreren Pausen, Nachtschicht, Pflichtpausen-Prüfung, Wochen- und Monatsansicht, Feierabendrechner, Stunden addieren, Dezimal-Umrechner, Stundenlohn, Export als Excel, CSV und PDF',
    },
    {
      '@type': 'FAQPage',
      '@id': `${site.url}/#faq`,
      mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
  ],
};

const year = new Date().getFullYear();
const fill = (tpl, map) => tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => {
  if (!(k in map)) throw new Error(`Platzhalter {{${k}}} nicht befüllt`);
  return map[k];
});

const index = fill(readFileSync(src('index.html'), 'utf8'), {
  URL: site.url,
  ASSETS: assetsPath,
  CSS: css,
  JSONLD: JSON.stringify(jsonld).replace(/</g, '\\u003c'),
  TODAY: toIso(new Date()),
  PRE_HM: formatHM(pre.net),
  PRE_DEC: formatDecimal(pre.net),
  PRE_GROSS: formatHM(pre.gross),
  PRE_BREAK: formatHM(pre.breakTotal),
  DECIMAL_TABLE: decRows,
  MONTH_TABLE: monthRows,
  FAQ_HTML: faqHtml,
  STAND: site.stand,
  YEAR: String(year),
});
writeFileSync(join(out, 'index.html'), index);

/* ---------- Unterseiten ---------- */
function page({ title, description, body, robots = 'index,follow', path }) {
  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(description)}"><meta name="robots" content="${robots}">
${path ? `<link rel="canonical" href="${site.url}${path}">` : ''}
<meta name="color-scheme" content="light dark"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><style>${css}</style></head>
<body><header class="top"><div class="wrap top-in"><a class="brand" href="/"><svg aria-hidden="true" width="26" height="26" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="currentColor"/><circle cx="16" cy="16" r="9" fill="none" stroke="#fff" stroke-width="2.5"/><path d="M16 10.5V16l3.5 2.5" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></svg><span>derarbeitszeitrechner<span class="tld">.de</span></span></a><nav class="topnav"><a href="/">Zum Rechner</a></nav></div></header>
<main class="wrap legal">${body}</main>
<footer class="foot"><div class="wrap foot-in"><p>© ${year} derarbeitszeitrechner.de</p><nav aria-label="Rechtliches"><a href="/impressum">Impressum</a> <a href="/datenschutz">Datenschutz</a> <a href="/kontakt">Kontakt</a></nav></div></footer>
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
<h2>3. Lokale Speicherung im Browser</h2><p>Damit deine Einträge nach dem Neuladen erhalten bleiben, speichert der Rechner sie in der IndexedDB bzw. im lokalen Speicher deines Browsers. Diese Daten verlassen dein Gerät nicht und sind für uns nicht einsehbar. Die Speicherung ist für die von dir ausdrücklich gewünschte Funktion unbedingt erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG). Du kannst die Daten jederzeit löschen, indem du Einträge im Rechner entfernst oder die Websitedaten in deinem Browser löschst. Über „Datensicherung“ kannst du sie selbst als Datei exportieren.</p>
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

writeFileSync(join(out, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n`);
const lastmod = toIso(new Date());
writeFileSync(join(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>${site.url}/</loc><lastmod>${lastmod}</lastmod></url>
<url><loc>${site.url}/impressum</loc></url>
<url><loc>${site.url}/datenschutz</loc></url>
<url><loc>${site.url}/kontakt</loc></url>
</urlset>
`);

if (missing.length) console.warn(`⚠ Impressum/Datenschutz: bitte in src/site.json ergänzen: ${[...new Set(missing)].join(', ')}`);
console.log(`✓ public/ gebaut (Assets ${assetsPath}, ${jsFiles.length} Module)`);

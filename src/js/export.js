// Export: CSV, Excel (.xlsx) und PDF – ohne externe Bibliotheken.
// Wird erst beim Klick auf „Export“ geladen.
import { formatHM, formatDecimal, formatEuro, MONTHS, WEEKDAYS_SHORT, daysInMonth } from './core.js';

const slug = (s) => String(s).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function exportMonth(kind, data) {
  const base = `stundenzettel-${data.year}-${String(data.month).padStart(2, '0')}-${slug(data.profile) || 'job'}`;
  if (kind === 'csv') return { name: `${base}.csv`, blob: csv(data) };
  if (kind === 'xlsx') return { name: `${base}.xlsx`, blob: xlsxMonth(data) };
  if (kind === 'pdf') return { name: `${base}.pdf`, blob: pdf(data) };
  throw new Error(`Unbekanntes Format: ${kind}`);
}

/* ---------- CSV (Semikolon, UTF-8 mit BOM – öffnet direkt in deutschem Excel) ---------- */

function csv(d) {
  const q = (v) => (/[;"\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const lines = [['Datum', 'Tag', 'Beginn', 'Ende', 'Pause (Min.)', 'Arbeitszeit (h:mm)', 'Arbeitszeit (dezimal)', 'Soll (h:mm)', 'Plus/Minus (h:mm)', 'Nachtarbeit (h:mm)']];
  for (const r of d.rows) {
    const has = r.net !== null;
    lines.push([r.dateDe, r.weekday, r.start, r.end, has ? r.breakMin : '', has ? formatHM(r.net) : '', has ? formatDecimal(r.net) : '',
      formatHM(r.soll), has || r.soll ? formatHM(r.diff, { sign: true }).replace('−', '-') : '', has && r.night ? formatHM(r.night) : '']);
  }
  lines.push([]);
  lines.push(['Summe', '', '', '', '', formatHM(d.total), formatDecimal(d.total), formatHM(d.soll), formatHM(d.saldo, { sign: true }).replace('−', '-'), formatHM(d.night)]);
  if (d.wage) lines.push(['Brutto', '', '', '', '', '', formatEuro(d.pay).replace(' €', ''), '', '', '']);
  const text = `﻿${lines.map((l) => l.map(q).join(';')).join('\r\n')}\r\n`;
  return new Blob([text], { type: 'text/csv;charset=utf-8' });
}

/* ---------- ZIP (Methode „stored“) ---------- */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function zip(files) {
  const enc = new TextEncoder();
  const parts = [];
  const central = [];
  let offset = 0;
  const dosTime = 0;
  const dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1;
  for (const f of files) {
    const name = enc.encode(f.name);
    const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
    const crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, dosTime, true); lh.setUint16(12, dosDate, true); lh.setUint32(14, crc, true);
    lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    parts.push(new Uint8Array(lh.buffer), name, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
    ch.setUint16(12, dosTime, true); ch.setUint16(14, dosDate, true); ch.setUint32(16, crc, true);
    ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true);
    ch.setUint16(30, 0, true); ch.setUint16(32, 0, true); ch.setUint16(34, 0, true); ch.setUint16(36, 0, true); ch.setUint32(38, 0, true);
    ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const cdSize = central.reduce((a, b) => a + b.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/* ---------- XLSX ---------- */

const xmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const col = (i) => { let s = ''; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };

// Stil-IDs (siehe styles.xml unten)
const S = { text: 0, time: 1, dur: 2, dec: 3, bold: 4, boldDur: 5, boldDec: 6, eur: 7, boldEur: 8, date: 9, head: 10, input: 11, inputTime: 12, int: 13 };

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="5"><numFmt numFmtId="164" formatCode="hh:mm"/><numFmt numFmtId="165" formatCode="[h]:mm"/><numFmt numFmtId="166" formatCode="0.00"/><numFmt numFmtId="167" formatCode="#,##0.00\\ &quot;€&quot;"/><numFmt numFmtId="168" formatCode="dd.mm.yyyy"/></numFmts>
<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0B5CAD"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF8DC"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="14">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="165" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
<xf numFmtId="166" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
<xf numFmtId="167" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="167" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
<xf numFmtId="168" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1"/>
<xf numFmtId="164" fontId="0" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1"/>
<xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Standard" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

// cell: { v: string|number, s: style, f: formula }
function sheetXml(rows, widths) {
  const body = rows.map((r, ri) => {
    if (!r) return '';
    const cells = r.map((c, ci) => {
      if (c === null || c === undefined) return '';
      const cell = typeof c === 'object' ? c : { v: c };
      const ref = `${col(ci)}${ri + 1}`;
      const s = cell.s ? ` s="${cell.s}"` : '';
      if (cell.f) return `<c r="${ref}"${s}><f>${xmlEsc(cell.f)}</f></c>`;
      if (cell.v === '' || cell.v === null || cell.v === undefined) return cell.s ? `<c r="${ref}"${s}/>` : '';
      if (typeof cell.v === 'number') return `<c r="${ref}"${s}><v>${cell.v}</v></c>`;
      return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${xmlEsc(cell.v)}</t></is></c>`;
    }).join('');
    return `<row r="${ri + 1}">${cells}</row>`;
  }).join('');
  const cols = widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${cols}</cols><sheetData>${body}</sheetData><pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="portrait" fitToHeight="1"/></worksheet>`;
}

function workbook(sheets) {
  const files = [
    { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>` },
    { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${xmlEsc(s.name.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: 'xl/styles.xml', data: STYLES },
    ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml(s.rows, s.widths) })),
  ];
  return zip(files);
}

const excelDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 864e5;
};
const tm = (hhmm) => { if (!hhmm) return ''; const [h, m] = hhmm.split(':').map(Number); return (h * 60 + m) / 1440; };

function xlsxMonth(d) {
  const H = (v) => ({ v, s: S.head });
  const rows = [[H('Datum'), H('Tag'), H('Beginn'), H('Ende'), H('Pause (Min.)'), H('Arbeitszeit'), H('Dezimal'), H('Soll'), H('Plus/Minus (dez.)')]];
  for (const r of d.rows) {
    const has = r.net !== null;
    rows.push([
      { v: excelDate(r.date), s: S.date }, r.weekday, { v: tm(r.start), s: S.time }, { v: tm(r.end), s: S.time },
      has ? { v: r.breakMin, s: S.int } : '', has ? { v: r.net / 1440, s: S.dur } : '', has ? { v: Math.round(r.net / 0.6) / 100, s: S.dec } : '',
      { v: r.soll / 1440, s: S.dur }, has || r.soll ? { v: Math.round(r.diff / 0.6) / 100, s: S.dec } : '',
    ]);
  }
  const last = rows.length;
  rows.push(null);
  rows.push([{ v: 'Summe', s: S.bold }, '', '', '', '', { f: `SUM(F2:F${last})`, s: S.boldDur }, { f: `SUM(G2:G${last})`, s: S.boldDec }, { f: `SUM(H2:H${last})`, s: S.boldDur }, { f: `SUM(I2:I${last})`, s: S.boldDec }]);
  const sumRow = rows.length;
  if (d.wage) {
    rows.push([{ v: 'Stundenlohn', s: S.bold }, '', '', '', '', '', { v: d.wage, s: S.eur }]);
    rows.push([{ v: 'Brutto', s: S.bold }, '', '', '', '', '', { f: `ROUND(G${sumRow}*G${sumRow + 1},2)`, s: S.boldEur }]);
  }
  rows.push(null);
  rows.push([`${d.profile} – erstellt mit derarbeitszeitrechner.de`]);
  return workbook([{ name: d.title, rows, widths: [12, 6, 9, 9, 12, 12, 10, 10, 16] }]);
}

// Leere Jahresvorlage: 12 Blätter mit Formeln (Nachtschicht-fähig)
export function excelTemplate(year) {
  const sheets = [];
  for (let m = 1; m <= 12; m++) {
    const H = (v) => ({ v, s: S.head });
    const rows = [[H('Datum'), H('Tag'), H('Beginn'), H('Ende'), H('Pause (Min.)'), H('Arbeitszeit'), H('Dezimal'), H('Notiz')]];
    const n = daysInMonth(year, m);
    let workdays = 0;
    for (let d = 1; d <= n; d++) {
      const iso = `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const wd = new Date(year, m - 1, d).getDay();
      if (wd >= 1 && wd <= 5) workdays++;
      const r = d + 1;
      rows.push([
        { v: excelDate(iso), s: S.date }, WEEKDAYS_SHORT[wd], { v: '', s: S.inputTime }, { v: '', s: S.inputTime }, { v: '', s: S.input },
        { f: `IF(OR(C${r}="",D${r}=""),"",MOD(D${r}-C${r},1)-N(E${r})/1440)`, s: S.dur },
        { f: `IF(F${r}="","",F${r}*24)`, s: S.dec }, { v: '', s: S.input },
      ]);
    }
    const last = n + 1;
    rows.push(null);
    const sumR = rows.length + 1;
    rows.push([{ v: 'Summe', s: S.bold }, '', '', '', '', { f: `SUM(F2:F${last})`, s: S.boldDur }, { f: `SUM(G2:G${last})`, s: S.boldDec }]);
    rows.push([{ v: 'Wochenstunden (Soll)', s: S.bold }, '', '', '', '', '', { v: 40, s: S.input }]);
    rows.push([{ v: `Soll (${workdays} Arbeitstage Mo–Fr)`, s: S.bold }, '', '', '', '', '', { f: `G${sumR + 1}/5*${workdays}`, s: S.boldDec }]);
    rows.push([{ v: 'Saldo (dezimal)', s: S.bold }, '', '', '', '', '', { f: `G${sumR}-G${sumR + 2}`, s: S.boldDec }]);
    rows.push([{ v: 'Stundenlohn (€)', s: S.bold }, '', '', '', '', '', { v: '', s: S.input }]);
    rows.push([{ v: 'Brutto', s: S.bold }, '', '', '', '', '', { f: `IF(G${sumR + 4}="","",ROUND(G${sumR}*G${sumR + 4},2))`, s: S.boldEur }]);
    rows.push(null);
    rows.push(['Gelbe Felder ausfüllen: Uhrzeiten als 08:00, Pause in Minuten. Nachtschichten werden automatisch erkannt.']);
    rows.push(['Vorlage von derarbeitszeitrechner.de – kostenlos, ohne Gewähr.']);
    sheets.push({ name: MONTHS[m - 1], rows, widths: [12, 6, 9, 9, 12, 12, 10, 28] });
  }
  return { name: `zeiterfassung-vorlage-${year}.xlsx`, blob: workbook(sheets) };
}

/* ---------- PDF (A4, Helvetica, WinAnsi) ---------- */

const WIN = { '€': 0x80, '‚': 0x82, '„': 0x84, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '−': 0x2d };
function pdfStr(s) {
  let out = '';
  for (const ch of String(s)) {
    let c = WIN[ch] ?? ch.codePointAt(0);
    if (c > 0xff) c = 0x3f;
    const chr = String.fromCharCode(c);
    out += chr === '(' || chr === ')' || chr === '\\' ? `\\${chr}` : chr;
  }
  return `(${out})`;
}
// grobe Helvetica-Breiten (1/1000 em) für Rechtsbündigkeit
const WID = { ' ': 278, ':': 278, ',': 278, '.': 278, '+': 584, '-': 333, '−': 333, h: 556, '€': 556 };
const textWidth = (s, size) => [...String(s)].reduce((a, c) => a + (WID[c] ?? (/\d/.test(c) ? 556 : 560)), 0) * size / 1000;

function pdf(d) {
  const ops = [];
  const text = (x, y, s, { size = 9.5, bold = false, right = false } = {}) => {
    const xx = right ? x - textWidth(s, size) : x;
    ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${xx.toFixed(2)} ${y.toFixed(2)} Td ${pdfStr(s)} Tj ET`);
  };
  const line = (x1, y1, x2, y2, w = 0.5, gray = 0.6) => ops.push(`${gray} G ${w} w ${x1} ${y1} m ${x2} ${y2} l S`);
  const rect = (x, y, w, h, gray) => ops.push(`${gray} g ${x} ${y} ${w} ${h} re f 0 g`);

  text(40, 800, `Stundenzettel ${d.title}`, { size: 17, bold: true });
  text(40, 782, `Job: ${d.profile}`, { size: 10 });
  text(250, 782, 'Name: ______________________________', { size: 10 });

  const cols = [
    { k: 'Datum', x: 40 }, { k: 'Tag', x: 100 }, { k: 'Beginn', x: 128 }, { k: 'Ende', x: 172 },
    { k: 'Pause', x: 255, r: true }, { k: 'Arbeitszeit', x: 320, r: true }, { k: 'Dezimal', x: 375, r: true },
    { k: 'Soll', x: 425, r: true }, { k: '+/−', x: 480, r: true }, { k: 'Unterschrift', x: 492 },
  ];
  let y = 752;
  rect(36, y - 4, 523, 16, 0.88);
  for (const c of cols) text(c.x, y, c.k, { bold: true, size: 9, right: c.r });
  y -= 16;
  const rowH = 15.5;
  for (const r of d.rows) {
    const wd = r.weekday;
    if (wd === 'Sa' || wd === 'So') rect(36, y - 4, 523, rowH, 0.95);
    const has = r.net !== null;
    const vals = [r.dateDe, wd, r.start, r.end ? `${r.end}${r.nextDay ? ' +1' : ''}` : '', has ? `${r.breakMin} Min.` : '',
      has ? formatHM(r.net) : '', has ? formatDecimal(r.net) : '', r.soll ? formatHM(r.soll) : '',
      has || r.soll ? formatHM(r.diff, { sign: true }) : '', ''];
    cols.forEach((c, i) => { if (vals[i]) text(c.x, y, vals[i], { right: c.r }); });
    line(36, y - 4.5, 559, y - 4.5, 0.3, 0.8);
    y -= rowH;
  }
  y -= 6;
  line(36, y + 9, 559, y + 9, 0.8, 0.2);
  text(40, y - 2, 'Summe', { bold: true, size: 10 });
  text(cols[5].x, y - 2, formatHM(d.total), { bold: true, size: 10, right: true });
  text(cols[6].x, y - 2, formatDecimal(d.total), { bold: true, size: 10, right: true });
  text(cols[7].x, y - 2, formatHM(d.soll), { bold: true, size: 10, right: true });
  text(cols[8].x, y - 2, formatHM(d.saldo, { sign: true }), { bold: true, size: 10, right: true });
  y -= 18;
  const extra = [`Überstunden: ${formatHM(d.overtime)} h`];
  if (d.night) extra.push(`Nachtarbeit: ${formatHM(d.night)} h`);
  if (d.wage) extra.push(`Brutto: ${formatEuro(d.pay)} (${formatEuro(Math.round(d.wage * 100))}/h)`);
  text(40, y, extra.join('   ·   '), { size: 9.5 });

  const sy = Math.min(y - 55, 110);
  line(40, sy, 270, sy, 0.8, 0);
  line(320, sy, 555, sy, 0.8, 0);
  text(40, sy - 12, 'Datum, Unterschrift Arbeitnehmer/in', { size: 8.5 });
  text(320, sy - 12, 'Datum, Unterschrift Arbeitgeber/in', { size: 8.5 });
  text(40, 30, 'Erstellt mit derarbeitszeitrechner.de – Angaben ohne Gewähr.', { size: 7.5 });

  const content = ops.join('\n');
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    `<< /Title ${pdfStr(`Stundenzettel ${d.title}`)} /Producer (derarbeitszeitrechner.de) >>`,
  ];
  let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
  const offsets = [];
  objs.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info 7 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
  return new Blob([bytes], { type: 'application/pdf' });
}

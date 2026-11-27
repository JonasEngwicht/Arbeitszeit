// Rechenkern: reine Funktionen ohne UI-Abhängigkeit.
// Intern wird ausschließlich in ganzen Minuten gerechnet.
import { LAW, valueAt } from './config.js';

const DAY = 1440;

/* ---------- Eingabe ---------- */

// "8" → 480, "830" → 510, "0830", "8:30", "8.30", "16,15" → Minuten. Ungültig → null
export function parseTime(input) {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') return Number.isFinite(input) ? input : null;
  const s = String(input).trim().replace(/\s*uhr$/i, '');
  if (!s) return null;
  let h;
  let m;
  const sep = s.match(/^(\d{1,2})\s*[:.,h]\s*(\d{0,2})$/i);
  if (sep) {
    h = +sep[1];
    m = sep[2] === '' ? 0 : +sep[2];
  } else if (/^\d{1,4}$/.test(s)) {
    if (s.length <= 2) { h = +s; m = 0; }
    else if (s.length === 3) { h = +s[0]; m = +s.slice(1); }
    else { h = +s.slice(0, 2); m = +s.slice(2); }
  } else return null;
  if (h > 24 || m > 59 || (h === 24 && m > 0)) return null;
  return h * 60 + m;
}

// Dauer: "7:45", "7,75", "7.75", "45 min", "-1:30" → Minuten
export function parseDuration(input) {
  if (input === null || input === undefined) return null;
  let s = String(input).trim().toLowerCase().replace(/\s+/g, '');
  if (!s) return null;
  let sign = 1;
  if (/^[-−]/.test(s)) { sign = -1; s = s.slice(1); }
  s = s.replace(/(h|std|stunden)$/, '');
  let r = s.match(/^(\d+):(\d{1,2})$/);
  if (r) { if (+r[2] > 59) return null; return sign * (+r[1] * 60 + +r[2]); }
  r = s.match(/^(\d+)(?:m|min|minuten)$/);
  if (r) return sign * +r[1];
  r = s.match(/^(\d*)[.,]?(\d*)$/);
  if (r && (r[1] || r[2])) return sign * decimalToMinutes(parseFloat(`${r[1] || 0}.${r[2] || 0}`));
  return null;
}

export const decimalToMinutes = (h) => Math.round(h * 60);
export const minutesToDecimal = (m) => Math.round((m / 60) * 100) / 100;
// Industriezeit: 1 Industriestunde = 100 Industrieminuten, 1 Industrieminute = 0,6 Minuten (36 Sekunden)
export const minutesToIndustry = (min) => Math.round((min / 60) * 100);
export const industryToMinutes = (ind) => Math.round(ind * 0.6);

// Normalzeit: "7:45", "745", "7 h 45 min", "7h", "45 min", "8" (= 8 Stunden) → Minuten. Ungültig → null
export function parseNormalTime(input) {
  const s = String(input ?? '').trim().toLowerCase();
  if (!s) return null;
  const r = s.match(/^(\d{1,3})\s*(?:h|std\.?|stunden?)\s*(?:(\d{1,2})\s*(?:m|min\.?|minuten?)?)?$/);
  if (r) { const m = +(r[2] || 0); return m > 59 ? null : +r[1] * 60 + m; }
  if (/^\d{3,4}$/.test(s)) { const m = +s.slice(-2); return m > 59 ? null : +s.slice(0, -2) * 60 + m; }
  if (/^\d{1,2}$/.test(s)) return +s * 60;
  const d = parseDuration(s);
  return d === null || d < 0 ? null : d;
}

// Dezimalstunden / Industriezeit: "7,75", "7.75", "7,75 h" → Minuten. Ungültig → null
export function parseDecimalHours(input) {
  const s = String(input ?? '').trim().toLowerCase().replace(/\s*(h|std\.?|stunden?)$/, '');
  if (!/^\d*[.,]?\d*$/.test(s) || !/\d/.test(s)) return null;
  return decimalToMinutes(parseFloat(s.replace(',', '.')));
}

// Zeitraum von–bis mit Pause (über Mitternacht erlaubt) → { gross, net, nextDay } in Minuten oder null
export function spanInfo(start, end, breakMin = 0) {
  const a = parseTime(start);
  const b = parseTime(end);
  if (a === null || b === null) return null;
  const gross = (b - a + DAY) % DAY;
  const pause = Math.max(0, Math.round(breakMin || 0));
  if (pause > gross) return null;
  return { gross, net: gross - pause, pause, nextDay: b < a };
}

/* ---------- Ausgabe ---------- */

export function formatHM(min, { sign = false } = {}) {
  if (min === null || min === undefined || Number.isNaN(min)) return '–';
  const neg = min < 0;
  const a = Math.abs(Math.round(min));
  const str = `${Math.floor(a / 60)}:${String(a % 60).padStart(2, '0')}`;
  if (neg) return `−${str}`;
  return sign && a > 0 ? `+${str}` : str;
}

export function formatDecimal(min, { sign = false } = {}) {
  if (min === null || min === undefined || Number.isNaN(min)) return '–';
  const v = (Math.abs(min) / 60).toFixed(2).replace('.', ',');
  if (min < 0 && v !== '0,00') return `−${v}`;
  return sign && min > 0 ? `+${v}` : v;
}

export function formatClock(min) {
  if (min === null || min === undefined) return '';
  const m = ((Math.round(min) % DAY) + DAY) % DAY;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function formatEuro(cents) {
  const neg = cents < 0;
  const a = Math.abs(Math.round(cents));
  const euros = Math.floor(a / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${neg ? '−' : ''}${euros},${String(a % 100).padStart(2, '0')} €`;
}

/* ---------- Datum ---------- */

export function parseIso(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function toIso(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function addDays(iso, n) {
  const d = parseIso(iso);
  d.setDate(d.getDate() + n);
  return toIso(d);
}
export function mondayOf(iso) {
  const d = parseIso(iso);
  const wd = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - wd);
  return toIso(d);
}
export function isoWeek(iso) {
  const d = parseIso(iso);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const jan4 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - jan4) / 864e5 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
}
export function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate(); // month 1–12
}
// Absolute Minuten (lokale Zeit, berücksichtigt Zeitumstellung)
export function absMinutes(iso, min) {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(new Date(y, m - 1, d, 0, min).getTime() / 60000);
}
export const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
export const WEEKDAYS_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
export const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

/* ---------- Tagesrechnung ---------- */

export function requiredBreak(workMin, minor = false) {
  for (const r of minor ? LAW.breaksMinor : LAW.breaksAdult) if (workMin > r.over) return r.minutes;
  return 0;
}

function thresholdFor(required, minor) {
  for (const r of minor ? LAW.breaksMinor : LAW.breaksAdult) if (r.minutes === required) return r.over;
  return 0;
}

function overlap(a1, a2, b1, b2) {
  return Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));
}

export function nightMinutes(s, e, bakery = false) {
  const w = bakery ? LAW.nightBakery : LAW.night;
  let total = 0;
  for (let k = -1; k <= 2; k++) total += overlap(s, e, k * DAY + w.from, (k + 1) * DAY + w.to);
  return total;
}

/**
 * Berechnet einen Arbeitstag.
 * @param {object} p
 *  start, end: Minuten oder Text ("8:00")
 *  breaks: [{ kind: 'min', minutes } | { kind: 'range', from, to }]
 *  minor: Jugendliche (unter 18), bakery: Bäckerei-Nachtzeit,
 *  autoDeduct: Mindestpause abziehen, wenn weniger eingetragen
 *  date: ISO-Datum (optional, für Zeitumstellung)
 */
export function calcDay(p) {
  const start = parseTime(p.start);
  const end = parseTime(p.end);
  const minor = !!p.minor;
  const res = {
    valid: false, start, end, nextDay: false, gross: 0, breakTotal: 0, breakCounted: 0,
    shortBreaks: 0, net: 0, required: 0, missing: 0, deducted: 0, night: 0, warnings: [], ranges: [], s: 0, e: 0,
  };
  if (start === null || end === null) return res;
  res.valid = true;

  const s = start;
  let e = end;
  if (e < s) { e += DAY; res.nextDay = true; }
  res.gross = e - s;
  if (p.date) {
    const endIso = res.nextDay ? addDays(p.date, 1) : p.date;
    res.gross = absMinutes(endIso, end) - absMinutes(p.date, start);
  }
  const dst = res.gross - (e - s);

  // Pausen einsortieren
  const ranges = [];
  let minuteBreaks = 0;
  let outside = false;
  for (const b of p.breaks || []) {
    if (b.kind === 'range') {
      const f = parseTime(b.from);
      const t = parseTime(b.to);
      if (f === null || t === null) continue;
      const dur = (t - f + DAY) % DAY;
      if (dur === 0) continue;
      let f2 = f;
      if (f2 < s) f2 += DAY;
      const a = Math.max(f2, s);
      const z = Math.min(f2 + dur, e);
      if (z <= a) { outside = true; continue; }
      if (z - a < dur) outside = true;
      ranges.push([a, z]);
    } else {
      const m = typeof b.minutes === 'number' ? b.minutes : parseDuration(b.minutes);
      if (m && m > 0) {
        minuteBreaks++;
        res.breakTotal += m;
        if (m >= LAW.minBreakSegment) res.breakCounted += m; else res.shortBreaks++;
      }
    }
  }
  ranges.sort((x, y) => x[0] - y[0]);
  const merged = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r]);
  }
  for (const [a, z] of merged) {
    const d = z - a;
    res.breakTotal += d;
    if (d >= LAW.minBreakSegment) res.breakCounted += d; else res.shortBreaks++;
  }

  res.net = Math.max(0, res.gross - res.breakTotal);
  res.required = requiredBreak(res.net, minor);
  const lack = Math.max(0, res.required - res.breakCounted);

  if (lack > 0 && p.autoDeduct) {
    const floor = thresholdFor(res.required, minor);
    const newNet = Math.max(res.net - lack, Math.min(res.net, floor));
    res.deducted = res.net - newNet;
    res.net = newNet;
    res.missing = 0;
  } else {
    res.missing = lack;
  }
  res.night = nightMinutes(s, e, !!p.bakery);
  res.ranges = merged;
  res.s = s;
  res.e = e;

  // Hinweise
  const W = res.warnings;
  if (res.missing > 0) {
    const limit = res.required === (minor ? 60 : 45) ? (minor ? '6' : '9') : (minor ? '4,5' : '6');
    W.push({
      level: 'warn', code: 'break',
      text: `${res.missing} Min. Pause fehlen (mind. ${res.required} Min. bei über ${limit} h, ${minor ? '§ 11 JArbSchG' : '§ 4 ArbZG'}).`,
    });
  }
  if (res.shortBreaks > 0 && res.required > 0 && (res.missing > 0 || res.deducted > 0)) {
    W.push({
      level: 'warn', code: 'short',
      text: `Pausenabschnitte unter ${LAW.minBreakSegment} Minuten zählen nicht als Pflichtpause (${res.shortBreaks}× eingetragen).`,
    });
  }
  if (res.deducted > 0) {
    W.push({ level: 'info', code: 'deducted', text: `Mindestpause abgezogen: ${res.deducted} Min. zusätzlich, weil weniger Pause eingetragen war.` });
  }
  if (merged.length && !minuteBreaks) {
    const maxBlock = minor ? LAW.maxBlockMinor : LAW.maxBlockAdult;
    let cursor = s;
    let longest = 0;
    for (const [a, z] of merged) {
      if (z - a < LAW.minBreakSegment) continue;
      longest = Math.max(longest, a - cursor);
      cursor = z;
    }
    longest = Math.max(longest, e - cursor);
    if (longest > maxBlock) {
      W.push({
        level: 'warn', code: 'block',
        text: `Du arbeitest ${formatHM(longest)} h am Stück. Länger als ${minor ? '4,5' : '6'} Stunden ohne Pause ist nicht erlaubt.`,
      });
    }
  }
  if (outside) W.push({ level: 'info', code: 'outside', text: 'Eine Pause liegt ganz oder teilweise außerhalb der Arbeitszeit und wird nur innerhalb gezählt.' });
  if (minor && res.net > LAW.dailyMaxMinor) {
    W.push({ level: 'error', code: 'max', text: 'Jugendliche dürfen höchstens 8 Stunden am Tag arbeiten (§ 8 JArbSchG).' });
  } else if (!minor && res.net > LAW.dailyMax) {
    W.push({ level: 'error', code: 'max', text: 'Über 10 Stunden: Mehr als 10 Stunden Arbeitszeit am Tag sind nach § 3 ArbZG nicht erlaubt.' });
  } else if (!minor && res.net > LAW.dailyRegular) {
    W.push({ level: 'info', code: 'over8', text: 'Über 8 Stunden – bis 10 Stunden nur mit späterem Ausgleich erlaubt (§ 3 ArbZG).' });
  }
  if (dst !== 0) {
    W.push({ level: 'info', code: 'dst', text: `Zeitumstellung in dieser Schicht: ${dst > 0 ? 'eine Stunde mehr' : 'eine Stunde weniger'} gerechnet.` });
  }
  return res;
}

/* ---------- Ruhezeit ---------- */

// entries: [{ date, start, end }] beliebig sortiert. Liefert Verstöße gegen § 5 ArbZG.
export function restViolations(entries, minor = false) {
  const min = minor ? LAW.minRestMinor : LAW.minRest;
  const list = entries
    .map((x) => ({ x, s: parseTime(x.start), e: parseTime(x.end) }))
    .filter((o) => o.x.date && o.s !== null && o.e !== null && o.s !== o.e)
    .map((o) => {
      const endIso = o.e < o.s ? addDays(o.x.date, 1) : o.x.date;
      return { date: o.x.date, startAbs: absMinutes(o.x.date, o.s), endAbs: absMinutes(endIso, o.e) };
    })
    .sort((a, b) => a.startAbs - b.startAbs);
  const out = [];
  for (let i = 1; i < list.length; i++) {
    const rest = list[i].startAbs - list[i - 1].endAbs;
    if (rest < min) {
      out.push({
        date: list[i].date, prevDate: list[i - 1].date, rest,
        text: rest < 0
          ? 'Schichten überschneiden sich.'
          : `Ruhezeit nur ${formatHM(rest)} h statt ${min / 60} h (${minor ? '§ 13 JArbSchG' : '§ 5 ArbZG'}).`,
      });
    }
  }
  return out;
}

/* ---------- Lohn ---------- */

export function wageCents(netMin, hourlyRate) {
  const rateCents = Math.round(Number(hourlyRate) * 100);
  if (!Number.isFinite(rateCents) || rateCents <= 0) return 0;
  return Math.round((netMin * rateCents) / 60);
}
export const minWageAt = (iso) => valueAt(LAW.minWage, iso);
export const minijobAt = (iso) => valueAt(LAW.minijobLimit, iso);
export function belowMinWage(rate, iso) {
  const r = Number(rate);
  return Number.isFinite(r) && r > 0 && r < minWageAt(iso);
}

/* ---------- Feiertage ---------- */

export function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const holidayCache = {};
// Gesetzliche Feiertage: bundesweit plus Bundesland (state = Kürzel wie "BB" oder leer)
export function holidays(year, state = '') {
  const key = `${year}|${state}`;
  if (holidayCache[key]) return holidayCache[key];
  const easter = easterSunday(year);
  const h = {};
  const fix = (md, name) => { h[`${year}-${md}`] = name; };
  const mov = (offset, name) => { h[addDays(easter, offset)] = name; };
  const inState = (...list) => list.includes(state);
  fix('01-01', 'Neujahr');
  mov(-2, 'Karfreitag');
  mov(1, 'Ostermontag');
  fix('05-01', 'Tag der Arbeit');
  mov(39, 'Christi Himmelfahrt');
  mov(50, 'Pfingstmontag');
  fix('10-03', 'Tag der Deutschen Einheit');
  fix('12-25', '1. Weihnachtstag');
  fix('12-26', '2. Weihnachtstag');
  if (inState('BW', 'BY', 'ST')) fix('01-06', 'Heilige Drei Könige');
  if (inState('BE', 'MV')) fix('03-08', 'Internationaler Frauentag');
  if (inState('BB')) { mov(0, 'Ostersonntag'); mov(49, 'Pfingstsonntag'); }
  if (inState('BW', 'BY', 'HE', 'NW', 'RP', 'SL')) mov(60, 'Fronleichnam');
  if (inState('SL', 'BY')) fix('08-15', 'Mariä Himmelfahrt');
  if (inState('TH')) fix('09-20', 'Weltkindertag');
  if (inState('BB', 'HB', 'HH', 'MV', 'NI', 'SN', 'ST', 'SH', 'TH')) fix('10-31', 'Reformationstag');
  if (inState('BW', 'BY', 'NW', 'RP', 'SL')) fix('11-01', 'Allerheiligen');
  if (inState('SN')) {
    const d = parseIso(`${year}-11-22`);
    d.setDate(d.getDate() - ((d.getDay() + 4) % 7)); // Mittwoch vor dem 23.11.
    h[toIso(d)] = 'Buß- und Bettag';
  }
  holidayCache[key] = h;
  return h;
}
export function holidayName(iso, state = '') {
  return holidays(+iso.slice(0, 4), state)[iso] || null;
}

/* ---------- Zuschläge (§ 3b EStG) ---------- */

export function defaultSurcharges() {
  return { enabled: false, ...LAW.surcharge };
}

// Liefert Zuschlagsminuten je Art und den Betrag in Cent.
// result: Ergebnis von calcDay, date: ISO-Datum des Schichtbeginns
export function calcSurcharges(result, date, profile) {
  const out = { night: 0, night04: 0, sunday: 0, holiday: 0, special: 0, cents: 0 };
  const sc = profile.surcharges;
  if (!sc || !sc.enabled || !result || !result.valid || !date) return out;
  const { s, e, ranges } = result;
  const w = LAW.surchargeNight;
  const info = [0, 1, 2].map((off) => {
    const iso = addDays(date, off);
    const md = iso.slice(5);
    return { wd: parseIso(iso).getDay(), md, hol: !!holidayName(iso, profile.state || '') };
  });
  const manualHoliday = result.type === 'feiertag';
  let counted = 0;
  for (let m = s; m < e; m++) {
    if (ranges.some(([a, z]) => m >= a && m < z)) continue;
    counted++;
    const off = Math.floor(m / DAY);
    const mod = m % DAY;
    const d = info[off];
    const prev = off > 0 ? info[off - 1] : null;
    const carry = prev && mod < 240; // 0–4 Uhr zählt zum Vortag, wenn die Schicht davor begann
    if (mod >= w.from || mod < w.to) {
      if (carry) out.night04++; else out.night++;
    }
    const special = (x) => x.md === '12-25' || x.md === '12-26' || x.md === '05-01';
    if (special(d) || (carry && special(prev)) || (d.md === '12-24' && mod >= 840)) out.special++;
    else if (d.hol || (carry && prev.hol) || (d.md === '12-31' && mod >= 840) || (manualHoliday && off === 0)) out.holiday++;
    else if (d.wd === 0 || (carry && prev.wd === 0)) out.sunday++;
  }
  // Pausen ohne Uhrzeit werden anteilig abgezogen
  const factor = counted > 0 ? Math.min(1, result.net / counted) : 0;
  const rate = Math.round(Number(profile.wage || 0) * 100);
  let cents = 0;
  for (const k of ['night', 'night04', 'sunday', 'holiday', 'special']) {
    out[k] = Math.round(out[k] * factor);
    cents += (out[k] * rate * (Number(sc[k]) || 0)) / 100 / 60;
  }
  out.cents = Math.round(cents);
  return out;
}

/* ---------- Woche / Monat ---------- */

export const weeklyToMonthly = (weeklyMin) => Math.round(weeklyMin * LAW.weeksPerMonth);

export const DAY_TYPES = {
  work: 'Arbeit', urlaub: 'Urlaub', krank: 'Krank', feiertag: 'Feiertag', ausgleich: 'Überstundenabbau',
};

export function dailyTarget(profile) {
  const days = profile.workdays?.length || 5;
  return Math.round((profile.weeklyMinutes ?? 2400) / days);
}
function isWorkday(iso, profile) {
  return (profile.workdays || [1, 2, 3, 4, 5]).includes(parseIso(iso).getDay());
}

// Ein Kalendertag mit Soll, Ist, Gutschrift (Urlaub/Krank) und Zuschlägen
export function dayInfo(date, entry, profile) {
  const type = (entry && entry.type) || 'work';
  const holiday = holidayName(date, profile.state || '');
  const target = isWorkday(date, profile) ? dailyTarget(profile) : 0;
  let result = null;
  if (entry && type === 'work') {
    result = calcDay({ ...entry, minor: profile.minor, autoDeduct: profile.autoDeduct, bakery: profile.bakery, date });
  }
  const valid = !!(result && result.valid);
  const net = valid ? result.net : 0;
  let soll = target;
  let credit = 0;
  if (holiday || type === 'feiertag') soll = 0;
  else if (type === 'urlaub' || type === 'krank') credit = target;
  const surcharge = valid ? calcSurcharges(result, date, profile) : null;
  return { date, entry, type, holiday, result: valid ? result : (result || null), valid, net, soll, credit, diff: net + credit - soll, surcharge };
}

function summarize(dates, entries, profile) {
  let total = 0;
  let soll = 0;
  let credit = 0;
  let night = 0;
  let workedDays = 0;
  let surchargeCents = 0;
  const count = { urlaub: 0, krank: 0, feiertag: 0, ausgleich: 0 };
  const sur = { night: 0, night04: 0, sunday: 0, holiday: 0, special: 0 };
  const days = dates.map((date) => {
    const d = dayInfo(date, entries[date] || null, profile);
    total += d.net;
    soll += d.soll;
    credit += d.credit;
    if (d.type in count) count[d.type]++;
    if (d.valid) {
      night += d.result.night;
      if (d.net > 0) workedDays++;
      surchargeCents += d.surcharge.cents;
      for (const k of Object.keys(sur)) sur[k] += d.surcharge[k];
    }
    return d;
  });
  const rest = restViolations(dates.map((d) => entries[d] && { ...entries[d], date: d }).filter(Boolean), profile.minor);
  const basePay = profile.wage ? wageCents(total + credit, profile.wage) : 0;
  const saldo = total + credit - soll;
  return {
    days, total, soll, credit, saldo, overtime: Math.max(0, saldo), night, workedDays, rest, count,
    surcharges: sur, surchargeCents, basePay, pay: basePay + surchargeCents,
  };
}

export function weekSummary(entries, anyIso, profile) {
  const mon = mondayOf(anyIso);
  const dates = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  return { monday: mon, week: isoWeek(mon), ...summarize(dates, entries, profile) };
}

export function monthSummary(entries, year, month, profile) {
  const n = daysInMonth(year, month);
  const dates = Array.from({ length: n }, (_, i) => `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`);
  const s = summarize(dates, entries, profile);
  const first = dates[0];
  return {
    year, month, ...s,
    minijobLimit: minijobAt(first),
    overMinijob: profile.wage ? s.pay > minijobAt(first) * 100 : false,
  };
}

/* ---------- Überstundenkonto ---------- */

// Kontostand bis einschließlich uptoIso: Startsaldo + Plus/Minus aller Tage ab Kontobeginn.
// Kontobeginn = profile.accountStart oder der erste Eintrag.
export function accountBalance(entries, profile, uptoIso) {
  const dates = Object.keys(entries).sort();
  const start = profile.accountStart || dates[0];
  const base = Number(profile.startBalance) || 0;
  if (!start || start > uptoIso) return { start: start || null, balance: base, days: 0 };
  let balance = base;
  let days = 0;
  for (let d = start; d <= uptoIso; d = addDays(d, 1)) {
    balance += dayInfo(d, entries[d] || null, profile).diff;
    days++;
    if (days > 3700) break;
  }
  return { start, balance, days };
}

/* ---------- Gehalt ↔ Stundenlohn ---------- */

// Übliche Formel: Monatsgehalt × 3 ÷ 13 ÷ Wochenstunden (13 Wochen je Quartal)
export function salaryToHourly(monthlyEuro, weeklyHours) {
  if (!(monthlyEuro > 0) || !(weeklyHours > 0)) return null;
  return Math.round(((monthlyEuro * 3) / 13 / weeklyHours) * 100) / 100;
}
export function hourlyToSalary(hourlyEuro, weeklyHours) {
  if (!(hourlyEuro > 0) || !(weeklyHours > 0)) return null;
  return Math.round(((hourlyEuro * weeklyHours * 13) / 3) * 100) / 100;
}
const round2 = (v) => Math.round(v * 100) / 100;
// Höchste Stundenzahl pro Monat, mit der ein Stundenlohn unter der Minijob-Grenze bleibt (abgerundet auf 0,1 h)
export function minijobMaxHours(hourlyEuro, iso) {
  if (!(hourlyEuro > 0)) return null;
  return Math.floor((minijobAt(iso) / hourlyEuro) * 10 + 1e-9) / 10;
}
// Stundenlohnrechner: Gehalt (pro Monat oder Jahr) → Stundenlohn mit Mindestlohn- und Minijob-Prüfung
export function salaryInfo({ amount, period = 'month', weeklyHours, iso } = {}) {
  if (!(amount > 0) || !(weeklyHours > 0)) return null;
  const monthly = round2(period === 'year' ? amount / 12 : amount);
  const rate = salaryToHourly(monthly, weeklyHours);
  if (rate === null) return null;
  const minWage = minWageAt(iso);
  const minijobLimit = minijobAt(iso);
  return {
    monthly,
    yearly: round2(period === 'year' ? amount : amount * 12),
    rate,
    monthlyHours: round2((weeklyHours * 13) / 3),
    minWage,
    belowMinWage: rate < minWage,
    minijobLimit,
    overMinijob: monthly > minijobLimit,
    minijobMaxHours: minijobMaxHours(rate, iso),
  };
}
// Stundenlohn → Monats- und Jahreslohn
export function wageInfo({ rate, weeklyHours, iso } = {}) {
  const monthly = hourlyToSalary(rate, weeklyHours);
  if (monthly === null) return null;
  const minWage = minWageAt(iso);
  const minijobLimit = minijobAt(iso);
  return {
    monthly,
    yearly: round2(monthly * 12),
    monthlyHours: round2((weeklyHours * 13) / 3),
    minWage,
    belowMinWage: rate < minWage,
    minijobLimit,
    overMinijob: monthly > minijobLimit,
    minijobMaxHours: minijobMaxHours(rate, iso),
  };
}

/* ---------- Teilen-Link ---------- */

function b64urlEncode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}
// Packt einen Monat (ohne Lohn) in einen kurzen Text für das URL-Fragment
export function encodeShare(entries, profile, year, month) {
  const prefix = `${year}-${String(month).padStart(2, '0')}-`;
  const e = Object.keys(entries).filter((d) => d.startsWith(prefix)).sort().map((d) => {
    const x = entries[d];
    const row = [+d.slice(8), x.start || '', x.end || '', x.breaks || []];
    if (x.type && x.type !== 'work') row.push(x.type);
    return row;
  });
  return b64urlEncode(JSON.stringify({
    v: 1, n: profile.name, w: profile.weeklyMinutes, d: profile.workdays, s: profile.state || '', y: year, m: month, e,
  }));
}
export function decodeShare(text) {
  try {
    const o = JSON.parse(b64urlDecode(text));
    if (o.v !== 1 || !Number.isInteger(o.y) || !Number.isInteger(o.m) || o.m < 1 || o.m > 12 || !Array.isArray(o.e)) return null;
    const entries = {};
    for (const r of o.e) {
      if (!Array.isArray(r) || !Number.isInteger(r[0]) || r[0] < 1 || r[0] > 31) continue;
      const date = `${o.y}-${String(o.m).padStart(2, '0')}-${String(r[0]).padStart(2, '0')}`;
      const breaks = (Array.isArray(r[3]) ? r[3] : []).slice(0, 20).map((b) => (b && b.kind === 'range'
        ? { kind: 'range', from: String(b.from || '').slice(0, 5), to: String(b.to || '').slice(0, 5) }
        : { kind: 'min', minutes: Math.max(0, Math.min(1440, Number(b && b.minutes) || 0)) }));
      const type = Object.prototype.hasOwnProperty.call(DAY_TYPES, r[4]) ? r[4] : 'work';
      entries[date] = { date, start: String(r[1] || '').slice(0, 5), end: String(r[2] || '').slice(0, 5), breaks, type };
    }
    const workdays = (Array.isArray(o.d) ? o.d : [1, 2, 3, 4, 5]).filter((x) => Number.isInteger(x) && x >= 0 && x <= 6);
    return {
      year: o.y, month: o.m, entries,
      profile: {
        name: String(o.n || 'Geteilter Monat').slice(0, 60),
        weeklyMinutes: Math.max(0, Math.min(6000, Number(o.w) || 2400)),
        workdays: workdays.length ? workdays : [1, 2, 3, 4, 5], state: String(o.s || '').slice(0, 2),
      },
    };
  } catch {
    return null;
  }
}

/* ---------- Feierabend ---------- */

export function quittingTime({ start, target, breakMinutes = 0, minor = false }) {
  const s = parseTime(start);
  const t = typeof target === 'number' ? target : parseDuration(target);
  if (s === null || t === null || t < 0) return null;
  const req = requiredBreak(t, minor);
  const brk = Math.max(Number(breakMinutes) || 0, req);
  const maxWork = minor ? LAW.dailyMaxMinor : LAW.dailyMax;
  const latest = s + maxWork + Math.max(Number(breakMinutes) || 0, requiredBreak(maxWork, minor));
  return {
    end: s + t + brk, breakUsed: brk, required: req,
    nextDay: s + t + brk >= DAY, latest, latestNextDay: latest >= DAY,
  };
}

/* ---------- Addieren ---------- */

// rows: [{ op: '+'|'-', value: "7:45" | "8:00-12:30" }]
export function parseSpan(value) {
  const s = String(value || '').trim();
  const r = s.match(/^(.+?)\s*(?:-|–|bis)\s*(.+)$/);
  if (r && parseTime(r[1]) !== null && parseTime(r[2]) !== null) {
    const a = parseTime(r[1]);
    const b = parseTime(r[2]);
    return (b - a + DAY) % DAY;
  }
  return parseDuration(s);
}
export function sumRows(rows) {
  let plus = 0;
  let minus = 0;
  let count = 0;
  for (const row of rows) {
    const v = parseSpan(row.value);
    if (v === null) continue;
    count++;
    if (row.op === '-') minus += v; else plus += v;
  }
  return { plus, minus, total: plus - minus, count };
}

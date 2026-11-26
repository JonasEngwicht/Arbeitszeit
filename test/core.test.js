// Testfälle aus der Projektbeschreibung (Abschnitt „Abnahme“) plus Randfälle.
// Ausführen: npm test   (läuft mit TZ=Europe/Berlin)
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcDay, parseTime, parseDuration, formatHM, formatDecimal, formatEuro, wageCents, belowMinWage,
  weeklyToMonthly, restViolations, quittingTime, sumRows, monthSummary, weekSummary, isoWeek,
} from '../src/js/core.js';

const codes = (r) => r.warnings.map((w) => w.code);
const pause = (...m) => m.map((minutes) => ({ kind: 'min', minutes }));

test('1: 08:00–16:30, Pause 30 → 8:00 h, keine Warnung', () => {
  const r = calcDay({ start: '08:00', end: '16:30', breaks: pause(30) });
  assert.equal(formatHM(r.net), '8:00');
  assert.equal(formatDecimal(r.net), '8,00');
  assert.deepEqual(r.warnings, []);
});

test('2: 07:30–16:15, Pause 45 → 8:00 h', () => {
  const r = calcDay({ start: '07:30', end: '16:15', breaks: pause(45) });
  assert.equal(formatHM(r.net), '8:00');
  assert.equal(formatDecimal(r.net), '8,00');
});

test('3: 22:00–06:00, Pause 30 → 7:30 h, +1 Tag, Nacht 7:00 brutto', () => {
  const r = calcDay({ start: '22:00', end: '06:00', breaks: pause(30) });
  assert.equal(formatHM(r.net), '7:30');
  assert.equal(formatDecimal(r.net), '7,50');
  assert.equal(r.nextDay, true);
  assert.equal(formatHM(r.night), '7:00');
});

test('4: 08:00–15:00 ohne Pause → 7:00 h, 30 Min. fehlen', () => {
  const r = calcDay({ start: '08:00', end: '15:00', breaks: [] });
  assert.equal(formatHM(r.net), '7:00');
  assert.equal(r.missing, 30);
  assert.match(r.warnings[0].text, /^30 Min\. Pause fehlen/);
});

test('5: 08:00–18:00, Pause 30 → 9:30 h, 15 Min. fehlen, Info über 8 h', () => {
  const r = calcDay({ start: '08:00', end: '18:00', breaks: pause(30) });
  assert.equal(formatHM(r.net), '9:30');
  assert.equal(r.missing, 15);
  assert.match(r.warnings.find((w) => w.code === 'break').text, /^15 Min\. Pause fehlen/);
  assert.ok(codes(r).includes('over8'));
});

test('6: 08:00–18:00, drei Pausen à 10 Min. → 9:30 h, 45 Min. fehlen, kurze Abschnitte', () => {
  const r = calcDay({ start: '08:00', end: '18:00', breaks: pause(10, 10, 10) });
  assert.equal(formatHM(r.net), '9:30');
  assert.equal(r.missing, 45);
  assert.ok(codes(r).includes('short'));
});

test('7: 06:00–17:30, Pause 45 → 10:45 h, rote Warnung über 10 h', () => {
  const r = calcDay({ start: '06:00', end: '17:30', breaks: pause(45) });
  assert.equal(formatHM(r.net), '10:45');
  const w = r.warnings.find((x) => x.code === 'max');
  assert.equal(w.level, 'error');
  assert.equal(r.missing, 0);
});

test('8: Mo 14:00–23:00, Di 08:00 → Ruhezeit 9 h statt 11 h', () => {
  const v = restViolations([
    { date: '2026-11-23', start: '14:00', end: '23:00' },
    { date: '2026-11-24', start: '08:00', end: '16:00' },
  ]);
  assert.equal(v.length, 1);
  assert.equal(v[0].rest, 540);
  assert.match(v[0].text, /9:00 h statt 11 h/);
});

test('9: Dezimal 7:45 → 7,75 h und 0,8 h → 0:48 h', () => {
  assert.equal(formatDecimal(parseDuration('7:45')), '7,75');
  assert.equal(formatHM(parseDuration('0,8')), '0:48');
});

test('10: 8:00 h × 13,90 € = 111,20 €; 12,50 € unter Mindestlohn', () => {
  assert.equal(formatEuro(wageCents(480, 13.9)), '111,20 €');
  assert.equal(belowMinWage(12.5, '2026-11-26'), true);
  assert.equal(belowMinWage(13.9, '2026-11-26'), false);
  assert.equal(belowMinWage(13.9, '2027-01-01'), true); // 14,60 € ab 2027
});

test('11: 40 h/Woche → Monat 173,2 h = 173:12 h', () => {
  const m = weeklyToMonthly(40 * 60);
  assert.equal(formatHM(m), '173:12');
  assert.equal(formatDecimal(m).replace(/0$/, ''), '173,2');
});

test('12: unter 18, 08:00–13:00 ohne Pause → 5:00 h, 30 Min. fehlen', () => {
  const r = calcDay({ start: '08:00', end: '13:00', breaks: [], minor: true });
  assert.equal(formatHM(r.net), '5:00');
  assert.equal(r.missing, 30);
  assert.match(r.warnings[0].text, /^30 Min\. Pause fehlen/);
});

/* ---------- Randfälle ---------- */

test('Eingabe: 830 → 08:30, 8 → 08:00, 1615 → 16:15, ungültig → null', () => {
  assert.equal(parseTime('830'), 510);
  assert.equal(parseTime('8'), 480);
  assert.equal(parseTime('1615'), 975);
  assert.equal(parseTime('8:30'), 510);
  assert.equal(parseTime('8.30 Uhr'), 510);
  assert.equal(parseTime('25'), null);
  assert.equal(parseTime('8:75'), null);
  assert.equal(parseTime(''), null);
});

test('Pausen als Uhrzeit, Block länger als 6 h', () => {
  const r = calcDay({ start: '07:00', end: '16:00', breaks: [{ kind: 'range', from: '14:00', to: '14:30' }] });
  assert.equal(formatHM(r.net), '8:30');
  assert.equal(r.missing, 0);
  assert.ok(codes(r).includes('block'));
});

test('Pausen als Uhrzeit über Mitternacht in Nachtschicht', () => {
  const r = calcDay({ start: '22:00', end: '06:00', breaks: [{ kind: 'range', from: '01:45', to: '02:15' }] });
  assert.equal(formatHM(r.net), '7:30');
  assert.ok(!codes(r).includes('block'));
});

test('Mindestpause automatisch abziehen', () => {
  const r = calcDay({ start: '08:00', end: '15:00', breaks: [], autoDeduct: true });
  assert.equal(formatHM(r.net), '6:30');
  assert.equal(r.missing, 0);
  const r2 = calcDay({ start: '08:00', end: '14:20', breaks: [], autoDeduct: true });
  assert.equal(formatHM(r2.net), '6:00'); // nicht unter die 6-h-Grenze kürzen
});

test('Zeitumstellung Oktober: Nachtschicht hat eine Stunde mehr', () => {
  const r = calcDay({ start: '22:00', end: '06:00', breaks: [], date: '2026-10-24' });
  assert.equal(r.gross, 9 * 60);
  const m = calcDay({ start: '22:00', end: '06:00', breaks: [], date: '2026-03-28' });
  assert.equal(m.gross, 7 * 60);
});

test('Feierabendrechner: 7:30 + 8 h → 16:00 inkl. 30 Min. Pause', () => {
  const q = quittingTime({ start: '7:30', target: '8:00' });
  assert.equal(q.end, 16 * 60);
  assert.equal(q.latest, 7.5 * 60 + 600 + 45);
});

test('Stunden addieren mit Zeiträumen und Abzug', () => {
  const s = sumRows([{ op: '+', value: '8:00-12:00' }, { op: '+', value: '7,5' }, { op: '-', value: '0:30' }]);
  assert.equal(formatHM(s.total), '11:00');
});

test('Woche: leere Tage zählen 0 h, Soll 40 h', () => {
  const entries = { '2026-11-23': { start: '8:00', end: '16:30', breaks: pause(30) } };
  const w = weekSummary(entries, '2026-11-26', { weeklyMinutes: 2400, workdays: [1, 2, 3, 4, 5] });
  assert.equal(w.total, 480);
  assert.equal(w.soll, 2400);
  assert.equal(w.saldo, -1920);
  assert.equal(isoWeek('2026-11-26'), 48);
});

test('Monat: echter Kalender (November 2026 = 21 Werktage Mo–Fr)', () => {
  const m = monthSummary({}, 2026, 11, { weeklyMinutes: 2400, workdays: [1, 2, 3, 4, 5] });
  assert.equal(m.days.length, 30);
  assert.equal(m.soll, 21 * 480);
});

/* ---------- Phase 2 ---------- */
import {
  holidays, holidayName, easterSunday, calcSurcharges, dayInfo, accountBalance,
  salaryToHourly, hourlyToSalary, encodeShare, decodeShare, salaryInfo, wageInfo, minijobMaxHours,
} from '../src/js/core.js';

test('Feiertage: Ostern 2026/2027, Bundesländer', () => {
  assert.equal(easterSunday(2026), '2026-04-05');
  assert.equal(easterSunday(2027), '2027-03-28');
  assert.equal(holidayName('2026-04-03'), 'Karfreitag');
  assert.equal(holidayName('2026-05-14'), 'Christi Himmelfahrt');
  assert.equal(holidayName('2026-05-25'), 'Pfingstmontag');
  assert.equal(holidayName('2026-10-31', 'BB'), 'Reformationstag');
  assert.equal(holidayName('2026-10-31', 'BY'), null);
  assert.equal(holidayName('2026-06-04', 'BY'), 'Fronleichnam');
  assert.equal(holidayName('2026-11-18', 'SN'), 'Buß- und Bettag');
  assert.equal(Object.keys(holidays(2026, '')).length, 9);
});

test('Feiertag wird beim Soll abgezogen (Mai 2026: 21 Mo–Fr, 3 Feiertage)', () => {
  const m = monthSummary({}, 2026, 5, { weeklyMinutes: 2400, workdays: [1, 2, 3, 4, 5] });
  assert.equal(m.soll, 18 * 480);
});

test('Urlaub und Krank werden gutgeschrieben, Überstundenabbau nicht', () => {
  const p = { weeklyMinutes: 2400, workdays: [1, 2, 3, 4, 5], wage: 20 };
  assert.equal(dayInfo('2026-11-23', { type: 'urlaub' }, p).diff, 0);
  assert.equal(dayInfo('2026-11-23', { type: 'krank' }, p).credit, 480);
  assert.equal(dayInfo('2026-11-23', { type: 'ausgleich' }, p).diff, -480);
  const w = weekSummary({ '2026-11-23': { type: 'urlaub' } }, '2026-11-23', p);
  assert.equal(w.pay, 16000); // 8 h × 20 €
  assert.equal(w.count.urlaub, 1);
});

test('Zuschläge: Nachtschicht Sa 22–6 → Nacht 25 %/40 %, Sonntag 50 %', () => {
  const p = { wage: 20, surcharges: { enabled: true, night: 25, night04: 40, sunday: 50, holiday: 125, special: 150 } };
  const r = calcDay({ start: '22:00', end: '06:00', breaks: [], date: '2026-11-21' }); // Samstag
  const z = calcSurcharges(r, '2026-11-21', p);
  assert.equal(z.night, 240); // 22–24 und 4–6 Uhr
  assert.equal(z.night04, 240); // 0–4 Uhr
  assert.equal(z.sunday, 360); // So 0–6 Uhr
  // 4 h × 5 € + 4 h × 8 € + 6 h × 10 € = 112 €
  assert.equal(z.cents, 11200);
});

test('Zuschläge: Feiertag 125 %, 1. Weihnachtstag 150 %, aus = 0', () => {
  const sc = { enabled: true, night: 25, night04: 40, sunday: 50, holiday: 125, special: 150 };
  const day = (date) => calcDay({ start: '08:00', end: '16:00', breaks: [], date });
  assert.equal(calcSurcharges(day('2026-10-03'), '2026-10-03', { wage: 10, surcharges: sc }).cents, 10000);
  assert.equal(calcSurcharges(day('2026-12-25'), '2026-12-25', { wage: 10, surcharges: sc }).cents, 12000);
  assert.equal(calcSurcharges(day('2026-10-03'), '2026-10-03', { wage: 10, surcharges: { ...sc, enabled: false } }).cents, 0);
});

test('Überstundenkonto: Startsaldo + Tage ab erstem Eintrag', () => {
  const p = { weeklyMinutes: 2400, workdays: [1, 2, 3, 4, 5], startBalance: 120 };
  const entries = {
    '2026-11-23': { start: '08:00', end: '17:30', breaks: pause(30) }, // +1:00
    '2026-11-24': { start: '08:00', end: '16:30', breaks: pause(30) }, // 0
  };
  assert.equal(accountBalance(entries, p, '2026-11-24').balance, 180);
  assert.equal(accountBalance(entries, p, '2026-11-25').balance, 180 - 480); // Mi ohne Eintrag
  assert.equal(accountBalance({}, p, '2026-11-25').balance, 120);
});

test('Gehalt ↔ Stundenlohn', () => {
  assert.equal(salaryToHourly(3000, 40), 17.31);
  assert.equal(hourlyToSalary(15, 40), 2600);
  assert.equal(salaryToHourly(0, 40), null);
});

test('Stundenlohnrechner: Testfälle aus dem SEO-Plan (Teil B, Stufe 1)', () => {
  const d = '2026-11-26';
  // 1: 3.000 € Monatsgehalt, 40 h/Woche → 17,31 €/h
  const a = salaryInfo({ amount: 3000, weeklyHours: 40, iso: d });
  assert.equal(a.rate, 17.31);
  assert.equal(a.yearly, 36000);
  assert.equal(a.monthlyHours, 173.33);
  assert.equal(a.belowMinWage, false);
  // 2: 13,90 €/h, 40 h/Woche → 2.409,33 €/Monat
  const w = wageInfo({ rate: 13.9, weeklyHours: 40, iso: d });
  assert.equal(w.monthly, 2409.33);
  assert.equal(w.belowMinWage, false);
  // 3: 2.000 € bei 40 h → 11,54 €/h, unter Mindestlohn
  const c = salaryInfo({ amount: 2000, weeklyHours: 40, iso: d });
  assert.equal(c.rate, 11.54);
  assert.equal(c.belowMinWage, true);
  // 4: 36.000 € Jahresgehalt = Fall 1
  const y = salaryInfo({ amount: 36000, period: 'year', weeklyHours: 40, iso: d });
  assert.equal(y.rate, 17.31);
  assert.equal(y.monthly, 3000);
  // 5: Minijob-Grenze 603 € (2026): genau auf der Grenze ist erlaubt, 604 € liegt darüber
  assert.equal(salaryInfo({ amount: 603, weeklyHours: 10, iso: d }).overMinijob, false);
  assert.equal(salaryInfo({ amount: 604, weeklyHours: 10, iso: d }).overMinijob, true);
  assert.equal(minijobMaxHours(13.9, d), 43.3);
  // 6: Stichtag 1.1.2027 → Mindestlohn 14,60 €, Minijob-Grenze 633 €
  const n = salaryInfo({ amount: 2500, weeklyHours: 40, iso: '2027-01-01' });
  assert.equal(n.minWage, 14.6);
  assert.equal(n.minijobLimit, 633);
  assert.equal(n.belowMinWage, true); // 14,42 € < 14,60 €
  assert.equal(salaryInfo({ amount: 2500, weeklyHours: 40, iso: '2026-12-31' }).belowMinWage, false);
  // 7: leere oder unsinnige Eingaben → kein Ergebnis, keine Division durch null
  assert.equal(salaryInfo({ amount: 3000, weeklyHours: 0, iso: d }), null);
  assert.equal(salaryInfo({ amount: null, weeklyHours: 40, iso: d }), null);
  assert.equal(wageInfo({ rate: 15, weeklyHours: null, iso: d }), null);
  assert.equal(minijobMaxHours(0, d), null);
});

test('Teilen-Link: hin und zurück, kaputte Daten → null', () => {
  const p = { name: 'Büro Müller', weeklyMinutes: 2340, workdays: [1, 2, 3, 4, 5], state: 'BB', wage: 99 };
  const entries = {
    '2026-11-23': { start: '08:00', end: '16:30', breaks: [{ kind: 'range', from: '12:00', to: '12:30' }] },
    '2026-11-24': { type: 'urlaub', start: '', end: '' },
    '2026-10-01': { start: '08:00', end: '12:00', breaks: [] },
  };
  const code = encodeShare(entries, p, 2026, 11);
  assert.match(code, /^[A-Za-z0-9_-]+$/);
  const back = decodeShare(code);
  assert.equal(back.profile.name, 'Büro Müller');
  assert.equal(back.profile.wage, undefined);
  assert.deepEqual(Object.keys(back.entries), ['2026-11-23', '2026-11-24']);
  assert.equal(back.entries['2026-11-24'].type, 'urlaub');
  assert.equal(monthSummary(back.entries, 2026, 11, back.profile).total, 480);
  assert.equal(decodeShare('kaputt!!'), null);
  assert.equal(decodeShare(''), null);
});

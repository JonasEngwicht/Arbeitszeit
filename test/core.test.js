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

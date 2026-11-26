// Zentrale Rechtswerte mit Gültigkeitsdatum.
// Neue Werte einfach mit späterem "from"-Datum anhängen – der Rechner
// wählt automatisch den Wert, der am jeweiligen Tag gilt.

export const STAND = '2026-11';

export const LAW = {
  // Mindestlohn in Euro pro Stunde (MiLoV5)
  minWage: [
    { from: '2026-01-01', value: 13.9 },
    { from: '2027-01-01', value: 14.6 },
  ],
  // Minijob-Verdienstgrenze in Euro pro Monat
  minijobLimit: [
    { from: '2026-01-01', value: 603 },
    { from: '2027-01-01', value: 633 },
  ],
  // § 4 ArbZG – Pflichtpausen Erwachsene (Arbeitszeit in Minuten > over → Pause min)
  breaksAdult: [
    { over: 540, minutes: 45 },
    { over: 360, minutes: 30 },
  ],
  // § 11 JArbSchG – Pausen Jugendliche
  breaksMinor: [
    { over: 360, minutes: 60 },
    { over: 270, minutes: 30 },
  ],
  minBreakSegment: 15, // nur Pausenabschnitte ab 15 Min. zählen
  maxBlockAdult: 360, // max. 6 h am Stück (§ 4 ArbZG)
  maxBlockMinor: 270, // max. 4,5 h am Stück (§ 11 Abs. 2 JArbSchG)
  dailyRegular: 480, // 8 h (§ 3 ArbZG)
  dailyMax: 600, // 10 h (§ 3 ArbZG)
  dailyMaxMinor: 480, // 8 h (§ 8 JArbSchG)
  minRest: 660, // 11 h Ruhezeit (§ 5 ArbZG)
  minRestMinor: 720, // 12 h Freizeit (§ 13 JArbSchG)
  // Nachtzeit nach § 2 Abs. 3 ArbZG, Minuten ab Mitternacht
  night: { from: 23 * 60, to: 6 * 60 },
  nightBakery: { from: 22 * 60, to: 5 * 60 },
  weeksPerMonth: 4.33,
  // Steuerfreie Höchstsätze für Zuschläge nach § 3b EStG (in Prozent vom Grundlohn)
  surcharge: { night: 25, night04: 40, sunday: 50, holiday: 125, special: 150 },
  // Nachtzeit für Zuschläge (§ 3b EStG) – weicht vom Arbeitszeitgesetz ab
  surchargeNight: { from: 20 * 60, to: 6 * 60 },
  surchargeMaxBase: 50, // Zuschlag steuerfrei nur bis 50 €/h Grundlohn
};

export const STATES = {
  BW: 'Baden-Württemberg', BY: 'Bayern', BE: 'Berlin', BB: 'Brandenburg', HB: 'Bremen', HH: 'Hamburg',
  HE: 'Hessen', MV: 'Mecklenburg-Vorpommern', NI: 'Niedersachsen', NW: 'Nordrhein-Westfalen',
  RP: 'Rheinland-Pfalz', SL: 'Saarland', SN: 'Sachsen', ST: 'Sachsen-Anhalt', SH: 'Schleswig-Holstein', TH: 'Thüringen',
};

export function valueAt(list, isoDate) {
  const d = isoDate || new Date().toISOString().slice(0, 10);
  let v = list[0].value;
  for (const item of list) if (item.from <= d) v = item.value;
  return v;
}

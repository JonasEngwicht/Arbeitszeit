// Netto-Rechenkern ohne UI-Abhängigkeit: Lohnsteuer, Solidaritätszuschlag, Kirchensteuer
// und Arbeitnehmeranteile zur Sozialversicherung.
//
// Die Lohnsteuer folgt dem amtlichen „Programmablaufplan für die maschinelle Berechnung der vom
// Arbeitslohn einzubehaltenden Lohnsteuer, des Solidaritätszuschlags und der Maßstabsteuer für die
// Kirchenlohnsteuer“ des Bundesministeriums der Finanzen (PAP). Die Namen in Großbuchstaben sind
// die Feldnamen aus dem PAP. Gerechnet wird in ganzen Cent bzw. ganzen Euro, nie mit Gleitkomma,
// damit die Rundungsvorschriften des PAP exakt eingehalten werden.
//
// Umgesetzt: laufender Arbeitslohn (Jahr, Monat, Woche, Tag), Steuerklassen I–VI, Kinderfreibeträge,
// gesetzliche und private Krankenversicherung, Freibetrag/Hinzurechnungsbetrag.
// Nicht umgesetzt: Versorgungsbezüge, Altersentlastungsbetrag, sonstige Bezüge, Faktorverfahren.

/* ---------- Jahreswerte ---------- */
// Neue Jahre hier anhängen, sobald der PAP und die Rechengrößen veröffentlicht sind.
// Zu jedem Jahr gehören die amtlichen Prüftabellen in test/netto.test.js.
// Beitragssätze als ganze Zahlen: AVSATZAN/RVSATZAN in 1/10.000, KV in 1/100.000, PV in 1/1.000.000.
// Tarif (§ 32a EStG): A1/A2 in 1/100, C2 und MINUS in Cent, RATE in Prozent.
export const TAX_YEARS = {
  2026: {
    // Quelle: BMF, PAP 2026, Anlage 1, Stand 12.11.2025 (endgültig), Abschnitte MPARA, MZTABFB, MVSPHB, UPTAB26
    source: 'BMF, Programmablaufplan Lohnsteuer 2026, Anlage 1, Stand 12.11.2025 (endgültig)',
    draft: false,
    BBGRVALV: 101400, // Beitragsbemessungsgrenze Renten-/Arbeitslosenversicherung, Euro pro Jahr
    BBGKV: 69750, // Beitragsbemessungsgrenze Krankenversicherung, Euro pro Jahr
    BBGPV: 69750, // Beitragsbemessungsgrenze Pflegeversicherung, Euro pro Jahr
    VSP_KV_PV_GETRENNT: false, // 2026: Kranken- und Pflegeversicherung in der Vorsorgepauschale in einem Schritt
    AVSATZAN: 130, // Arbeitnehmeranteil Arbeitslosenversicherung 0,0130
    RVSATZAN: 930, // Arbeitnehmeranteil Rentenversicherung 0,0930
    KVSATZ_ERM_HALB: 7000, // halber ermäßigter KV-Beitragssatz 0,07, nur für die Vorsorgepauschale
    PVSATZAN: 18000, // Arbeitnehmeranteil Pflegeversicherung 0,018
    PVSATZAN_SACHSEN: 23000, // 0,023 in Sachsen
    PV_ZUSCHLAG: 6000, // Zuschlag für Kinderlose 0,006
    PV_ABSCHLAG: 2500, // Abschlag je Kind ab dem 2. Kind 0,0025
    W1STKL5: 14071,
    W2STKL5: 34939,
    W3STKL5: 222260,
    W4STKL5: null,
    GFB: 12348, // Grundfreibetrag
    SOLZFREI: 20350, // Freigrenze Solidaritätszuschlag
    ANP: 1230, // Arbeitnehmer-Pauschbetrag
    SAP: 36, // Sonderausgaben-Pauschbetrag
    EFA: 4260, // Entlastungsbetrag für Alleinerziehende
    KFB: 9756, // Freibeträge für Kinder (Steuerklasse IV: die Hälfte)
    VSPHB_MAX: 1900, // Höchstbetrag Arbeitslosen-, Kranken- und Pflegeversicherung in der Vorsorgepauschale
    TARIF: {
      Z2_AB: 17800, A1: 91451, B1: 1400, A2: 17310, B2: 2397, C2: 103487,
      OBEN: [
        { AB: 69879, RATE: 42, MINUS: 1113563 },
        { AB: 277826, RATE: 45, MINUS: 1947038 },
      ],
    },
    // Tatsächliche Beiträge. Quellen: PAP 2026 Abschnitt 1 (Pflege, Rente, Arbeitslosenversicherung,
    // Beitragsbemessungsgrenzen); Bundesgesundheitsministerium, Beitragssätze 2026
    // (allgemeiner Beitragssatz 14,6 %, durchschnittlicher Zusatzbeitragssatz 2,9 %).
    KV_ALLGEMEIN: 14.6,
    KV_ZUSATZ_SCHNITT: 2.9,
  },
  2027: {
    // Quelle: BMF, PAP 2027, Anlage 1, Stand 8.10.2026 (ENTWURF). Bis zur endgültigen Fassung vorläufig.
    // Nach Veröffentlichung der endgültigen Fassung: Werte und Prüftabellen abgleichen, draft auf false setzen.
    source: 'BMF, Programmablaufplan Lohnsteuer 2027, Anlage 1, Entwurf vom 8.10.2026',
    draft: true,
    // Der Entwurf nennt im Text 106.240 Euro, im Ablaufplan (MPARA) 106.200 Euro. Übernommen ist der Wert
    // des Ablaufplans; die Prüftabellen des Entwurfs sind nur damit erfüllt (siehe test/netto.test.js).
    BBGRVALV: 106200,
    BBGKV: 76500,
    BBGPV: 76500,
    VSP_KV_PV_GETRENNT: true, // 2027: VSPKV und VSPPV werden getrennt berechnet und einzeln abgeschnitten
    AVSATZAN: 130,
    RVSATZAN: 930,
    KVSATZ_ERM_HALB: 7000,
    PVSATZAN: 18000,
    PVSATZAN_SACHSEN: 23000,
    PV_ZUSCHLAG: 9000, // Zuschlag für Kinderlose 0,009 (2026: 0,006)
    PV_ABSCHLAG: 2500,
    W1STKL5: 14251,
    W2STKL5: 35299,
    W3STKL5: 200000,
    W4STKL5: 224000,
    GFB: 12564,
    SOLZFREI: 20350,
    ANP: 1430,
    SAP: 36,
    EFA: 4260,
    KFB: 10056,
    VSPHB_MAX: 1900,
    TARIF: {
      Z2_AB: 17800, A1: 95224, B1: 1400, A2: 17074, B2: 2397, C2: 99386,
      OBEN: [
        { AB: 70601, RATE: 42, MINUS: 1124173 },
        { AB: 250000, RATE: 45, MINUS: 1874170 },
        { AB: 280000, RATE: 47, MINUS: 2434168 },
      ],
    },
    // Allgemeiner Beitragssatz gesetzlich 14,6 %; durchschnittlicher Zusatzbeitragssatz 2027 vom
    // Bundesgesundheitsministerium auf 2,9 % festgelegt (im PAP-Entwurf noch als Platzhalter).
    KV_ALLGEMEIN: 14.6,
    KV_ZUSATZ_SCHNITT: 2.9,
  },
};
// Kirchensteuersatz in Prozent der Lohnsteuer: 8 % in Bayern und Baden-Württemberg, sonst 9 %
// (Kirchensteuergesetze der Länder).
export const CHURCH_RATE = { BY: 8, BW: 8 };
export const churchRate = (state) => CHURCH_RATE[state] ?? 9;
// Obergrenze des Übergangsbereichs („Midijob“), § 20 Absatz 2 SGB IV, Euro pro Monat
export const MIDIJOB_MAX = 2000;

export const taxYears = () => Object.keys(TAX_YEARS).map(Number).sort((a, b) => a - b);
// Jahr, dessen Werte für ein Kalenderjahr gelten: das Jahr selbst, sonst das nächstliegende vorhandene.
export function taxYearFor(year) {
  const all = taxYears();
  const y = Number(year);
  if (TAX_YEARS[y]) return y;
  if (!(y >= all[0])) return all[0];
  return all[all.length - 1];
}

/* ---------- Lohnsteuer nach PAP ---------- */

const ceilEuro = (cents) => Math.ceil(cents / 100); // Cent → volle Euro aufrunden
const floorDiv = (a, b) => Math.floor(a / b);

// UPTAB: tarifliche Einkommensteuer in Euro für X (volle Euro), ohne Gleitkomma
function uptab(P, X, KZTAB) {
  const T = P.TARIF;
  let ST;
  if (X < P.GFB + 1) {
    ST = 0;
  } else if (X < T.Z2_AB) {
    // Y = (X − GFB) / 10000; ST = (A1 · Y + B1) · Y, abgerundet
    const d = X - P.GFB;
    ST = floorDiv((T.A1 * d + T.B1 * 1000000) * d, 10000000000);
  } else if (X < T.OBEN[0].AB) {
    // Y = (X − (Z2_AB − 1)) / 10000; ST = (A2 · Y + B2) · Y + C2, abgerundet
    const d = X - (T.Z2_AB - 1);
    ST = floorDiv((T.A2 * d + T.B2 * 1000000) * d + T.C2 * 100000000, 10000000000);
  } else {
    // lineare Zonen: ST = X · RATE − MINUS, abgerundet
    let zone = T.OBEN[0];
    for (const z of T.OBEN) if (X >= z.AB) zone = z;
    ST = floorDiv(zone.RATE * X - zone.MINUS, 100);
  }
  return ST * KZTAB;
}

// UP5-6
function up56(P, ZX) {
  const ST1 = uptab(P, floorDiv(ZX * 5, 4), 1);
  const ST2 = uptab(P, floorDiv(ZX * 3, 4), 1);
  const DIFF = (ST1 - ST2) * 2;
  const MIST = floorDiv(ZX * 14, 100);
  return MIST > DIFF ? MIST : DIFF;
}

// MST5-6: Lohnsteuer für die Steuerklassen V und VI
function mst56(P, X) {
  const ZZX = X;
  let ST;
  if (ZZX > P.W2STKL5) {
    ST = up56(P, P.W2STKL5);
    if (ZZX > P.W3STKL5) {
      ST += floorDiv((P.W3STKL5 - P.W2STKL5) * 42, 100);
      if (P.W4STKL5 && ZZX > P.W4STKL5) {
        ST += floorDiv((P.W4STKL5 - P.W3STKL5) * 45, 100);
        ST += floorDiv((ZZX - P.W4STKL5) * 47, 100);
      } else {
        ST += floorDiv((ZZX - P.W3STKL5) * 45, 100);
      }
    } else {
      ST += floorDiv((ZZX - P.W2STKL5) * 42, 100);
    }
  } else {
    ST = up56(P, ZZX);
    if (ZZX > P.W1STKL5) {
      const VERGL = ST;
      const HOCH = up56(P, P.W1STKL5) + floorDiv((ZZX - P.W1STKL5) * 42, 100);
      ST = HOCH < VERGL ? HOCH : VERGL;
    }
  }
  return ST;
}

// Rechnet die Lohnsteuer für einen Lohnzahlungszeitraum. Alle Geldbeträge in Cent.
// Eingaben wie im PAP: LZZ (1 Jahr, 2 Monat, 3 Woche, 4 Tag), RE4, STKL, ZKF, KVZ, PVS, PVZ, PVA, R,
// KRV, ALV, PKV, PKPV, PKPVAGZ, LZZFREIB, LZZHINZU.
export function lohnsteuer(input) {
  const year = taxYearFor(input.year);
  const P = TAX_YEARS[year];
  const {
    LZZ = 2, RE4 = 0, STKL = 1, ZKF = 0, KVZ = P.KV_ZUSATZ_SCHNITT, PVS = 0, PVZ = 0, PVA = 0, R = 0,
    KRV = 0, ALV = 0, PKV = 0, PKPV = 0, PKPVAGZ = 0, LZZFREIB = 0, LZZHINZU = 0,
  } = input;

  // MPARA: Beitragssätze für die Vorsorgepauschale
  const KVSATZAN = Math.round(KVZ * 100) * 5 + P.KVSATZ_ERM_HALB; // KVZ/2/100 + 0,07 in 1/100.000
  let PVSATZAN = PVS === 1 ? P.PVSATZAN_SACHSEN : P.PVSATZAN; // in 1/1.000.000
  PVSATZAN += PVZ === 1 ? P.PV_ZUSCHLAG : -PVA * P.PV_ABSCHLAG;

  // MRE4JL: Hochrechnung auf den Jahresarbeitslohn (Cent)
  const toYear = (v) => (LZZ === 1 ? v : LZZ === 2 ? v * 12 : LZZ === 3 ? floorDiv(v * 360, 7) : v * 360);
  const ZRE4J = toYear(RE4);
  const JLFREIB = toYear(LZZFREIB);
  const JLHINZU = toYear(LZZHINZU);

  // MRE4 entfällt (keine Versorgungsbezüge, kein Altersentlastungsbetrag): FVB = FVBZ = ALTE = 0
  // MRE4ABZ
  const ZRE4 = Math.max(0, ZRE4J - JLFREIB + JLHINZU);
  const ZRE4VP = ZRE4J;

  // MZTABFB: feste Tabellenfreibeträge in Euro
  let ANP = 0;
  if (STKL < 6 && ZRE4 > 0) ANP = ZRE4 < P.ANP * 100 ? ceilEuro(ZRE4) : P.ANP;
  let KZTAB = 1;
  let EFA = 0;
  let SAP = P.SAP;
  let KFB = 0;
  if (STKL === 1) KFB = ZKF * P.KFB;
  else if (STKL === 2) { EFA = P.EFA; KFB = ZKF * P.KFB; }
  else if (STKL === 3) { KZTAB = 2; KFB = ZKF * P.KFB; }
  else if (STKL === 4) KFB = (ZKF * P.KFB) / 2;
  else if (STKL === 6) SAP = 0;
  const ZTABFB = EFA + ANP + SAP;

  // UPEVP: Vorsorgepauschale in Euro
  const rvBase = Math.min(ZRE4VP, P.BBGRVALV * 100);
  const VSPR = KRV === 1 ? 0 : floorDiv(rvBase * P.RVSATZAN, 10000);
  let VSPKVPV;
  if (PKV > 0) {
    VSPKVPV = STKL === 6 ? 0 : Math.max(0, PKPV * 12 - PKPVAGZ * 12);
  } else if (P.VSP_KV_PV_GETRENNT) {
    const VSPKV = floorDiv(Math.min(ZRE4VP, P.BBGKV * 100) * KVSATZAN, 100000);
    const VSPPV = floorDiv(Math.min(ZRE4VP, P.BBGPV * 100) * PVSATZAN, 1000000);
    VSPKVPV = VSPKV + VSPPV;
  } else {
    VSPKVPV = floorDiv(Math.min(ZRE4VP, P.BBGKV * 100) * (KVSATZAN * 10 + PVSATZAN), 1000000);
  }
  let VSP = ceilEuro(VSPKVPV + VSPR);
  if (ALV !== 1 && STKL !== 6) {
    // MVSPHB: Höchstbetragsberechnung zur Arbeitslosenversicherung
    const VSPALV = floorDiv(rvBase * P.AVSATZAN, 10000);
    const VSPHB = Math.min(VSPALV + VSPKVPV, P.VSPHB_MAX * 100);
    const VSPN = ceilEuro(VSPR + VSPHB);
    if (VSPN > VSP) VSP = VSPN;
  }

  // MLSTJAHR / UPMLST: Jahreslohnsteuer in Euro für gegebene Tabellenfreibeträge
  const jahressteuer = (ztabfb) => {
    const ZVE = ZRE4 - (ztabfb + VSP) * 100; // Cent
    const X = ZVE < 100 ? 0 : floorDiv(ZVE, 100 * KZTAB);
    return STKL < 5 ? uptab(P, X, KZTAB) : mst56(P, X);
  };
  const anteil = (jw) => (LZZ === 1 ? jw : LZZ === 2 ? floorDiv(jw, 12) : LZZ === 3 ? floorDiv(jw * 7, 360) : floorDiv(jw, 360));

  // MBERECH
  const LSTJAHR = jahressteuer(ZTABFB);
  const LSTLZZ = anteil(LSTJAHR * 100);
  // Bemessungsgrundlage für Solidaritätszuschlag und Kirchensteuer: mit Freibeträgen für Kinder
  const JBMG = ZKF > 0 ? jahressteuer(ZTABFB + KFB) : LSTJAHR;

  // MSOLZ
  const SOLZFREI = P.SOLZFREI * KZTAB;
  let SOLZLZZ = 0;
  if (JBMG > SOLZFREI) {
    let SOLZJ = floorDiv(JBMG * 55, 10); // 5,5 % in Cent, abgerundet
    const SOLZMIN = floorDiv((JBMG - SOLZFREI) * 119, 10); // 11,9 % des Betrags über der Freigrenze
    if (SOLZMIN < SOLZJ) SOLZJ = SOLZMIN;
    SOLZLZZ = anteil(SOLZJ);
  }
  const BK = R > 0 ? anteil(JBMG * 100) : 0;

  return { year, draft: P.draft, LSTLZZ, SOLZLZZ, BK, LSTJAHR, JBMG, VSP };
}

/* ---------- Brutto → Netto ---------- */

const roundCent = (v) => Math.round(v + 1e-9);

// Beitragsabschläge in der Pflegeversicherung: ab dem 2. Kind je 0,25 Punkte, höchstens 4 Abschläge
export const pvDiscounts = (children) => Math.max(0, Math.min(4, Math.floor(children || 0) - 1));

// Monatliches Netto. Alle Ergebnisse in Cent pro Monat.
// grossMonthly in Euro; taxClass 1–6; state: Kürzel des Bundeslands (für Kirchensteuer und Sachsen);
// church: Kirchensteuerpflicht; childAllowances: Zahl der Kinderfreibeträge (0, 0,5, 1 …);
// children: Zahl der Kinder unter 25 für die Pflegeversicherung; childless: kinderlos und älter als 23;
// kvAdd: Zusatzbeitrag der Krankenkasse in Prozent.
export function netSalary({
  year, grossMonthly, taxClass = 1, state = '', church = false, childAllowances = 0,
  children = 0, childless = true, kvAdd, minijobLimit = null,
} = {}) {
  if (!(grossMonthly > 0)) return null;
  const y = taxYearFor(year);
  const P = TAX_YEARS[y];
  const gross = Math.round(grossMonthly * 100);
  const KVZ = Number.isFinite(kvAdd) && kvAdd >= 0 ? kvAdd : P.KV_ZUSATZ_SCHNITT;
  const hasChildren = children > 0;
  const PVZ = !hasChildren && childless ? 1 : 0;
  const PVA = hasChildren ? pvDiscounts(children) : 0;
  const PVS = state === 'SN' ? 1 : 0;
  const ZKF = taxClass >= 5 ? 0 : childAllowances;

  const tax = lohnsteuer({ year: y, LZZ: 2, RE4: gross, STKL: taxClass, ZKF, KVZ, PVS, PVZ, PVA, R: church ? 1 : 0 });
  const kist = church ? floorDiv(tax.BK * churchRate(state), 100) : 0;

  // Sozialversicherung: Arbeitnehmeranteile, begrenzt auf die monatliche Beitragsbemessungsgrenze
  const baseKv = Math.min(gross, (P.BBGKV * 100) / 12);
  const basePv = Math.min(gross, (P.BBGPV * 100) / 12);
  const baseRv = Math.min(gross, (P.BBGRVALV * 100) / 12);
  const kvRate = (P.KV_ALLGEMEIN + KVZ) / 2; // Prozent
  const pvRate = ((PVS ? P.PVSATZAN_SACHSEN : P.PVSATZAN) + (PVZ ? P.PV_ZUSCHLAG : -PVA * P.PV_ABSCHLAG)) / 10000; // Prozent
  const kv = roundCent((baseKv * kvRate) / 100);
  const pv = roundCent((basePv * pvRate) / 100);
  const rv = roundCent((baseRv * P.RVSATZAN) / 10000);
  const av = roundCent((baseRv * P.AVSATZAN) / 10000);

  const taxes = tax.LSTLZZ + tax.SOLZLZZ + kist;
  const social = kv + pv + rv + av;
  // Hinweis-Zonen: Minijob und Übergangsbereich rechnet dieser Kern nicht gesondert
  let zone = 'regular';
  if (minijobLimit !== null && grossMonthly <= minijobLimit) zone = 'minijob';
  else if (grossMonthly <= MIDIJOB_MAX) zone = 'midijob';
  return {
    year: y, draft: P.draft, gross, zone,
    lst: tax.LSTLZZ, soli: tax.SOLZLZZ, kist, kv, pv, rv, av,
    taxes, social, net: gross - taxes - social,
    rates: { kv: kvRate, pv: pvRate, rv: P.RVSATZAN / 100, av: P.AVSATZAN / 100, church: church ? churchRate(state) : 0 },
  };
}

// Netto → Brutto: kleinstes Monatsbrutto (auf volle Cent), dessen Netto das Wunsch-Netto erreicht.
export function grossForNet(targetNetMonthly, options = {}) {
  if (!(targetNetMonthly > 0)) return null;
  const target = Math.round(targetNetMonthly * 100);
  const netAt = (cents) => netSalary({ ...options, grossMonthly: cents / 100, minijobLimit: null }).net;
  let lo = target; // Brutto ist nie kleiner als Netto
  let hi = target * 3 + 100000;
  if (netAt(hi) < target) return null;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (netAt(mid) >= target) hi = mid; else lo = mid + 1;
  }
  return lo / 100;
}

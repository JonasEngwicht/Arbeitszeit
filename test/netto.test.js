// Referenztests für den Netto-Rechenkern (src/js/netto.js).
// Ausführen: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { lohnsteuer, netSalary, grossForNet, pvDiscounts, churchRate, TAX_YEARS } from '../src/js/netto.js';

// Amtliche Prüftabellen aus dem Programmablaufplan Lohnsteuer 2026 des Bundesministeriums der Finanzen,
// Anlage 1, Stand 12.11.2025 (endgültig), Seiten 39 und 40. Übernommen am 26.11.2026.
// Spalten: Jahresbruttolohn in Euro, danach die Jahreslohnsteuer in Euro für die Steuerklassen I bis VI.

// „Allgemeine maschinelle Jahreslohnsteuer 2026“: in allen Zweigen sozialversichert.
// Berechnet mit ALV, KRV und PKV = 0 sowie KVZ = 2,90; in Steuerklasse II gilt PVZ = 0, sonst PVZ = 1.
const ALLGEMEIN_2026 = [
  [5000, 0, 0, 0, 0, 372, 558],
  [7500, 0, 0, 0, 0, 647, 838],
  [10000, 0, 0, 0, 0, 922, 1117],
  [12500, 0, 0, 0, 0, 1197, 1397],
  [15000, 0, 0, 0, 0, 1472, 1676],
  [17500, 51, 0, 0, 51, 1778, 1956],
  [20000, 380, 0, 0, 380, 2234, 2766],
  [22500, 782, 32, 0, 782, 3073, 3604],
  [25000, 1251, 359, 0, 1251, 3911, 4443],
  [27500, 1742, 759, 0, 1742, 4749, 5281],
  [30000, 2248, 1230, 0, 2248, 5588, 6120],
  [32500, 2767, 1724, 0, 2767, 6426, 6952],
  [35000, 3300, 2233, 294, 3300, 7216, 7682],
  [37500, 3847, 2756, 628, 3847, 7954, 8436],
  [40000, 4407, 3293, 1000, 4407, 8720, 9218],
  [42500, 4982, 3843, 1406, 4982, 9512, 10030],
  [45000, 5570, 4408, 1850, 5570, 10334, 10865],
  [47500, 6172, 4987, 2324, 6172, 11171, 11703],
  [50000, 6788, 5580, 2810, 6788, 12010, 12542],
  [52500, 7417, 6186, 3302, 7417, 12848, 13380],
  [55000, 8060, 6807, 3802, 8060, 13687, 14218],
  [57500, 8718, 7442, 4308, 8718, 14525, 15057],
  [60000, 9389, 8091, 4822, 9389, 15364, 15895],
  [62500, 10073, 8754, 5342, 10073, 16202, 16734],
  [65000, 10772, 9430, 5870, 10772, 17040, 17572],
  [67500, 11484, 10121, 6402, 11484, 17879, 18410],
  [70000, 12220, 10835, 6952, 12220, 18729, 19260],
  [72500, 13062, 11647, 7574, 13062, 19681, 20213],
  [75000, 13922, 12476, 8206, 13922, 20633, 21165],
  [77500, 14799, 13323, 8846, 14799, 21585, 22117],
  [80000, 15694, 14188, 9496, 15694, 22538, 23070],
  [82500, 16607, 15071, 10154, 16607, 23490, 24022],
  [85000, 17538, 15971, 10822, 17538, 24443, 24974],
  [87500, 18486, 16890, 11498, 18486, 25395, 25927],
  [90000, 19438, 17826, 12182, 19438, 26347, 26879],
  [92500, 20390, 18777, 12876, 20390, 27300, 27831],
  [95000, 21343, 19729, 13580, 21343, 28252, 28784],
  [97500, 22295, 20682, 14292, 22295, 29204, 29736],
  [100000, 23248, 21634, 15012, 23248, 30157, 30689],
  [102500, 24243, 22629, 15774, 24243, 31152, 31684],
  [105000, 25293, 23679, 16590, 25293, 32202, 32734],
  [107500, 26343, 24729, 17416, 26343, 33252, 33784],
  [110000, 27393, 25779, 18252, 27393, 34302, 34834],
];

// „Besondere maschinelle Jahreslohnsteuer 2026“: in keinem Zweig sozialversichert.
// Berechnet mit ALV, KRV und PKV = 1; PKPV = 50.000 Cent in Steuerklasse III, 0 in VI, sonst 30.000 Cent.
const BESONDERE_2026 = [
  [5000, 0, 0, 0, 0, 18, 700],
  [7500, 0, 0, 0, 0, 368, 1050],
  [10000, 0, 0, 0, 0, 718, 1400],
  [12500, 0, 0, 0, 0, 1068, 1750],
  [15000, 0, 0, 0, 0, 1418, 2359],
  [17500, 40, 0, 0, 40, 1768, 3409],
  [20000, 461, 0, 0, 461, 2415, 4459],
  [22500, 995, 153, 0, 995, 3465, 5509],
  [25000, 1604, 607, 0, 1604, 4515, 6559],
  [27500, 2234, 1173, 0, 2234, 5565, 7514],
  [30000, 2886, 1788, 0, 2886, 6615, 8460],
  [32500, 3559, 2424, 76, 3559, 7564, 9446],
  [35000, 4254, 3083, 466, 4254, 8510, 10473],
  [37500, 4971, 3763, 914, 4971, 9498, 11523],
  [40000, 5710, 4464, 1420, 5710, 10529, 12573],
  [42500, 6470, 5188, 1982, 6470, 11579, 13623],
  [45000, 7252, 5932, 2584, 7252, 12629, 14673],
  [47500, 8055, 6699, 3198, 8055, 13679, 15723],
  [50000, 8880, 7487, 3824, 8880, 14729, 16773],
  [52500, 9727, 8297, 4458, 9727, 15779, 17823],
  [55000, 10595, 9128, 5106, 10595, 16829, 18873],
  [57500, 11485, 9981, 5762, 11485, 17879, 19923],
  [60000, 12396, 10856, 6430, 12396, 18929, 20973],
  [62500, 13330, 11752, 7110, 13330, 19979, 22023],
  [65000, 14284, 12670, 7798, 14284, 21029, 23073],
  [67500, 15261, 13610, 8500, 15261, 22079, 24123],
  [70000, 16259, 14571, 9210, 16259, 23129, 25173],
  [72500, 17279, 15554, 9932, 17279, 24179, 26223],
  [75000, 18320, 16559, 10666, 18320, 25229, 27273],
  [77500, 19370, 17585, 11410, 19370, 26279, 28323],
  [80000, 20420, 18631, 12164, 20420, 27329, 29373],
  [82500, 21470, 19681, 12930, 21470, 28379, 30423],
  [85000, 22520, 20731, 13706, 22520, 29429, 31473],
  [87500, 23570, 21781, 14492, 23570, 30479, 32523],
  [90000, 24620, 22831, 15290, 24620, 31529, 33573],
  [92500, 25670, 23881, 16098, 25670, 32579, 34623],
  [95000, 26720, 24931, 16918, 26720, 33629, 35673],
  [97500, 27770, 25981, 17748, 27770, 34679, 36723],
  [100000, 28820, 27031, 18590, 28820, 35729, 37773],
  [102500, 29870, 28081, 19442, 29870, 36779, 38823],
  [105000, 30920, 29131, 20304, 30920, 37829, 39873],
  [107500, 31970, 30181, 21178, 31970, 38879, 40923],
  [110000, 33020, 31231, 22062, 33020, 39929, 41973],
];

// Prüftabellen aus dem ENTWURF des Programmablaufplans Lohnsteuer 2027, Anlage 1, Stand 8.10.2026,
// Seiten 40 und 41. Übernommen am 26.11.2026. Nach der endgültigen Fassung neu abgleichen.
// Fußnoten wie 2026 (KVZ = 2,90).
const ALLGEMEIN_2027_ENTWURF = [
  [5000, 0, 0, 0, 0, 342, 556],
  [7500, 0, 0, 0, 0, 616, 835],
  [10000, 0, 0, 0, 0, 890, 1113],
  [12500, 0, 0, 0, 0, 1164, 1392],
  [15000, 0, 0, 0, 0, 1437, 1670],
  [17500, 0, 0, 0, 0, 1743, 1948],
  [20000, 296, 0, 0, 296, 2076, 2691],
  [22500, 683, 0, 0, 683, 2911, 3526],
  [25000, 1143, 286, 0, 1143, 3746, 4362],
  [27500, 1631, 676, 0, 1631, 4581, 5197],
  [30000, 2132, 1140, 0, 2132, 5417, 6032],
  [32500, 2647, 1633, 0, 2647, 6252, 6867],
  [35000, 3175, 2140, 182, 3175, 7087, 7630],
  [37500, 3717, 2661, 502, 3717, 7822, 8376],
  [40000, 4272, 3196, 860, 4272, 8576, 9152],
  [42500, 4840, 3744, 1256, 4840, 9360, 9952],
  [45000, 5423, 4306, 1690, 5423, 10166, 10779],
  [47500, 6019, 4882, 2160, 6019, 10998, 11614],
  [50000, 6628, 5473, 2642, 6628, 11834, 12449],
  [52500, 7250, 6076, 3132, 7250, 12669, 13284],
  [55000, 7887, 6694, 3628, 7887, 13504, 14120],
  [57500, 8537, 7325, 4130, 8537, 14339, 14955],
  [60000, 9200, 7970, 4640, 9200, 15175, 15791],
  [62500, 9876, 8629, 5156, 9876, 16010, 16625],
  [65000, 10567, 9302, 5680, 10567, 16845, 17461],
  [67500, 11271, 9988, 6210, 11271, 17681, 18296],
  [70000, 11988, 10689, 6746, 11988, 18516, 19132],
  [72500, 12718, 11403, 7290, 12718, 19351, 19967],
  [75000, 13463, 12131, 7840, 13463, 20186, 20802],
  [77500, 14263, 12911, 8428, 14263, 21068, 21684],
  [80000, 15145, 13765, 9072, 15145, 22021, 22637],
  [82500, 16044, 14636, 9724, 16044, 22973, 23589],
  [85000, 16960, 15525, 10384, 16960, 23926, 24541],
  [87500, 17894, 16431, 11054, 17894, 24878, 25493],
  [90000, 18844, 17355, 11734, 18844, 25830, 26446],
  [92500, 19796, 18297, 12420, 19796, 26782, 27398],
  [95000, 20749, 19249, 13116, 20749, 27735, 28351],
  [97500, 21701, 20201, 13822, 21701, 28687, 29303],
  [100000, 22653, 21153, 14536, 22653, 29640, 30255],
  [102500, 23606, 22106, 15258, 23606, 30592, 31207],
  [105000, 24558, 23058, 15990, 24558, 31544, 32160],
  [107500, 25561, 24061, 16768, 25561, 32547, 33163],
  [110000, 26611, 25111, 17596, 26611, 33597, 34213],
];
const BESONDERE_2027_ENTWURF = [
  [5000, 0, 0, 0, 0, 0, 700],
  [7500, 0, 0, 0, 0, 340, 1050],
  [10000, 0, 0, 0, 0, 690, 1400],
  [12500, 0, 0, 0, 0, 1040, 1750],
  [15000, 0, 0, 0, 0, 1390, 2309],
  [17500, 0, 0, 0, 0, 1740, 3359],
  [20000, 385, 0, 0, 385, 2281, 4409],
  [22500, 907, 88, 0, 907, 3331, 5459],
  [25000, 1513, 527, 0, 1513, 4381, 6509],
  [27500, 2141, 1083, 0, 2141, 5431, 7504],
  [30000, 2791, 1697, 0, 2791, 6481, 8440],
  [32500, 3461, 2331, 0, 3461, 7478, 9422],
  [35000, 4154, 2987, 364, 4154, 8416, 10446],
  [37500, 4867, 3664, 800, 4867, 9396, 11494],
  [40000, 5602, 4363, 1296, 5602, 10416, 12544],
  [42500, 6358, 5082, 1854, 6358, 11466, 13594],
  [45000, 7136, 5824, 2454, 7136, 12516, 14644],
  [47500, 7935, 6586, 3066, 7935, 13566, 15694],
  [50000, 8755, 7370, 3690, 8755, 14616, 16744],
  [52500, 9596, 8175, 4324, 9596, 15666, 17794],
  [55000, 10459, 9002, 4970, 10459, 16716, 18844],
  [57500, 11344, 9850, 5624, 11344, 17766, 19894],
  [60000, 12249, 10719, 6292, 12249, 18816, 20944],
  [62500, 13176, 11609, 6968, 13176, 19866, 21994],
  [65000, 14124, 12521, 7656, 14124, 20916, 23044],
  [67500, 15094, 13455, 8354, 15094, 21966, 24094],
  [70000, 16085, 14409, 9062, 16085, 23016, 25144],
  [72500, 17097, 15385, 9782, 17097, 24066, 26194],
  [75000, 18131, 16382, 10512, 18131, 25116, 27244],
  [77500, 19180, 17401, 11254, 19180, 26166, 28294],
  [80000, 20230, 18441, 12004, 20230, 27216, 29344],
  [82500, 21280, 19491, 12768, 21280, 28266, 30394],
  [85000, 22330, 20541, 13540, 22330, 29316, 31444],
  [87500, 23380, 21591, 14324, 23380, 30366, 32494],
  [90000, 24430, 22641, 15118, 24430, 31416, 33544],
  [92500, 25480, 23691, 15922, 25480, 32466, 34594],
  [95000, 26530, 24741, 16738, 26530, 33516, 35644],
  [97500, 27580, 25791, 17564, 27580, 34566, 36694],
  [100000, 28630, 26841, 18402, 28630, 35616, 37744],
  [102500, 29680, 27891, 19250, 29680, 36666, 38794],
  [105000, 30730, 28941, 20108, 30730, 37716, 39844],
  [107500, 31780, 29991, 20976, 31780, 38766, 40894],
  [110000, 32830, 31041, 21856, 32830, 39816, 41944],
];

const pruefeAllgemein = (year, tabelle) => {
  assert.equal(tabelle.length, 43);
  for (const [brutto, ...soll] of tabelle) {
    soll.forEach((erwartet, i) => {
      const STKL = i + 1;
      const r = lohnsteuer({ year, LZZ: 1, RE4: brutto * 100, STKL, KVZ: 2.9, PVZ: STKL === 2 ? 0 : 1 });
      assert.equal(r.LSTLZZ, erwartet * 100, `${year}: Brutto ${brutto} €, Steuerklasse ${STKL}`);
    });
  }
};
const pruefeBesondere = (year, tabelle) => {
  assert.equal(tabelle.length, 43);
  for (const [brutto, ...soll] of tabelle) {
    soll.forEach((erwartet, i) => {
      const STKL = i + 1;
      const PKPV = STKL === 3 ? 50000 : STKL === 6 ? 0 : 30000;
      const r = lohnsteuer({ year, LZZ: 1, RE4: brutto * 100, STKL, ALV: 1, KRV: 1, PKV: 1, PKPV });
      assert.equal(r.LSTLZZ, erwartet * 100, `${year}: Brutto ${brutto} €, Steuerklasse ${STKL}`);
    });
  }
};

test('Lohnsteuer 2027 (Entwurf): allgemeine Prüftabelle, alle 258 Werte auf den Euro genau', () => pruefeAllgemein(2027, ALLGEMEIN_2027_ENTWURF));
test('Lohnsteuer 2027 (Entwurf): besondere Prüftabelle, alle 258 Werte auf den Euro genau', () => pruefeBesondere(2027, BESONDERE_2027_ENTWURF));

test('Lohnsteuer 2026: allgemeine Prüftabelle des BMF, alle 258 Werte auf den Euro genau', () => {
  assert.equal(ALLGEMEIN_2026.length, 43);
  for (const [brutto, ...soll] of ALLGEMEIN_2026) {
    soll.forEach((erwartet, i) => {
      const STKL = i + 1;
      const r = lohnsteuer({ year: 2026, LZZ: 1, RE4: brutto * 100, STKL, KVZ: 2.9, PVZ: STKL === 2 ? 0 : 1 });
      assert.equal(r.LSTLZZ, erwartet * 100, `Brutto ${brutto} €, Steuerklasse ${STKL}`);
    });
  }
});

test('Lohnsteuer 2026: besondere Prüftabelle des BMF, alle 258 Werte auf den Euro genau', () => {
  assert.equal(BESONDERE_2026.length, 43);
  for (const [brutto, ...soll] of BESONDERE_2026) {
    soll.forEach((erwartet, i) => {
      const STKL = i + 1;
      const PKPV = STKL === 3 ? 50000 : STKL === 6 ? 0 : 30000;
      const r = lohnsteuer({ year: 2026, LZZ: 1, RE4: brutto * 100, STKL, ALV: 1, KRV: 1, PKV: 1, PKPV });
      assert.equal(r.LSTLZZ, erwartet * 100, `Brutto ${brutto} €, Steuerklasse ${STKL}`);
    });
  }
});

test('Lohnsteuer: Monatswert ist der abgerundete Zwölftel-Anteil der Jahressteuer', () => {
  // 5.000 € im Monat = 60.000 € im Jahr → Jahressteuer laut Prüftabelle 9.389 € (Steuerklasse I)
  const r = lohnsteuer({ year: 2026, LZZ: 2, RE4: 500000, STKL: 1, KVZ: 2.9, PVZ: 1 });
  assert.equal(r.LSTJAHR, 9389);
  assert.equal(r.LSTLZZ, Math.floor(938900 / 12));
  assert.equal(r.SOLZLZZ, 0);
  assert.equal(r.BK, 0); // keine Kirchensteuerpflicht
});

test('Lohnsteuer: Kinderfreibeträge ändern nur Solidaritätszuschlag und Kirchensteuer', () => {
  const ohne = lohnsteuer({ year: 2026, LZZ: 2, RE4: 1200000, STKL: 1, PVZ: 1, R: 1 });
  const mit = lohnsteuer({ year: 2026, LZZ: 2, RE4: 1200000, STKL: 1, ZKF: 1, PVZ: 1, R: 1 });
  assert.equal(mit.LSTLZZ, ohne.LSTLZZ);
  assert.ok(ohne.SOLZLZZ > 0);
  assert.ok(mit.SOLZLZZ < ohne.SOLZLZZ);
  assert.ok(mit.BK < ohne.BK);
  assert.equal(ohne.BK, ohne.LSTLZZ);
});

test('Sozialversicherung 2026: Arbeitnehmeranteile von Hand nachgerechnet', () => {
  // 3.000 €, kinderlos über 23, Zusatzbeitrag 2,9 %:
  // KV (14,6 + 2,9) / 2 = 8,75 % → 262,50 €; PV 1,8 + 0,6 = 2,4 % → 72,00 €; RV 9,3 % → 279,00 €; AV 1,3 % → 39,00 €
  const a = netSalary({ year: 2026, grossMonthly: 3000 });
  assert.deepEqual([a.kv, a.pv, a.rv, a.av], [26250, 7200, 27900, 3900]);
  assert.equal(a.social, 65250);
  assert.equal(a.soli, 0);
  assert.equal(a.kist, 0);
  assert.equal(a.net, a.gross - a.taxes - a.social);
  // über der Beitragsbemessungsgrenze KV/PV (5.812,50 €): 508,59 € und 139,50 €
  const b = netSalary({ year: 2026, grossMonthly: 7000 });
  assert.deepEqual([b.kv, b.pv, b.rv, b.av], [50859, 13950, 65100, 9100]);
  // über der Beitragsbemessungsgrenze RV/AV (8.450 €): 785,85 € und 109,85 €
  const c = netSalary({ year: 2026, grossMonthly: 9000 });
  assert.deepEqual([c.rv, c.av], [78585, 10985]);
  // Sachsen: Pflege 2,3 + 0,6 = 2,9 % → 87,00 €
  assert.equal(netSalary({ year: 2026, grossMonthly: 3000, state: 'SN' }).pv, 8700);
  // drei Kinder: 1,8 − 2 × 0,25 = 1,3 % → 39,00 €; ein Kind: 1,8 % → 54,00 €
  assert.equal(netSalary({ year: 2026, grossMonthly: 3000, children: 3 }).pv, 3900);
  assert.equal(netSalary({ year: 2026, grossMonthly: 3000, children: 1 }).pv, 5400);
  // kinderlos unter 23: kein Zuschlag → 54,00 €
  assert.equal(netSalary({ year: 2026, grossMonthly: 3000, childless: false }).pv, 5400);
  // eigener Zusatzbeitrag 1,9 %: (14,6 + 1,9) / 2 = 8,25 % → 247,50 €
  assert.equal(netSalary({ year: 2026, grossMonthly: 3000, kvAdd: 1.9 }).kv, 24750);
  assert.deepEqual([0, 1, 2, 3, 5, 9].map(pvDiscounts), [0, 0, 1, 2, 4, 4]);
});

test('Sozialversicherung 2027 (Entwurf): Zuschlag für Kinderlose 0,9 %, neue Grenzen', () => {
  const a = netSalary({ year: 2027, grossMonthly: 3000 });
  assert.equal(a.draft, true);
  assert.equal(a.pv, 8100); // 1,8 + 0,9 = 2,7 %
  // Beitragsbemessungsgrenze KV/PV 76.500 € im Jahr = 6.375 € im Monat → 8,75 % = 557,81 €
  assert.equal(netSalary({ year: 2027, grossMonthly: 7000 }).kv, 55781);
  // RV/AV 106.200 € im Jahr = 8.850 € im Monat → 9,3 % = 823,05 €
  assert.equal(netSalary({ year: 2027, grossMonthly: 9000 }).rv, 82305);
  assert.equal(netSalary({ year: 2026, grossMonthly: 3000 }).draft, false);
});

test('Kirchensteuer: 8 % in Bayern und Baden-Württemberg, sonst 9 % der Lohnsteuer', () => {
  assert.deepEqual(['BY', 'BW', 'NW', 'SN', ''].map(churchRate), [8, 8, 9, 9, 9]);
  const by = netSalary({ year: 2026, grossMonthly: 4000, state: 'BY', church: true });
  const nw = netSalary({ year: 2026, grossMonthly: 4000, state: 'NW', church: true });
  assert.equal(by.kist, Math.floor((by.lst * 8) / 100));
  assert.equal(nw.kist, Math.floor((nw.lst * 9) / 100));
  assert.equal(netSalary({ year: 2026, grossMonthly: 4000, state: 'NW' }).kist, 0);
});

test('Netto: Steuerklassen, Zonen und leere Eingaben', () => {
  const k = (taxClass) => netSalary({ year: 2026, grossMonthly: 4000, taxClass }).net;
  assert.ok(k(3) > k(1));
  assert.equal(k(4), k(1));
  assert.ok(k(1) > k(5));
  assert.ok(k(5) > k(6));
  assert.ok(k(2) > k(1));
  assert.equal(netSalary({ year: 2026, grossMonthly: 603, minijobLimit: 603 }).zone, 'minijob');
  assert.equal(netSalary({ year: 2026, grossMonthly: 603.01, minijobLimit: 603 }).zone, 'midijob');
  assert.equal(netSalary({ year: 2026, grossMonthly: 2000, minijobLimit: 603 }).zone, 'midijob');
  assert.equal(netSalary({ year: 2026, grossMonthly: 2000.01, minijobLimit: 603 }).zone, 'regular');
  assert.equal(netSalary({ year: 2026, grossMonthly: 0 }), null);
  assert.equal(netSalary({ year: 2026 }), null);
  // unbekanntes Jahr → nächstliegendes vorhandenes
  assert.equal(netSalary({ year: 2031, grossMonthly: 3000 }).year, Math.max(...Object.keys(TAX_YEARS).map(Number)));
  assert.equal(netSalary({ year: 2020, grossMonthly: 3000 }).year, 2026);
});

test('Netto → Brutto: kleinstes Brutto, das das Wunsch-Netto erreicht', () => {
  for (const [ziel, opt] of [[2000, { year: 2026 }], [2500, { year: 2026, taxClass: 3, church: true, state: 'BY' }], [4321.5, { year: 2027, taxClass: 5 }]]) {
    const brutto = grossForNet(ziel, opt);
    assert.ok(netSalary({ ...opt, grossMonthly: brutto }).net >= Math.round(ziel * 100));
    assert.ok(netSalary({ ...opt, grossMonthly: brutto - 0.01 }).net < Math.round(ziel * 100));
  }
  assert.equal(grossForNet(0, { year: 2026 }), null);
});

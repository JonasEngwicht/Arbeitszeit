// FAQ des Industrieminuten-Rechners: wird als HTML und als strukturierte Daten (FAQPage) ausgegeben.
// Euro-Beträge setzt der Build aus dem Rechenkern ein (Werte in v).
export const faqIndustrie = (v) => [
  {
    q: 'Wie rechne ich Minuten in Industrieminuten um?',
    a: 'Teile die Minuten durch 60 und multipliziere mit 100 – oder kürzer: Minuten ÷ 0,6. Aus 45 Minuten werden so 75 Industrieminuten, aus 15 Minuten 25 und aus 30 Minuten 50. Der Industrieminuten-Rechner oben rechnet das live in beide Richtungen.',
  },
  {
    q: 'Wie rechne ich Industrieminuten in normale Minuten um?',
    a: 'Multipliziere die Industrieminuten mit 0,6. 75 Industrieminuten × 0,6 sind 45 Minuten, 50 Industrieminuten sind 30 Minuten. Bei einer Dezimalzahl wie 7,6 Stunden rechnest du nur die Nachkommastellen um: 0,6 × 60 = 36 Minuten, also 7 Stunden und 36 Minuten.',
  },
  {
    q: 'Wie viele Industrieminuten hat eine Stunde?',
    a: 'Eine Stunde hat 100 Industrieminuten. Die Stunde selbst bleibt gleich lang, sie wird nur in 100 statt in 60 Teile geteilt. Eine halbe Stunde sind deshalb 50 Industrieminuten, eine Viertelstunde 25.',
  },
  {
    q: 'Wie lange dauert eine Industrieminute?',
    a: 'Eine Industrieminute dauert 36 Sekunden, also 0,6 normale Minuten. Sie ist eine Hundertstelstunde: 3.600 Sekunden ÷ 100 = 36 Sekunden.',
  },
  {
    q: 'Was sind 7,75 Stunden in Stunden und Minuten?',
    a: '7,75 Stunden sind 7 Stunden und 45 Minuten – nicht 7 Stunden und 75 Minuten. Die Nachkommastellen 0,75 stehen für 75 Industrieminuten, und 75 × 0,6 ergibt 45 Minuten.',
  },
  {
    q: 'Sind Industrieminuten und Dezimalstunden dasselbe?',
    a: 'Ja, im Alltag meinen Industriezeit, Industriestunden, Dezimalstunden und Dezimalzeit dasselbe: Arbeitszeit als Kommazahl. Die Zahl vor dem Komma sind die vollen Stunden, die beiden Stellen dahinter die Industrieminuten. 8,25 Stunden sind also 8 Stunden und 25 Industrieminuten, das entspricht 8 Stunden und 15 Minuten.',
  },
  {
    q: 'Warum steht auf meiner Lohnabrechnung eine Dezimalzahl?',
    a: `Weil sich mit Dezimalstunden einfacher rechnen lässt: Stunden mal Stundenlohn ergibt direkt den Lohn. ${v.exHM} Stunden werden zu ${v.exDec} Stunden, und ${v.exDec} × ${v.wage} ergeben ${v.exPay} brutto. Mit Stunden und Minuten müsstest du erst umrechnen.`,
  },
  {
    q: 'Werden meine Eingaben gespeichert?',
    a: 'Nein. Der Industrieminuten-Rechner rechnet vollständig in deinem Browser. Deine Eingaben werden weder übertragen noch gespeichert.',
  },
];

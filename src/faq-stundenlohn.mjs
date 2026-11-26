// FAQ des Stundenlohnrechners: wird als HTML und als strukturierte Daten (FAQPage) ausgegeben.
// Alle Euro-Beträge und Rechtswerte setzt der Build aus dem Rechenkern ein (Werte in v).
export const faqStundenlohn = (v) => [
  {
    q: 'Wie berechne ich meinen Stundenlohn aus dem Monatsgehalt?',
    a: `Mit der Formel Monatsgehalt × 3 ÷ 13 ÷ Wochenstunden. Bei ${v.exSalary} brutto und ${v.exHours} Stunden pro Woche sind das ${v.exRate} pro Stunde. Der Stundenlohnrechner oben rechnet das live aus und zeigt, ob das Ergebnis über dem Mindestlohn liegt.`,
  },
  {
    q: 'Warum rechnet man mit 4,33 Wochen pro Monat?',
    a: 'Ein Jahr hat 52 Wochen und 12 Monate, ein Monat also im Durchschnitt 52 ÷ 12 = 4,33 Wochen. Die Lohnformel „× 3 ÷ 13“ rechnet genauso: Ein Quartal hat 3 Monate und 13 Wochen. Bei 40 Wochenstunden ergibt das rund 173,33 Stunden im Monat. Mit dem gerundeten Faktor 4,33 kommt man auf 173,2 Stunden – der Unterschied beim Stundenlohn liegt im Cent-Bereich.',
  },
  {
    q: `Wie hoch ist der Stundenlohn bei ${v.exSalary} brutto und ${v.exHours} Stunden?`,
    a: `${v.exRate} brutto pro Stunde. Gerechnet wird ${v.exSalary} × 3 ÷ 13 ÷ ${v.exHours}. Bei 35 Wochenstunden sind es ${v.exRate35}, bei 30 Wochenstunden ${v.exRate30}.`,
  },
  {
    q: 'Wie viel verdiene ich im Monat mit Mindestlohn in Vollzeit?',
    a: `Bei 40 Wochenstunden und dem Mindestlohn von ${v.minWage} pro Stunde sind es ${v.minWageMonth} brutto im Monat (${v.minWage} × 40 × 13 ÷ 3). ${v.minWageNextFaq}`,
  },
  {
    q: 'Wie viele Stunden darf ich im Minijob arbeiten?',
    a: `Das hängt vom Stundenlohn ab, denn begrenzt ist der Verdienst: Die Minijob-Grenze liegt bei ${v.minijob} im Monat. Mit dem Mindestlohn von ${v.minWage} sind das höchstens ${v.minijobHours} Stunden im Monat, also rund ${v.minijobHoursWeek} Stunden pro Woche. Verdienst du mehr pro Stunde, sinkt die Stundenzahl entsprechend. Setze im Rechner den Haken bei „Minijob prüfen“.`,
  },
  {
    q: 'Was bleibt vom Stundenlohn netto übrig?',
    a: `Von ${v.exRate} brutto pro Stunde bleiben ${v.taxYear} in Steuerklasse I rund ${v.exNetHour} netto, bei 40 Wochenstunden also ${v.exNetMonth} im Monat (ohne Kinder, ohne Kirchensteuer). Der genaue Betrag hängt von Steuerklasse, Kindern, Kirchensteuer, Bundesland und Krankenkasse ab. Der Rechner zeigt eine Netto-Schätzung für deine Steuerklasse; alle Angaben berücksichtigt der Brutto-Netto-Rechner. Im Minijob wird der Lohn in der Regel ohne Abzüge ausgezahlt, wenn du dich von der Rentenversicherungspflicht befreien lässt.`,
  },
  {
    q: 'Zählen Urlaubsgeld und Weihnachtsgeld zum Stundenlohn?',
    a: 'Für deinen vertraglichen Stundenlohn zählt das regelmäßige Monatsgehalt. Willst du wissen, was eine Arbeitsstunde im Jahr tatsächlich wert ist, rechnest du Sonderzahlungen mit ein: Stelle den Rechner auf „pro Jahr“ und trage dein Jahresbrutto mit Urlaubs- und Weihnachtsgeld ein.',
  },
  {
    q: 'Werden meine Daten gespeichert oder übertragen?',
    a: 'Nein. Der Stundenlohnrechner rechnet vollständig in deinem Browser. Gehalt und Stundenlohn werden nicht an einen Server übertragen und nicht gespeichert. Es gibt kein Konto und keine Anmeldung.',
  },
];

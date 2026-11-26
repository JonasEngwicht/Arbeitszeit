// FAQ des Brutto-Netto-Rechners: wird als HTML und als strukturierte Daten (FAQPage) ausgegeben.
// Alle Euro-Beträge und Sätze setzt der Build aus dem Netto-Rechenkern ein (Werte in v).
export const faqBruttoNetto = (v) => [
  {
    q: `Wie viel netto bleibt von ${v.exGross} brutto?`,
    a: `Von ${v.exGross} brutto im Monat bleiben ${v.year} in Steuerklasse I rund ${v.exNet} netto. Abgezogen werden ${v.exTaxes} Lohnsteuer und ${v.exSocial} Sozialabgaben. Gerechnet ist ohne Kinder, ohne Kirchensteuer und mit dem durchschnittlichen Zusatzbeitrag der Krankenkassen von ${v.kvAdd}. In Steuerklasse III sind es ${v.exNet3}, in Steuerklasse V ${v.exNet5}.`,
  },
  {
    q: 'Welche Abzüge gehen vom Bruttogehalt ab?',
    a: `Steuern und Sozialabgaben. Steuern sind die Lohnsteuer, bei hohen Einkommen der Solidaritätszuschlag und für Kirchenmitglieder die Kirchensteuer. Die Sozialabgaben sind dein Anteil an der Krankenversicherung (${v.kvRate}), Pflegeversicherung (${v.pvRate}, für Kinderlose ab 23 Jahren ${v.pvRateChildless}), Rentenversicherung (${v.rvRate}) und Arbeitslosenversicherung (${v.avRate}).`,
  },
  {
    q: 'Was ändert die Steuerklasse am Netto?',
    a: `Die Steuerklasse bestimmt, wie viel Lohnsteuer monatlich einbehalten wird. Bei ${v.exGross} brutto bleiben in Steuerklasse I ${v.exNet}, in Steuerklasse III ${v.exNet3} und in Steuerklasse V ${v.exNet5}. Die Sozialabgaben sind in allen Steuerklassen gleich. Zu viel oder zu wenig gezahlte Lohnsteuer gleicht die Steuererklärung am Jahresende aus.`,
  },
  {
    q: 'Wie rechne ich netto in brutto um?',
    a: `Eine einfache Formel gibt es nicht, weil die Lohnsteuer mit dem Einkommen überproportional steigt. Der Rechner sucht deshalb das Brutto, das dein Wunsch-Netto ergibt: Für ${v.revNet} netto brauchst du in Steuerklasse I rund ${v.revGross} brutto im Monat. Trage dein Wunsch-Netto im Feld „Netto in Brutto umrechnen“ ein.`,
  },
  {
    q: 'Wie viel netto bleibt beim Mindestlohn in Vollzeit?',
    a: `Mit dem Mindestlohn von ${v.minWage} pro Stunde und 40 Wochenstunden verdienst du ${v.minWageGross} brutto im Monat. Davon bleiben in Steuerklasse I ohne Kinder und ohne Kirchensteuer rund ${v.minWageNet} netto, also etwa ${v.minWageNetHour} pro Stunde.`,
  },
  {
    q: 'Kann ich auch mit meinem Stundenlohn rechnen?',
    a: 'Ja. Stelle den Zeitraum auf „pro Stunde“ und trage deinen Stundenlohn und deine Wochenstunden ein. Der Rechner ermittelt daraus dein Monatsbrutto (Stundenlohn × Wochenstunden × 13 ÷ 3) und zeigt Netto pro Monat, pro Jahr und pro Stunde.',
  },
  {
    q: 'Warum weicht meine Gehaltsabrechnung vom Ergebnis ab?',
    a: 'Häufige Gründe sind ein anderer Zusatzbeitrag deiner Krankenkasse, ein Freibetrag in deinen Lohnsteuermerkmalen, Sonderzahlungen wie Weihnachtsgeld, ein Firmenwagen, eine betriebliche Altersvorsorge oder eine private Krankenversicherung. Diese Fälle rechnet der Rechner nicht ein. Trage den Zusatzbeitrag deiner Krankenkasse ein, dann passt das Ergebnis meist auf wenige Euro genau.',
  },
  {
    q: 'Werden meine Daten gespeichert oder übertragen?',
    a: 'Nein. Der Brutto-Netto-Rechner rechnet vollständig in deinem Browser. Gehalt, Steuerklasse und alle anderen Angaben werden nicht an einen Server übertragen und nicht gespeichert. Es gibt kein Konto und keine Anmeldung.',
  },
];

// FAQ: wird als HTML und als strukturierte Daten (FAQPage) ausgegeben.
export const FAQ = [
  {
    q: 'Wie berechne ich meine Arbeitszeit mit Pause?',
    a: 'Ziehe den Arbeitsbeginn vom Arbeitsende ab und dann alle Pausen. Beispiel: 8:00 bis 16:30 Uhr sind 8:30 Stunden Anwesenheit, abzüglich 30 Minuten Pause bleiben 8:00 Stunden Arbeitszeit. Im Rechner oben kannst du beliebig viele Pausen eintragen – als Minuten oder als Uhrzeit von–bis.',
  },
  {
    q: 'Von 8 bis 14 Uhr – wie viele Stunden sind das?',
    a: 'Von 8 bis 14 Uhr sind es 6 Stunden (6,00 h dezimal). Für genau 6 Stunden ist noch keine Pause vorgeschrieben – erst bei mehr als 6 Stunden Arbeit brauchst du mindestens 30 Minuten Pause. Machst du trotzdem 30 Minuten Pause, bleiben 5:30 Stunden Arbeitszeit.',
  },
  {
    q: 'Wie rechne ich Minuten in Dezimalstunden um?',
    a: 'Teile die Minuten durch 60. 15 Minuten sind 0,25 Stunden, 30 Minuten 0,5 Stunden, 45 Minuten 0,75 Stunden. Umgekehrt multiplizierst du die Nachkommastellen mit 60: 0,8 Stunden × 60 = 48 Minuten. 7:45 Stunden sind also 7,75 Stunden dezimal.',
  },
  {
    q: 'Ab wann muss ich Pause machen?',
    a: 'Erwachsene müssen bei mehr als 6 Stunden Arbeit mindestens 30 Minuten Pause machen, bei mehr als 9 Stunden mindestens 45 Minuten (§ 4 ArbZG). Die Pause darf in Abschnitte von mindestens 15 Minuten aufgeteilt werden. Länger als 6 Stunden am Stück darfst du nicht ohne Pause arbeiten. Für Jugendliche gelten strengere Regeln: 30 Minuten bei mehr als 4,5 Stunden und 60 Minuten bei mehr als 6 Stunden.',
  },
  {
    q: 'Zählt die Pause zur Arbeitszeit?',
    a: 'Nein. Ruhepausen gehören nach dem Arbeitszeitgesetz nicht zur Arbeitszeit und werden in der Regel nicht bezahlt. Anders ist es bei kurzen Unterbrechungen, in denen du dich bereithalten musst, oder wenn dein Arbeits- oder Tarifvertrag bezahlte Pausen vorsieht.',
  },
  {
    q: 'Wie viele Stunden darf ich am Tag maximal arbeiten?',
    a: 'Regulär 8 Stunden pro Werktag. Bis zu 10 Stunden sind erlaubt, wenn du innerhalb von 6 Monaten im Durchschnitt auf 8 Stunden pro Werktag kommst (§ 3 ArbZG). Mehr als 10 Stunden Arbeitszeit am Tag sind nur in gesetzlichen Ausnahmefällen zulässig. Jugendliche dürfen höchstens 8 Stunden am Tag arbeiten.',
  },
  {
    q: 'Wie viele Arbeitsstunden hat ein Monat bei 40 Stunden pro Woche?',
    a: 'Im Durchschnitt 173,2 Stunden, also 173 Stunden und 12 Minuten (40 × 4,33 Wochen). Im einzelnen Monat hängt es von der Zahl der Arbeitstage ab: Ein Monat mit 21 Arbeitstagen hat bei 8 Stunden pro Tag 168 Stunden, einer mit 23 Arbeitstagen 184 Stunden. Die Monatsansicht des Rechners zählt die echten Arbeitstage.',
  },
  {
    q: 'Wie berechne ich Überstunden?',
    a: 'Ziehe deine Sollzeit von der tatsächlich geleisteten Arbeitszeit ab. Bei 40 Stunden Soll und 43:30 Stunden Ist hast du 3:30 Überstunden gemacht. Trage im Rechner deine Wochenstunden ein – Wochen- und Monatsansicht zeigen Plus und Minus pro Tag und den Saldo automatisch.',
  },
  {
    q: 'Wie rechne ich Minuten in Industrieminuten um?',
    a: 'Teile die Minuten durch 60 und nimm das Ergebnis mal 100. 15 Minuten sind 25 Industrieminuten, 30 Minuten 50 und 45 Minuten 75 Industrieminuten. Umgekehrt gilt: Industrieminuten × 0,6 = Minuten. Eine Industrieminute ist eine Hundertstelstunde und dauert 36 Sekunden. Der Tab „Dezimal“ rechnet beide Richtungen.',
  },
  {
    q: 'Wie berechne ich meinen Lohn aus den Arbeitsstunden?',
    a: 'Multipliziere deine Arbeitsstunden als Dezimalzahl mit deinem Stundenlohn. Bei 7:45 Stunden (7,75 h) und 15,00 € pro Stunde sind das 116,25 € brutto. Trägst du in den Einstellungen deinen Stundenlohn ein, zeigt der Rechner das Brutto für Tag, Woche und Monat. Was dein Monatsgehalt pro Stunde wert ist, zeigt der Stundenlohnrechner.',
  },
  {
    q: 'Kann ich den Rechner als App und offline nutzen?',
    a: 'Ja. Auf Android und am PC erscheint der Knopf „App installieren“ oder du wählst im Browser-Menü „App installieren“. Auf dem iPhone tippst du in Safari auf „Teilen“ und dann auf „Zum Home-Bildschirm“. Danach startet der Rechner wie eine App und funktioniert auch ohne Internet. Auf dem iPhone bleiben deine Einträge so außerdem dauerhaft erhalten.',
  },
  {
    q: 'Werden meine Daten gespeichert oder übertragen?',
    a: 'Deine Einträge werden nur lokal in deinem Browser gespeichert (IndexedDB) und nie an einen Server übertragen. Es gibt kein Konto und keine Anmeldung. Über „Datensicherung“ in der Monatsansicht kannst du deine Daten als Datei sichern und auf einem anderen Gerät wieder einspielen. Löschst du die Browserdaten, sind auch die Einträge weg.',
  },
];

/**
 * soccerdrills-catalog.js
 * Kuratiertes Verzeichnis praxiserprobter Übungen von soccerdrills.de
 * speziell abgestimmt auf die F-Jugend / U9 (ca. 8 Jahre) nach DFB-Richtlinien.
 */

const soccerdrillsCatalog = [
  // --- AUFWÄRMEN & BALLGEWÖHNUNG (00-05 Min) ---
  {
    id: 'sd-warmup-1',
    title: 'Hütchenkönig im Zauberwald',
    phase: 'warmup',
    phaseLabel: 'Aufwärmen (Ballgewöhnung)',
    focus: 'Dribbling',
    originalUrl: 'https://www.soccerdrills.de/themen/dribbling/kinderfussball-hütchenwald/',
    targetAge: 'F-Jugend (U9)',
    durationMinutes: 5,
    equipment: ['16-20 Bälle (1 pro Kind)', '20-30 Markierungshütchen in 3 Farben', '4 Eck-Hütchen'],
    organization: 'Ein markiertes Feld 20x20m ("Zauberwald"). Überall stehen Hütchen verteilt. Jedes Kind hat einen Ball am Fuß.',
    description: 'Die Kinder dribbeln frei durch den Wald. Auf Trainer-Kommando müssen sie bestimmte Aktionen ausführen: "Rot" = mit der Sohle stoppen, "Gelb" = einmal um das Hütchen kreisen, "Blau" = Richtungswechsel mit der Außenseite. Wer berührt kein einziges Hütchen?',
    coachingPoints: [
      'Den Kopf immer wieder heben und den Blick vom Ball lösen',
      'Kurze, engmaschige Ballkontakte mit beiden Füßen',
      'Tempo dosieren – nicht blind rennen, sondern freie Räume suchen'
    ],
    fieldAscii: `
+-----------------------------------+
|  [H]         (K)       [H]        |
|        (K)          (K)      (K)  |
|   [H]       [H]          [H]      |
|        (K)       (K)              |
|  [H]         [H]        (K)   [H] |
+-----------------------------------+
Legende: [H] = Hütchen, (K) = Kind mit Ball
`
  },
  {
    id: 'sd-warmup-2',
    title: 'Balljäger & Dribbel-Flitzer',
    phase: 'warmup',
    phaseLabel: 'Aufwärmen (Fangspiel)',
    focus: 'Koordination',
    originalUrl: 'https://www.soccerdrills.de/themen/aufwaermen/fangspiele-kinderfussball/',
    targetAge: 'F-Jugend (U9)',
    durationMinutes: 5,
    equipment: ['14 Bälle', '2 Leibchen für Jäger', 'Hütchen für Feld 20x15m'],
    organization: 'Feld 20x15 Meter. 14 Kinder dribbeln mit Ball. 2 Kinder ohne Ball tragen ein Leibchen und sind die "Jäger".',
    description: 'Die Jäger versuchen, die Bälle der Dribbler aus dem Feld zu spitzeln. Wurde der Ball weggespitzelt, macht das Kind 3 Hampelmänner und holt den Ball wieder ins Feld. Wechsel der Jäger nach 90 Sekunden.',
    coachingPoints: [
      'Körper zwischen Jäger und Ball stellen (Ball abschirmen)',
      'Plötzliche Tempowechsel bei Gefahr nutzen',
      'Fairplay und sofortige Reaktion beim Ballverlust'
    ],
    fieldAscii: `
+-----------------------------------+
| (K)       (J)             (K)     |
|      (K)          (K)             |
|              (J)          (K)     |
| (K)     (K)          (K)          |
+-----------------------------------+
Legende: (K) = Dribbler, (J) = Jäger (Leibchen)
`
  },

  // --- KOORDINATION & MOTORIK (05-10 Min) ---
  {
    id: 'sd-coord-1',
    title: 'Dschungel-Parcours: Reifen & Stangen',
    phase: 'coordination',
    phaseLabel: 'Koordination & Motorik',
    focus: 'Koordination',
    originalUrl: 'https://www.soccerdrills.de/themen/koordination/kinder-bewegungslandschaften/',
    targetAge: 'F-Jugend (U9)',
    durationMinutes: 5,
    equipment: ['8 Koordinationsreifen', '6 Minihürden', '6 Slalomstangen', '16 Bälle'],
    organization: '2 parallele Bahnen für je 8-10 Kinder. Minimalste Wartezeiten durch direkten Durchlauf ohne Schlange.',
    description: 'Bahn A: Prellsprünge durch die Reifen (Einbeinig/Beidbeinig), Seitwärtssprünge über Minihürden, Sprint zur Ziellinie. Bahn B: Rhythmisches Dribbling mit Fußwechsel durch den Stangenwald.',
    coachingPoints: [
      'Auf den Fußballen federn, nicht auf die Fersen trampeln',
      'Arme aktiv zur Balance und Beschleunigung mitnehmen',
      'Freude an rhythmischen Bewegungen wecken'
    ],
    fieldAscii: `
Bahn 1: (K)(K) --> O O O O --> /\\ /\\ /\\ --> [Ziel]
Bahn 2: (K)(K) --> |  |  |  |  (Slalom)  --> [Ziel]
Legende: O = Reifen, /\\ = Minihürde, | = Stange
`
  },
  {
    id: 'sd-coord-2',
    title: 'Ampel-Sprint mit Richtungswechsel',
    phase: 'coordination',
    phaseLabel: 'Koordination & Motorik',
    focus: 'Schnelligkeit',
    originalUrl: 'https://www.soccerdrills.de/themen/schnelligkeit/reaktionssprints-jugend/',
    targetAge: 'F-Jugend (U9)',
    durationMinutes: 5,
    equipment: ['4x4 Farbige Hütchen (Rot, Gelb, Grün, Blau)'],
    organization: '4 Quadratische Zonen für je 4-5 Kinder. Jede Ecke hat ein anderes Farbhütchen.',
    description: 'Die Kinder traben auf der Stelle im Zentrum. Der Trainer ruft eine Farbe oder Farbfolge (z.B. "Rot-Grün"). Die Kinder sprinten blitzschnell mit Richtungswechsel um das entsprechende Hütchen und zurück.',
    coachingPoints: [
      'Niedriger Körperschwerpunkt für schnelles Abstoppen und Wenden',
      'Schnelle akustische und visuelle Reaktionsfähigkeit',
      'Kurze, explosive Antritte'
    ],
    fieldAscii: `
  [Rot]          [Grün]
          (K)
        (K) (K)
          (K)
  [Gelb]         [Blau]
`
  },

  // --- HAUPTTEIL (10-30 Min, 20 Minuten intensiv) ---
  {
    id: 'sd-main-1',
    title: '1-gegen-1 auf 2 Minitore mit Vororientierung',
    phase: 'main',
    phaseLabel: 'Hauptteil (Schwerpunkt)',
    focus: '1vs1',
    originalUrl: 'https://www.soccerdrills.de/themen/1-gegen-1/1-gegen-1-frontal-minitore/',
    targetAge: 'F-Jugend (U9)',
    durationMinutes: 20,
    equipment: ['4 Minitore', '16 Bälle', '12 Hütchen', 'Leibchen'],
    organization: '2 parallele Felder (je 8-10 Kinder pro Feld). Jedes Feld ist 18x12m groß mit 2 Minitoren an den Stirnseiten.',
    description: 'Angreifer dribbelt auf den Verteidiger zu. Mit Körpertäuschung oder Finte versucht er das linke oder rechte Minitor anzusteuern und per Treffer abzuschließen. Erobert der Verteidiger den Ball, kontert er auf die Gegentore.',
    coachingPoints: [
      'Mut zum Dribbling: Suche aktiv das Duell und den schnellen Abschluss',
      'Finte mit Tempowechsel kombinieren (vorbei und weg!)',
      'Verteidiger: Seitliche Stellung, nicht überstürzt hineingrätschen'
    ],
    fieldAscii: `
[Tor 1]                                [Tor 2]
+--------------------------------------------+
|                  (V)                       |
|                   ^                        |
|                   |                        |
|                  (A) [Ball]                |
+--------------------------------------------+
       (A2) (A3)         (V2) (V3)
Legende: [Tor] = Minitor, (A) = Angreifer, (V) = Verteidiger
`
  },
  {
    id: 'sd-main-2',
    title: 'Pass-Dreieck mit Torschuss & Direktabnahme',
    phase: 'main',
    phaseLabel: 'Hauptteil (Schwerpunkt)',
    focus: 'Passspiel',
    originalUrl: 'https://www.soccerdrills.de/themen/passspiel/dreiecksspiel-direktpass/',
    targetAge: 'F-Jugend (U9)',
    durationMinutes: 20,
    equipment: ['2 Jugendtore (mit Torwart oder Minitore)', '16 Bälle', 'Hütchen-Dreiecke'],
    organization: '2 Stationen à 8-10 Kinder. Ein Dreieck mit 8-10m Seitenlänge vor dem Tor.',
    description: 'Spieler A passt mit der Innenseite zu B. B lässt klatschen oder dreht auf C auf. C schießt direkt oder nach einem Kontakt aufs Tor. Jeder rückt eine Position weiter (A->B->C->A).',
    coachingPoints: [
      'Saubere Passtechnik: Innenseite, Standbein zeigt zum Ziel',
      'Erster Kontakt in die offene Vorwärtsbewegung',
      'Gute Passschärfe – kein "Schiebepass", aber kontrolliert'
    ],
    fieldAscii: `
                  [ JUGENDTOR ]
                        |
                       (C)
                      /   \\
                     /     \\
                   (A) --- (B)
Legende: Pass A -> B -> C -> Torschuss
`
  },
  {
    id: 'sd-main-3',
    title: 'Hütchen-Tore Slalom mit Sprint-Duell',
    phase: 'main',
    phaseLabel: 'Hauptteil (Schwerpunkt)',
    focus: 'Dribbling',
    originalUrl: 'https://www.soccerdrills.de/themen/dribbling/slalom-mit-wettkampfcharakter/',
    targetAge: 'F-Jugend (U9)',
    durationMinutes: 20,
    equipment: ['12 Hütchen', '16 Bälle', '4 Minitore'],
    organization: '4 parallele Parcours. An jedem Parcours stehen 4-5 Kinder, sodass sofort nachgerückt werden kann.',
    description: 'Im Slalom durch 3 Hütchentore dribbeln, danach Ball ins Minitor schieben und zum Start zurücksprinten. Wer erzielt in 3 Minuten die meisten Treffer?',
    coachingPoints: [
      'Beidfüßiges Dribbling (Außenseite & Innenseite abwechselnd)',
      'Enge Ballführung um die Hütchen, dann explosiver Antritt zum Tor',
      'Präzision vor Hektik'
    ],
    fieldAscii: `
(Start) (K)(K)
   |
   V
  [H]   [H]   (Tor 1)
     \\ /
     [H]      (Wende)
     / \\
  [H]   [H]   (Tor 2)
   |
   V
 [MINITOR]
`
  },
  {
    id: 'sd-main-4',
    title: 'Torschuss-Karussell: Drehen, Schießen, Jubeln',
    phase: 'main',
    phaseLabel: 'Hauptteil (Schwerpunkt)',
    focus: 'Torschuss',
    originalUrl: 'https://www.soccerdrills.de/themen/torschuss/torschuss-kinderfussball-spass/',
    targetAge: 'F-Jugend (U9)',
    durationMinutes: 20,
    equipment: ['2 Tore', '20 Bälle', 'Hütchen'],
    organization: '2 Tore mit je 8-10 Kindern. Bälle liegen rund um den Strafraum bereit.',
    description: 'Kind läuft auf Zuruf zum Ball, nimmt ihn mit einer flüssigen Drehbewegung mit und schließt sofort mit Vollspan oder Innenseite ab. Schneller Wechsel, maximale Schusswiederholungen pro Minute!',
    coachingPoints: [
      'Standbein fest neben den Ball setzen',
      'Körper über den Ball beugen, damit der Ball flach/mittelhoch bleibt',
      'Treffer sofort laut feiern – Spielfreude pur!'
    ],
    fieldAscii: `
           [ TOR ]
              ^
              | (Schuss)
             (K)
            /
        [Ball]
          ^
          | (Anlauf)
      (K1)(K2)(K3)
`
  },

  // --- SPIELFORMEN & FUNINO (30-60 Min, 30 Minuten Spiel) ---
  {
    id: 'sd-game-1',
    title: 'Funino 3 vs. 3 auf 4 Minitore mit Schusszone',
    phase: 'game',
    phaseLabel: 'Spielformen & Abschlussspiel (Funino)',
    focus: 'Spielform',
    originalUrl: 'https://www.soccerdrills.de/themen/minifussball-funino/funino-regeln-praxis/',
    targetAge: 'F-Jugend (U9)',
    durationMinutes: 30,
    equipment: ['4 Minitore pro Spielfeld (insgesamt 8 Minitore)', '2 Felder 25x20m', 'Leibchen'],
    organization: '2 Spielfelder für je 8-10 Kinder. Pro Feld spielen 3 gegen 3 mit 1-2 Rotationsspielern an der Seitenlinie. 6-Meter-Schusszone markiert.',
    description: 'Klassisches Funino nach DFB-Trainingsphilosophie Deutschland. Tore dürfen nur aus der 6m-Schusszone erzielt werden. Nach jedem Tor wechseln beide Teams einen Spieler ein. Keine festen Positionen, ständige Spielverlagerung!',
    coachingPoints: [
      'Kopf hoch: Welches der beiden gegnerischen Tore ist frei?',
      'Dreiecksbildung im Angriff für immer mindestens 2 Anspielstationen',
      'Schnelles Umschalten bei Ballverlust und Ballgewinn'
    ],
    fieldAscii: `
[Tor 1]                        [Tor 2]
+------------------------------------+
| - - - - - - Schusszone - - - - - - |
|                                    |
|      (Team A)       (Team B)       |
|                                    |
| - - - - - - Schusszone - - - - - - |
+------------------------------------+
[Tor 3]                        [Tor 4]
`
  },
  {
    id: 'sd-game-2',
    title: 'Funino Champions League (Auf- & Abstieg)',
    phase: 'game',
    phaseLabel: 'Spielformen & Abschlussspiel (Funino)',
    focus: 'Spielform',
    originalUrl: 'https://www.soccerdrills.de/themen/minifussball-funino/kaiserturnier-spielfelder/',
    targetAge: 'F-Jugend (U9)',
    durationMinutes: 30,
    equipment: ['8 Minitore', '2-3 Spielfelder', 'Leibchen in 4 Farben'],
    organization: 'Feld 1 (Champions League), Feld 2 (Bundesliga), evtl. Feld 3. Jedes Spiel dauert genau 5 Minuten.',
    description: 'Die Teams spielen 3 vs 3. Wer nach 5 Minuten führt, steigt ein Feld auf ("Richtung Champions League"). Das unterlegene Team steigt ein Feld ab. Bei Unentschieden entscheidet "Golden Goal" oder Schere-Stein-Papier.',
    coachingPoints: [
      'Gerechte Spielzeit: Automatische Einwechslung alle 90 Sekunden',
      'Selbstständige Regelführung der Kinder fördern (kein ständiger Schiri-Pfiff)',
      'Spannung und Motivation bis zur letzten Sekunde'
    ],
    fieldAscii: `
[Feld 1: Champions League] <=== Aufsteiger
        ^
        | (Auf- / Abstieg alle 5 Min)
        v
[Feld 2: Bundesliga]      <=== Absteiger
`
  }
];

// Helper functions for easy access
const soccerdrillsService = {
  getAll() {
    return soccerdrillsCatalog;
  },

  getByPhase(phase) {
    return soccerdrillsCatalog.filter(drill => drill.phase === phase);
  },

  getByFocus(focus) {
    if (!focus || focus === 'all') return soccerdrillsCatalog;
    return soccerdrillsCatalog.filter(drill => drill.focus.toLowerCase().includes(focus.toLowerCase()));
  },

  search(query) {
    if (!query) return soccerdrillsCatalog;
    const q = query.toLowerCase().trim();
    return soccerdrillsCatalog.filter(drill => 
      drill.title.toLowerCase().includes(q) ||
      drill.focus.toLowerCase().includes(q) ||
      drill.description.toLowerCase().includes(q) ||
      drill.coachingPoints.some(cp => cp.toLowerCase().includes(q))
    );
  }
};

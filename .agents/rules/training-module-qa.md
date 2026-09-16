# KickerCoach - Trainingsmodul Qualitätsrichtlinie & Automatisierte Tests

## Verbindlicher Qualitätsstandard für das Trainingsmodul

Wann immer in diesem Projekt Änderungen oder Anpassungen an folgenden Komponenten vorgenommen werden:
- `js/training.js`
- `js/ai-service.js`
- `js/pitch-renderer.js`
- `js/soccerdrills-catalog.js`
- `index.html` (im Bereich Trainingsplanung, Platz-Modus oder KI-Modal)
- `css/styles.css` (im Bereich Trainingsplanung, Taktiktafel oder Platz-Modus)

MUSS der Agent vor Abschluss der Aufgabe zwingend die automatisierte Testsuite ausführen:
```bash
python3 tests/test_training_module.py
```

### Die 10 Kern-Qualitätskriterien
1. **Inhalts-Dynamik:** Alle 4 Trainingsphasen müssen über alle Einheiten (1–8) variieren.
2. **Detailtiefe der Beschreibungen:** Jede Phase muss strukturierte, ausführliche Anleitungen (`1. Start`, `2. Ablauf`, `3. Spielregeln & Wertung`, `4. Rotation`) sowie klare Feld- und Materialmaße ohne Standzeiten enthalten.
3. **Grafische Passgenauigkeit:** Das 2D-Taktiktafel-Layout muss zwingend zur Übung passen (z. B. Hütchenwald, Slalomstangen, Jugendtor mit TW, Funino).
4. **Legenden-Synchronität:** Die Legende unter der Taktiktafel darf nur Elemente enthalten, die auch auf dem Feld platziert sind (keine Geister-Symbole) und muss originalgetreue Mini-SVGs nutzen.
5. **Schwerpunkt-Durchgängigkeit:** Vom Trainer gewählte Schwerpunkte (z. B. Torschuss, Passspiel, 1vs1, Dribbling) müssen sich in Phase 3 (Hauptteil), Phase 4 (Funino-Sonderregel) und der Taktiktafel widerspiegeln.
6. **Einheiten-Integrität:** Bei 1 Einheit darf genau 1 Einheit und kein verwirrender Wochen-Reiter gerendert werden. Bei 4 Wochen müssen alle 8 Einheiten vorhanden sein.
7. **Vereins-Code Sicherheit:** Das Code-Eingabefeld darf vor der Nutzereingabe niemals mit `kicker2026` oder einem anderen Code vorbelegt sein.
8. **Offline- & Fallback-Resilienz:** Bei Netzwerkfehlern oder leerer KI-Antwort muss `getAdaptedPlan` einen fehlerfreien, angepassten Plan ausliefern.
9. **DFB-Standzeiten-Check:** Mindestens 2–3 parallele Zonen/Stationen für 16–20 Kinder zur Vermeidung von Wartezeiten.
10. **Mobile Formatierung:** `white-space: pre-line` muss aktiv sein, damit Absätze und Nummerierungen am Smartphone lesbar bleiben.

### Verhaltensanweisung für den Agenten
- Schlägt auch nur ein einziger Test fehl, darf die Aufgabe **nicht** als erledigt gemeldet werden. Die Ursache muss sofort behoben werden.
- In der Abschlussmeldung an den Trainer muss das Testergebnis kurz dokumentiert werden.

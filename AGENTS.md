# KickerCoach - Entwicklungs- und Testrichtlinien

## Automatisierte Qualitätssicherung (QA) für das Trainingsmodul

Bei jeder Anpassung an `js/training.js`, `js/ai-service.js`, `js/pitch-renderer.js`, `index.html` oder Trainings-Styles muss vor dem Beenden der Aufgabe immer die Testsuite ausgeführt werden:

```bash
python3 tests/test_training_module.py
```

Alle 10 Tests müssen erfolgreich sein (`0 Fehler`), bevor Änderungen an den Trainer zurückgemeldet werden:
1. Inhalts-Dynamik (4 Phasen, 8 Einheiten)
2. Detailtiefe der Beschreibungen (1. Start, 2. Ablauf, 3. Regeln & Wertung, 4. Rotation)
3. Taktiktafel-Grafiken (24 dynamische Layouts)
4. Legenden-Synchronität (Symbol-Abgleich Spielfeld vs. Legende)
5. Trainerschwerpunkt-Durchgängigkeit (Schuss, Pass, 1v1, Dribbling)
6. Einheiten-Integrität (1 vs. 2 vs. 4 Wochen)
7. Vereins-Code Sicherheit (Nicht vorbelegt vor Eingabe)
8. Offline- & Fallback-Resilienz (getAdaptedPlan)
9. DFB-Standzeiten-Check (Parallele Stationen für 16–20 Kinder)
10. CSS & Responsive Formatierung (white-space: pre-line)

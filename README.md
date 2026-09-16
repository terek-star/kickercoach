# ⚽ KickerCoach – Die All-in-One Plattform für Kinderfußball-Trainer

> **Entwickelt für Trainer im Kinderfußball (Bambini, F-Jugend / U9, E-Jugend)** – abgestimmt auf die **DFB-Trainingsphilosophie Deutschland** und moderne Spielformen wie Funino.

KickerCoach ist eine moderne, blitzschnelle Web-App (Progressive Web App - PWA), die sowohl auf dem **Desktop** als auch direkt auf dem **Smartphone oder Tablet am Spielfeldrand** funktioniert – auch **ohne Internetverbindung (100% Offline-fähig)**.

---

## 🌟 Hauptmodule & Funktionen

### 1. 📋 Modul Trainingsplanung (DFB-konform)
* **DFB 4-Wochen-Masterplan (U9 / F-Jugend)**: 8 vollständige Einheiten à 60 Minuten (Mittwochs & Freitags) mit minimalen Standzeiten für 16–20 Kinder.
* **4-Phasen-Aufbau**:
  1. *00–05 Min:* Aufwärmen & Fangspiele
  2. *05–10 Min:* Koordination & Motorik (Reifen, Leitern, Stangen)
  3. *10–30 Min:* Hauptteil mit parallelen Übungszonen
  4. *30–60 Min:* Spielformen (Funino 3vs3 auf 4 Minitore mit Schusszone)
* **Interaktive 2D-Vektor-Taktiktafel (SVG)**: Gestochen scharfe Feldskizzen mit Minitoren, Hütchen, Bällen, Spielern und dynamischen Richtungspfeilen (Dribbling, Pass, Lauf, Schuss).
* **1-Klick-Umschalter**: Wechsel jederzeit zwischen 2D-Taktiktafel und ASCII-Diagramm.
* **soccerdrills.de Finder & Inspiration**: Kuratierter Katalog bewährter Übungen mit 1-Klick-Übernahme sowie KI-basierter Smart Link Ingestion (Verwandle Web-Links in 4-Phasen-Pläne).
* **Platz-Modus mit Phasen-Timer**: High-Contrast Vollbildmodus mit 60-Minuten-Countdown und akustischem Schiedsrichter-Pfeifsignal beim Phasenwechsel.

### 2. 🏆 Turnier- & Spielplan-Generator
* Automatische Spielplanerstellung für Kinderfestivals und Mini-Turniere.
* Unterstützung für Funino (3v3) und 5v5-Formate.
* Live-Erfassung von Toren und Fairplay-Ergebnissen.

### 3. 👕 Mannschaftsaufstellung & Rotations-Timer
* Automatische Teameinteilung (z.B. Team Gold & Team Silber) nach Stärke oder Zufall.
* Rotations-Timer mit optischem und akustischem Signal für gerechte Einsatzzeiten aller Kinder.

### 4. 📱 PWA & Offline-First
* Installierbar auf iPhone und Android ("Zum Home-Bildschirm").
* Speichert alle Daten lokal im Browser – kein Login-Zwang, keine Server-Kosten, höchste Datensicherheit.

---

## 🚀 Live-Nutzung & Installation auf dem Smartphone

1. Öffne KickerCoach in deinem mobilen Browser (z. B. Safari auf iOS oder Chrome auf Android).
2. Tippe auf **„Teilen“ (iOS)** bzw. das **Drei-Punkte-Menü (Android)**.
3. Wähle **„Zum Home-Bildschirm hinzufügen“**.
4. KickerCoach verhält sich ab sofort wie eine native App und funktioniert auch mitten auf dem Rasen ohne Mobilfunkempfang!

---

## 🛠️ Lokale Entwicklung

```bash
# Repository klonen
git clone https://github.com/<username>/kickercoach.git
cd kickercoach

# Lokalen HTTP-Server starten (z. B. mit Python)
python3 -m http.server 8080

# Im Browser öffnen
http://localhost:8080
```

---

## ⚡ Deployment auf Vercel (mit zentraler KI für alle Trainer)

KickerCoach kann mit einem Klick auf **Vercel** bereitgestellt werden. Über die integrierte Serverless Function (`api/generate-plan.js`) können Trainerkollegen mit dem einfachen **Trainer-Zugangscode** (`kicker2026`) echte KI-Trainingspläne erstellen – **ohne** eigenen Google-Account und ohne eigenen API-Key:

### 1-Klick-Setup auf Vercel:
1. Gehe auf [vercel.com](https://vercel.com) und melde dich mit deinem GitHub-Konto an.
2. Klicke auf **„Add New...“ $\rightarrow$ „Project“** und wähle das Repository **`terek-star/kickercoach`** aus.
3. Klappe vor dem Klick auf Deploy den Bereich **„Environment Variables“** auf und füge folgende zwei Variablen hinzu:
   * `GEMINI_API_KEY` : Dein Google Gemini API-Key (von [aistudio.google.com](https://aistudio.google.com/))
   * `TRAINER_ACCESS_CODE` : `kicker2026` *(oder dein individueller Vereinscode)*
4. Klicke auf **„Deploy“**.
5. Fertig! Deine App ist sofort live unter **`https://kickercoach.vercel.app`** (oder deiner Wunsch-Domain) mit SSL und automatischer CI/CD bei jedem Git-Push erreichbar!

---

## 💬 Feedback für Trainer
Hast du Ideen, Wünsche oder Übungsvorschläge für die Trainingspraxis?
Nutze einfach den **„Feedback“**-Button direkt in der App, um Rückmeldungen per E-Mail oder WhatsApp mitzuteilen!

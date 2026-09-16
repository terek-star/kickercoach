/**
 * ai-service.js
 * Google Gemini API Service für KickerCoach
 * 
 * Beinhaltet:
 * 1. API-Key-Verwaltung & Verbindungs-Prüfung
 * 2. KI-Trainingsplan-Generierung (DFB U9 4-Wochen-Plan & Einzeleinheiten)
 * 3. soccerdrills.de KI-Suche & Übungsvorschläge mit Links
 * 4. Smart Ingestion von externen Quellen (Links & Text)
 * 5. Vollwertiger Offline-Masterplan als Fallback & Sofort-Start
 */

const aiService = {
  storageKeys: {
    apiKey: 'kickercoach_gemini_api_key',
    model: 'kickercoach_gemini_model',
    apiVersion: 'kickercoach_gemini_api_version',
    trainerCode: 'kickercoach_trainer_code',
    backendUrl: 'kickercoach_backend_url',
    activeMode: 'kickercoach_ai_mode'
  },

  defaultModel: 'gemini-3.6-flash',
  cachedModels: [],

  getTrainerCode() {
    return localStorage.getItem(this.storageKeys.trainerCode) || '';
  },

  setTrainerCode(code) {
    if (code) {
      localStorage.setItem(this.storageKeys.trainerCode, code.trim());
      this.setActiveMode('code');
    } else {
      localStorage.removeItem(this.storageKeys.trainerCode);
      if (this.getActiveMode() === 'code') {
        localStorage.removeItem(this.storageKeys.activeMode);
      }
    }
  },

  hasTrainerCode() {
    const code = this.getTrainerCode();
    return Boolean(code && code.length >= 3);
  },

  getBackendUrl() {
    const custom = localStorage.getItem(this.storageKeys.backendUrl);
    if (custom) return custom.trim();
    if (window.location && window.location.hostname && window.location.hostname.includes('github.io')) {
      return 'https://kickercoach.vercel.app/api/generate-plan';
    }
    return '/api/generate-plan';
  },

  setBackendUrl(url) {
    if (url) {
      localStorage.setItem(this.storageKeys.backendUrl, url.trim());
    } else {
      localStorage.removeItem(this.storageKeys.backendUrl);
    }
  },

  getActiveMode() {
    const mode = localStorage.getItem(this.storageKeys.activeMode);
    if (mode) return mode;
    if (this.hasTrainerCode()) return 'code';
    if (this.hasApiKey()) return 'key';
    return 'none';
  },

  setActiveMode(mode) {
    localStorage.setItem(this.storageKeys.activeMode, mode);
  },

  hasActiveAccess() {
    return this.hasTrainerCode() || this.hasApiKey();
  },

  getApiKey() {
    return localStorage.getItem(this.storageKeys.apiKey) || '';
  },

  setApiKey(key, model = null, apiVersion = 'v1beta') {
    if (key) {
      localStorage.setItem(this.storageKeys.apiKey, key.trim());
      this.setActiveMode('key');
    } else {
      localStorage.removeItem(this.storageKeys.apiKey);
      if (this.getActiveMode() === 'key') {
        localStorage.removeItem(this.storageKeys.activeMode);
      }
    }
    if (model) {
      localStorage.setItem(this.storageKeys.model, model);
    }
    if (apiVersion) {
      localStorage.setItem(this.storageKeys.apiVersion, apiVersion);
    }
  },

  getModel() {
    const saved = localStorage.getItem(this.storageKeys.model);
    if (saved && (saved === 'gemini-2.0-flash' || saved.includes('2.0') || saved.includes('1.5'))) {
      localStorage.setItem(this.storageKeys.model, 'gemini-3.6-flash');
      return 'gemini-3.6-flash';
    }
    return saved || this.defaultModel;
  },

  getApiVersion() {
    return localStorage.getItem(this.storageKeys.apiVersion) || 'v1beta';
  },

  hasApiKey() {
    const key = this.getApiKey();
    return Boolean(key && key.length > 10);
  },

  /**
   * Prüft den Trainer-Zugangscode gegen das Backend
   */
  async verifyTrainerCode(code) {
    if (!code || code.trim().length < 3) {
      return { success: false, message: 'Bitte gib einen gültigen Zugangscode ein.' };
    }

    const trimmed = code.trim();
    const backendUrl = this.getBackendUrl();

    try {
      const res = await fetch(backendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify-code',
          trainerCode: trimmed
        })
      });

      if (res.ok) {
        const data = await res.json();
        this.setTrainerCode(trimmed);
        return {
          success: true,
          message: data.message || 'Zugangscode erfolgreich verifiziert! Vereins-KI ist aktiv.',
          backendConfigured: data.backendConfigured
        };
      }

      if (res.status === 401) {
        return {
          success: false,
          message: 'Ungültiger Zugangscode. Bitte prüfe die Eingabe (Standard: kicker2026).'
        };
      }

      const errData = await res.json().catch(() => ({}));
      return {
        success: false,
        message: errData.error || `Server antwortete mit Status ${res.status}`
      };
    } catch (netErr) {
      // Wenn der Server lokal (z.B. python http.server ohne Serverless-Runtime) nicht auf /api antwortet:
      if (trimmed.toLowerCase() === 'kicker2026') {
        this.setTrainerCode(trimmed);
        return {
          success: true,
          message: 'Zugangscode kicker2026 lokal als aktiv hinterlegt! (Serverseitige Ausführung erfolgt auf Vercel)',
          localMode: true
        };
      }
      return {
        success: false,
        message: `Verbindungsfehler zum Backend (${netErr.message}).`
      };
    }
  },

  /**
   * Bereinigt und parst JSON-Antworten von KI-Modellen sicher
   * Unterstützt Markdown-Fences, sanitisiert Newlines in Strings, korrigiert Trailing-Commas
   * und bietet automatische Fallback-Adaption
   */
  parseJsonSafe(rawText, fallbackParams = null) {
    if (!rawText || typeof rawText !== 'string') {
      if (fallbackParams) {
        return this.getAdaptedPlan(fallbackParams);
      }
      throw new Error('Leere Antwort vom KI-Modell erhalten.');
    }

    let text = rawText.trim();

    // 1. Wenn Markdown-Codeblöcke vorhanden sind, extrahiere den Inhalt
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenceMatch && fenceMatch[1]) {
      text = fenceMatch[1].trim();
    }

    // 2. Extrahiere äußerste geschweifte Klammern { ... }
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      text = text.substring(firstBrace, lastBrace + 1);
    }

    // 3. Häufige KI-Syntaxfehler bereinigen: Trailing commas vor schließenden Klammern
    text = text.replace(/,\s*([\]}])/g, '$1');

    // 4. Versuche, JSON direkt zu parsen
    try {
      return JSON.parse(text);
    } catch (e1) {
      // 5. Versuch mit Reparatur von nicht-escapten Zeilenumbrüchen innerhalb von String-Literalen
      try {
        const sanitized = text.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g, (match) => {
          return match.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
        });
        return JSON.parse(sanitized);
      } catch (e2) {
        console.warn('JSON-Parsing fehlgeschlagen:', e1.message, 'rawText:', rawText);
        if (fallbackParams) {
          console.info('Nutze adaptierten DFB-Plan als sicheren Fallback...');
          const fallback = this.getAdaptedPlan(fallbackParams);
          fallback.aiWarning = 'Die KI-Antwort enthielt Textformatierungen. Der Plan wurde automatisch an deine Kriterien angepasst.';
          return fallback;
        }
        throw new Error('Konnte kein valides JSON in der Antwort finden: ' + e1.message);
      }
    }
  },

  /**
   * Erstellt einen anpassbaren DFB-Entwicklungsplan (auch 100% offline einsatzbereit)
   * Berücksichtigt die gewählte Wochenanzahl (1, 2 oder 4) und den Trainer-Schwerpunkt!
   */
  getAdaptedPlan({ ageGroup = 'F-Jugend (U9)', weeksCount = 4, customFocus = '' } = {}) {
    const basePlan = this.getMasterPlan();
    const count = Math.min(Math.max(parseInt(weeksCount, 10) || 4, 1), 4);
    const targetUnitsCount = count === 1 ? 1 : count === 2 ? 4 : 8;
    
    // Klone die Einheiten und kürze auf die gewünschte Einheitenanzahl
    const units = JSON.parse(JSON.stringify(basePlan.units)).slice(0, targetUnitsCount);

    const isBambini = ageGroup.includes('Bambini') || ageGroup.includes('G-Jugend') || ageGroup.includes('U7');

    units.forEach((unit, idx) => {
      unit.id = `unit-${idx + 1}`;
      unit.unitNumber = idx + 1;
      unit.week = count === 1 ? 1 : Math.floor(idx / 2) + 1;
      
      if (count === 1) {
        unit.dateDisplay = `Trainingseinheit • Mittwoch (17:30 - 18:30)`;
      }

      if (isBambini) {
        unit.targetGroupSize = '12 bis 16 Kinder (Kleingruppen)';
        unit.equipment = ['Bälle Gr. 3 (Leichtball 290g)', 'Hütchen', '4 Minitore', 'Markierungshauben'];
        if (unit.phases[0]) {
          unit.phases[0].title = 'Fangspiel: Zauberer & Feen (Viel Bewegung)';
        }
        if (unit.phases[1]) {
          unit.phases[1].title = 'Bewegungsbaustelle: Zauberwald überqueren';
        }
      }

      if (customFocus && customFocus.trim()) {
        const focusText = customFocus.trim();
        const fLow = focusText.toLowerCase();
        unit.focusTheme = `${focusText} • ${isBambini ? 'Spielerisch & Kindgerecht' : 'DFB Schwerpunkt'}`;
        
        const mainPhase = unit.phases.find(p => p.name === 'Hauptteil');
        const gamePhase = unit.phases.find(p => p.name.includes('Spiel') || p.name.includes('Funino') || p.name.includes('Abschluss'));

        if (mainPhase) {
          if (fLow.includes('schuss') || fLow.includes('torschuss')) {
            mainPhase.title = isBambini ? 'Torschuss-Könige: Schießen auf Jugendtor & Minitore' : 'Torschuss & Schusstechnik: Stationen-Champions';
            mainPhase.organization = isBambini 
              ? 'Feld 20x15m mit 1 Jugendtor (inkl. rotierendem Torwart/Trainer) und 2 Minitoren an den Seiten. 2 parallele Gruppen à 6–8 Kinder. Pro Kind liegt ein Ball bereit, sodass niemand warten muss.'
              : 'Feld 25x20m mit 1 Jugendtor (mit TW) und 2 Kontertoren. 2 parallele Schussstationen (Station A: Schuss nach Zuspiel; Station B: Schuss nach Dribbling um Wendemarke). Maximal 2–3 Kinder pro Anstellpunkt für minimale Standzeiten.';
            mainPhase.drillRules = isBambini
              ? '1. Start: Jedes Kind dribbelt mit Ball auf ein Hütchentor zu.\n2. Ablauf: Nach dem Durchqueren des Hütchentors folgt der Torschuss mit Vollspann oder Innenseite auf das Jugendtor oder die Minitore.\n3. Wertung: Wer trifft, darf laut jubeln! Tore mit dem schwachen Fuß zählen 2 Punkte.\n4. Rotation: Ball sofort holen und auf die andere Station wechseln.'
              : '1. Start: Auf Trainer-Signal starten Station A und B gleichzeitig.\n2. Ablauf:\n- Station A: Spieler passt schräg zum Trainer/Mitspieler, erhält den Ball direkt in den Lauf und schließt mit max. 2 Kontakten mit dem Vollspann ab.\n- Station B: Spieler dribbelt mit Tempo um eine Wendemarke und zieht aus ca. 9m Torentfernung präzise in die Torecke ab.\n3. Regeln & Wertung: Standbein fest neben dem Ball, Fußspitze nach unten. Tore mit dem schwachen Fuß zählen doppelt.\n4. Rotation: Schütze holt seinen Ball und wechselt zur jeweils anderen Station.';
            mainPhase.fieldDiagram = `
     [ Jugendtor / TW ]
        \\        /
      (Schusszone)
       [H1]    [H2]
        |        |
       (A1)     (B1)
            `.trim();
            mainPhase.coachingPoints = [
              'Standbein eine Fußbreite neben den Ball setzen',
              'Fußspitze nach unten strecken, Ball mit dem Vollspann treffen',
              'Körper leicht über den Ball beugen (nicht nach hinten lehnen)',
              'Beide Füße einsetzen – Tore mit dem schwachen Fuß feiern!'
            ];
          } else if (fLow.includes('pass')) {
            mainPhase.title = isBambini ? 'Pass-Freunde: Zaubertore finden' : 'Passspiel & Erster Kontakt: Zauber-Dreiecke';
            mainPhase.organization = '3 parallele Dreiecks- oder Vierecksfelder (10x10m). 4–5 Kinder pro Feld mit 2 Bällen, damit ständiger Spielfluss ohne Wartezeiten herrscht.';
            mainPhase.drillRules = '1. Start: Spieler A passt flach mit der Innenseite zu Spieler B.\n2. Ablauf: Spieler B nimmt den Ball mit dem ersten Kontakt aktiv in die neue Spielrichtung zu Spieler C mit und passt mit dem 2. Kontakt direkt weiter.\n3. Regeln: Vor jedem Pass muss der Vorname des Mitspielers gerufen werden. Saubere Innenseite, Ball darf nicht springen.\n4. Rotation: Jeder Spieler läuft seinem gespielten Pass im leichten Trab hinterher und übernimmt die Position des Empfängers.';
            mainPhase.fieldDiagram = `
        (B)
       /   \\
     Pass  Pass
     /       \\
   (A)---Pass---(C)
            `.trim();
            mainPhase.coachingPoints = [
              'Innenseite öffnen und Ball fest in der Mitte treffen',
              'Ersten Kontakt aktiv in den freien Raum mitnehmen',
              'Kopf heben vor dem Abspiel'
            ];
          } else if (fLow.includes('1vs1') || fLow.includes('1-gegen-1') || fLow.includes('zweikampf')) {
            mainPhase.title = '1-gegen-1 Duell & Zweikampf auf Minitore';
            mainPhase.organization = '2 parallele Felder (16x12m) mit je 2 Minitoren. Angreifer (mit Bällen) und Verteidiger starten frontal gegenüber im Abstand von 10m.';
            mainPhase.drillRules = '1. Start: Angreifer dribbelt dynamisch an, Verteidiger rückt heraus und stellt den Angreifer.\n2. Ablauf: Der Angreifer setzt eine Körpertäuschung oder Finte ein und versucht auf eines der beiden Minitore abzuschließen.\n3. Regeln & Umschalten: Erobert der Verteidiger den Ball, darf er sofort auf die gegenüberliegenden Kontertore umschalten. Zeitlimit: maximal 10 Sekunden pro Duell!\n4. Rotation: Nach der Aktion tauschen Angreifer und Verteidiger die Seiten.';
            mainPhase.fieldDiagram = `
   [Tor 1]      [Tor 2]
      |            |
     (V) Verteidiger
            ^
            |
     (A) Angreifer
            `.trim();
            mainPhase.coachingPoints = [
              'Mit Tempo auf den Gegner zudribbeln',
              'Mutig ins 1-gegen-1 gehen – Fehler gehören zum Lernen dazu!',
              'Nach Ballverlust sofort umschalten und nachsetzen'
            ];
          } else if (fLow.includes('dribbel') || fLow.includes('ballführung')) {
            mainPhase.title = 'Tempodribbling & Hütchentor-Jagd';
            mainPhase.organization = 'Feld 22x20m mit 8–10 farbigen Hütchentoren im Raum verteilt. Jedes Kind hat einen eigenen Ball.';
            mainPhase.drillRules = '1. Start: Auf Pfiff starten alle Kinder gleichzeitig ins Feld.\n2. Ablauf: In 90 Sekunden so viele Hütchentore wie möglich durchdribbeln. Verschiedene Aufgaben: Runde 1 freies Dribbling, Runde 2 nur mit dem schwachen Fuß, Runde 3 mit Sohlenwende am Tor.\n3. Regeln: Kein Tor darf zweimal hintereinander genutzt werden (erfordert ständiges Kopfheben).\n4. Wertung: Wer sammelt die meisten Tore? Kurze Trinkpause zwischen den Durchgängen.';
            mainPhase.fieldDiagram = `
   [H1]    [H2]    [H3]
     o       o       o
   [H4]    [H5]    [H6]
            `.trim();
            mainPhase.coachingPoints = [
              'Ball eng am Fuß führen (mit jedem Schritt berühren)',
              'Kopf heben und freie Tore ansteuern',
              'Beide Füße aktiv nutzen'
            ];
          } else {
            mainPhase.title = `${focusText} (DFB Schwerpunkt-Stationen)`;
            mainPhase.organization = `Feld 25x20m in 2 parallele Zonen aufgeteilt für minimale Wartezeiten bei 16–20 Kindern. Ausreichend Bälle und Hütchen bereitstellen.`;
            mainPhase.drillRules = `1. Start: Stationen starten zeitgleich auf Signal des Trainers.\n2. Ablauf: Gezielte Übungsform mit direktem Trainingsschwerpunkt auf "${focusText}". Hohe Wiederholungszahl und mindestens 30 Ballkontakte pro Kind.\n3. Regeln: Klare Vorgaben zur Technik (Präzision vor Tempo). Erfolgserlebnisse gezielt loben.\n4. Rotation: Nach 8 Minuten wechseln die Gruppen die Stationen.`;
            mainPhase.coachingPoints = [
              `Trainerschwerpunkt: ${focusText}`,
              'Kopf heben und Überblick behalten',
              'Mutige Aktionen positiv verstärken'
            ];
          }
        }

        if (gamePhase) {
          if (fLow.includes('schuss')) {
            gamePhase.drillRules = '1. Aufbau: Funino 3 vs. 3 auf 4 Minitore mit 6m-Schusszone.\n2. Ablauf: Spiel nach Minifußball-Regeln ohne Torwart. Tore zählen nur, wenn der Abschluss innerhalb der Schusszone erfolgt.\n3. Schwerpunkt-Regel: Tore mit dem schwachen Fuß zählen doppelt! Nach jedem Treffer rotiert beim erfolgreichen Team 1 Kind aus.';
          } else if (fLow.includes('pass')) {
            gamePhase.drillRules = '1. Aufbau: Funino 3 vs. 3 auf 4 Minitore mit 6m-Schusszone.\n2. Ablauf: Schnelles Kombinationsspiel. Vor jedem gültigen Torabschluss müssen mindestens 2 direkte Pässe im Team gespielt werden.\n3. Bonus: Gelingt ein Tor nach einem Doppelpass, zählt der Treffer dreifach!';
          } else if (fLow.includes('1vs1') || fLow.includes('zweikampf')) {
            gamePhase.drillRules = '1. Aufbau: Funino 3 vs. 3 auf 4 Minitore.\n2. Ablauf: Minifußball mit Schwerpunkt auf mutige Zweikämpfe.\n3. Schwerpunkt-Regel: Überwindet ein Spieler einen Verteidiger im direkten 1-gegen-1 und erzielt danach ein Tor, zählt der Treffer doppelt (2 Punkte)!';
          }
        }
      }
    });

    const titleText = count === 1
      ? (customFocus ? `Trainingseinheit (${ageGroup}) • ${customFocus}` : `DFB-Trainingseinheit (${ageGroup})`)
      : (customFocus ? `${count}-Wochen-Plan (${ageGroup}) • ${customFocus}` : `${count}-Wochen DFB-Entwicklungsplan (${ageGroup})`);

    return {
      id: 'plan-adapted-' + Date.now(),
      title: titleText,
      subtitle: count === 1 ? `1 Einheit (60 Min) für ${ageGroup}` : `${count}-Wochen-Plan (${targetUnitsCount} Einheiten) für ${ageGroup}`,
      ageGroup,
      totalWeeks: count,
      unitsCount: targetUnitsCount,
      customFocus: customFocus || null,
      createdAt: new Date().toISOString(),
      isCustomAi: false,
      framework: basePlan.framework,
      units
    };
  },

  /**
   * Ruft alle verfügbaren Modelle für den übergebenen API-Key ab
   * (Nutzt ModelService.ListModels wie von der Google API empfohlen)
   */
  async fetchAvailableModels(apiKey = null) {
    const key = apiKey || this.getApiKey();
    if (!key) return [];

    const versions = ['v1beta', 'v1'];
    let lastError = null;

    for (const ver of versions) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/${ver}/models?key=${key}`);
        if (res.ok) {
          const data = await res.json();
          if (data.models && Array.isArray(data.models)) {
            const contentModels = data.models
              .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
              .map(m => {
                const id = m.name.replace(/^models\//, '');
                return {
                  id: id,
                  name: m.name,
                  displayName: m.displayName || id,
                  description: m.description || '',
                  apiVersion: ver
                };
              });

            if (contentModels.length > 0) {
              this.cachedModels = contentModels;
              return contentModels;
            }
          }
        } else {
          const errData = await res.json().catch(() => ({}));
          lastError = errData.error?.message || `HTTP ${res.status}`;
        }
      } catch (err) {
        lastError = err.message;
      }
    }

    if (lastError) {
      console.warn('Fehler beim Abrufen der Modelle:', lastError);
    }
    return [];
  },

  /**
   * Universeller Aufruf der KI:
   * 1. Falls Trainer-Zugangscode aktiv -> sicherer Aufruf via Vercel-Backend Proxy
   * 2. Falls eigener API-Key aktiv -> direkter Client-Side Aufruf an Google Gemini
   */
  async callGemini({ prompt, generationConfig = {}, preferredModel = null }) {
    const activeMode = this.getActiveMode();

    if (activeMode === 'code' || (this.hasTrainerCode() && !this.hasApiKey())) {
      return this.callBackendProxy({ prompt, generationConfig, preferredModel });
    }

    if (this.hasApiKey()) {
      return this.callDirectGemini({ prompt, generationConfig, preferredModel });
    }

    if (this.hasTrainerCode()) {
      return this.callBackendProxy({ prompt, generationConfig, preferredModel });
    }

    throw new Error('Weder Trainer-Zugangscode noch Google Gemini API-Key hinterlegt.');
  },

  /**
   * Ruft die Vercel Serverless Function als sicheren Proxy auf
   */
  async callBackendProxy({ prompt, generationConfig = {}, preferredModel = null }) {
    const code = this.getTrainerCode();
    if (!code) throw new Error('Kein Trainer-Zugangscode vorhanden.');

    const backendUrl = this.getBackendUrl();

    try {
      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Trainer-Code': code
        },
        body: JSON.stringify({
          prompt,
          generationConfig,
          trainerCode: code,
          model: preferredModel || this.getModel()
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const msg = errData.error || `Serverless Backend Fehler (HTTP ${response.status})`;

        // Automatischer Retry falls ein Modell als veraltet zurückgewiesen wurde
        if ((msg.includes('no longer available') || msg.includes('gemini-2.0-flash')) && preferredModel !== 'gemini-3.6-flash') {
          localStorage.setItem(this.storageKeys.model, 'gemini-3.6-flash');
          return this.callBackendProxy({ prompt, generationConfig, preferredModel: 'gemini-3.6-flash' });
        }

        throw new Error(msg);
      }

      const data = await response.json();
      if (data.text) {
        return data.text;
      }
      throw new Error('Unerwartetes Antwortformat vom Backend-Proxy.');
    } catch (err) {
      console.warn('Backend-Aufruf fehlgeschlagen:', err.message);
      throw err;
    }
  },

  /**
   * Direkter client-seitiger Aufruf von Google Gemini mit persönlichem API-Key
   */
  async callDirectGemini({ prompt, generationConfig = {}, preferredModel = null }) {
    const apiKey = this.getApiKey();
    if (!apiKey) throw new Error('Kein API-Key vorhanden');

    let currentModel = preferredModel || this.getModel();
    if (currentModel === 'gemini-2.0-flash' || currentModel.includes('2.0')) {
      currentModel = 'gemini-3.6-flash';
    }
    let currentVersion = this.getApiVersion();

    // Modell-Kandidaten zur Auswahl (startend mit dem aktiven Modell)
    const fallbackList = [
      currentModel,
      'gemini-3.6-flash',
      'gemini-2.5-flash',
      'gemini-1.5-flash-latest',
      'gemini-1.5-flash',
      'gemini-1.5-pro'
    ];

    // Falls wir gecachte Modelle haben, fügen wir diese hinzu
    if (this.cachedModels.length > 0) {
      this.cachedModels.forEach(m => {
        if (!fallbackList.includes(m.id)) {
          fallbackList.push(m.id);
        }
      });
    }

    // Entferne Duplikate
    const candidates = [...new Set(fallbackList.filter(Boolean))];
    let lastError = null;

    for (const candidate of candidates) {
      // Prüfe sowohl v1beta als auch v1
      for (const ver of [currentVersion, currentVersion === 'v1beta' ? 'v1' : 'v1beta']) {
        const endpoint = `https://generativelanguage.googleapis.com/${ver}/models/${candidate}:generateContent?key=${apiKey}`;
        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.7,
                ...generationConfig
              }
            })
          });

          if (response.ok) {
            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              // Speichere das funktionierende Modell & Version für zukünftige Aufrufe
              this.setApiKey(apiKey, candidate, ver);
              return text;
            }
          } else {
            const errData = await response.json().catch(() => ({}));
            lastError = errData.error?.message || `HTTP ${response.status}`;

            // Wenn responseMimeType von einem älteren Modell/Endpoint abgelehnt wird, ohne wiederholen
            if (response.status === 400 && generationConfig && generationConfig.responseMimeType && 
               (lastError.includes('response_mime_type') || lastError.includes('responseMimeType') || lastError.includes('generation_config'))) {
              const stripped = { ...generationConfig };
              delete stripped.responseMimeType;
              return this.callDirectGemini({ prompt, preferredModel: candidate, generationConfig: stripped });
            }

            // Bei ungültigem API-Key sofort abbrechen
            if (response.status === 400 && (lastError.includes('API_KEY') || lastError.includes('key not valid'))) {
              throw new Error(lastError);
            }
            // Bei 404, 503 (No capacity), 429 (Quota), 500 etc. nächstes Modell aus der Fallback-Liste testen
            continue;
          }
        } catch (netErr) {
          lastError = netErr.message;
        }
      }
    }

    throw new Error(lastError || 'Keines der Gemini-Modelle konnte erfolgreich angesprochen werden.');
  },

  /**
   * Testet die API-Verbindung mit dem hinterlegten Key
   */
  async testConnection(testKey = null) {
    const apiKey = testKey || this.getApiKey();
    if (!apiKey) {
      return { success: false, message: 'Kein API-Key hinterlegt.' };
    }

    // 1. Rufe alle verfügbaren Modelle für diesen Key ab
    const models = await this.fetchAvailableModels(apiKey);
    if (!models || models.length === 0) {
      // Versuche Fallback mit direktem Aufruf
      try {
        const text = await this.callGemini({
          prompt: 'Antworte kurz mit: "KickerCoach Online"',
          generationConfig: { maxOutputTokens: 20 },
          preferredModel: this.getModel()
        });
        return {
          success: true,
          message: 'Verbindung erfolgreich!',
          activeModel: this.getModel(),
          models: [],
          response: text.trim()
        };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    // 2. Wähle das beste Modell aus den verfügbaren Modellen
    const preferredOrder = [
      this.getModel(),
      'gemini-3.6-flash',
      'gemini-2.5-flash',
      'gemini-1.5-flash-latest',
      'gemini-1.5-flash',
      'gemini-1.5-pro'
    ];

    let chosenModel = null;
    for (const pref of preferredOrder) {
      const match = models.find(m => m.id === pref || m.id.includes(pref));
      if (match) {
        chosenModel = match;
        break;
      }
    }
    if (!chosenModel) {
      chosenModel = models[0];
    }

    // 3. Führe Testaufruf aus
    try {
      const endpoint = `https://generativelanguage.googleapis.com/${chosenModel.apiVersion}/models/${chosenModel.id}:generateContent?key=${apiKey}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Antworte kurz mit: "KickerCoach Gemini Online"' }] }],
          generationConfig: { maxOutputTokens: 20 }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { success: false, message: errorData.error?.message || `HTTP ${response.status}` };
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Speichern
      this.setApiKey(apiKey, chosenModel.id, chosenModel.apiVersion);

      return {
        success: true,
        message: `Verbindung erfolgreich! Verfügbares Modell: ${chosenModel.displayName || chosenModel.id}`,
        activeModel: chosenModel.id,
        models: models,
        response: text.trim()
      };
    } catch (err) {
      return { success: false, message: `Netzwerkfehler: ${err.message}` };
    }
  },

  /**
   * Generiert einen vollständigen Trainingsplan über Gemini API
   * oder nutzt den professionellen DFB-U9-Masterplan als Fallback.
   */
  async generateTrainingPlan(params = {}) {
    const {
      ageGroup = 'F-Jugend (U9)',
      weeksCount = 4,
      unitsPerWeek = 2,
      durationMinutes = 60,
      groupSize = '16 bis 20 Kinder',
      equipment = 'Bälle (Größe 3, mind. 1 Ball pro Kind), Markierungshütchen/Leibchen, Stangen, Reifen, Minihürden, 2 Jugendtore (5 vs. 5) sowie 4 Minitore',
      customFocus = ''
    } = params;

    // 1. Prüfen, ob ein Zugang vorhanden ist (Trainer-Code oder eigener API-Key)
    if (!this.hasActiveAccess()) {
      const err = new Error('Weder Trainer-Zugangscode noch Google Gemini API-Key hinterlegt.');
      err.code = 'NO_API_KEY';
      throw err;
    }

    const count = Math.min(Math.max(parseInt(weeksCount, 10) || 4, 1), 4);
    const isSingleUnit = count === 1;
    const totalUnits = isSingleUnit ? 1 : count === 2 ? 4 : 8;

    let ageGroupContext = 'DFB F-Jugend / U9 (ca. 7–8 Jahre alt)';
    let ageGuideline = 'Minifußball 3 vs. 3 auf 4 Minitore mit 6m-Schusszone, viele Ballkontakte, minimale Wartezeiten.';
    if (ageGroup.includes('Bambini') || ageGroup.includes('G-Jugend') || ageGroup.includes('U7')) {
      ageGroupContext = 'DFB G-Jugend / Bambini (U7, ca. 5–6 Jahre alt)';
      ageGuideline = 'Bambini-Spielewelt: Fantasievolle Bewegungsgeschichten (Zauberer, Tiere), Tummelspiele, 2v2 oder 3v3 auf 4 Minitore. Wichtig: Kinder haben noch keinen peripheren Blick; Ballführ- und Torschuss-Spiele im Vordergrund!';
    } else if (ageGroup.includes('E-Jugend') || ageGroup.includes('U11')) {
      ageGroupContext = 'DFB E-Jugend (U11, ca. 9–10 Jahre alt)';
      ageGuideline = 'Technik & Spielübersicht: Schnelles Umschalten, Passspiel, 1-gegen-1 offensiv/defensiv, Funino 4v4 oder Kleinfeld 5v5.';
    }

    const prompt = `
Du bist ein erfahrener und lizenzierter DFB-Kindertrainer.
Erstelle für den Bereich ${ageGroupContext} ${isSingleUnit ? 'genau 1 maßgeschneiderte Trainingseinheit (60 Minuten)' : `einen ${count}-Wochen-Trainingsplan mit insgesamt ${totalUnits} Einheiten (Mittwochs und Freitags, jeweils ${durationMinutes} Minuten)`}.

Altersgerechte Leitlinie des DFB:
${ageGuideline}
- Gruppengröße: ${groupSize} (Aufteilung in kleine parallele Stationen, damit kein Kind ansteht)
- Verfügbares Material: ${equipment}
${customFocus ? `- WICHTIGSTER TRAINER-SCHWERPUNKT: "${customFocus}".
  * Der Hauptteil (Phase 3) MUSS zwingend und detailliert diesen Schwerpunkt ("${customFocus}") als Übung behandeln! Wenn der Schwerpunkt z. B. "Schusstechnik" ist, beschreibe Schussstationen, Spannstoß und Torabschlüsse – KEIN Dribbling durch Hütchentore!
  * Titel, Organisation und Ablauf der 3. Phase müssen exakt zu "${customFocus}" passen.
  * Auch das Funino-Abschlussspiel (Phase 4) soll eine passende Sonderregel für "${customFocus}" haben (z. B. Tore mit schwachem Fuß zählen doppelt).` : ''}

WICHTIGE VORGABEN FÜR DETAILGRAD (FÜR DIE PRAXIS AM PLATZ):
- Ablauf ("drillRules") und Organisation ("organization") dürfen KEINESFALLS nur 1-2 kurze Sätze sein! Der Trainer muss sofort wissen, was genau zu tun ist.
- "organization": Exakte Feldmaße (z. B. 20x20m), Material-Positionierung, Stationen und Verteilung der 16–20 Kinder auf parallele Kleingruppen ohne Standzeiten.
- "drillRules": Konkreter, schrittweiser Ablauf:
  1. Start: Wie die Übung ausgelöst wird
  2. Ablauf: Genaue Bewegungen & Aktionen der Spieler (Laufwege, Pässe, Finten, Torabschlüsse)
  3. Spielregeln & Wertung: Zählweise, Bedingungen (z. B. schwacher Fuß doppelt, Zeitlimit)
  4. Rotation & Wechsel: Wie die Spieler Positionen/Stationen wechseln.

Zeitstruktur jeder 60-minütigen Einheit:
1. 00–05 Min.: Aufwärmen (Bewegungsspiel, Fangspiel oder spielerische Ballgewöhnung)
2. 05–10 Min.: Motorik & Koordination (altersgerechter Parcours mit Reifen/Stangen/Hütchen)
3. 10–30 Min.: Hauptteil mit klarem Schwerpunkt: ${customFocus || 'Altersgerechte Technik & Spielaktionen'} (Parallele Stationen, keine Wartezeiten)
4. 30–60 Min.: Spielformen & Abschlussspiel (Funino auf 4 Minitore mit Schusszone)

FORMAT-VORGABE:
Antworte AUSSCHLIESSLICH als valides JSON-Objekt ohne Erklärungen oder Begrüßung.
Schema:
{
  "title": "${isSingleUnit ? `Trainingseinheit (${ageGroup})` + (customFocus ? ' • ' + customFocus : '') : `${count}-Wochen-Plan (${ageGroup})` + (customFocus ? ' • ' + customFocus : '')}",
  "ageGroup": "${ageGroup}",
  "totalWeeks": ${count},
  "customFocus": "${customFocus || ''}",
  "units": [
    {
      "id": "unit-1",
      "week": 1,
      "unitNumber": 1,
      "dayOfWeek": "Mittwoch",
      "dateDisplay": "${isSingleUnit ? 'Trainingseinheit • Mittwoch (17:30 - 18:30)' : 'Woche 1 • Mittwoch (17:30 - 18:30)'}",
      "durationMinutes": 60,
      "focusTheme": "${customFocus ? customFocus + ' spielerisch vermitteln' : 'Ballgewöhnung & Spielfreude'}",
      "targetGroupSize": "${groupSize}",
      "equipment": ["Bälle Gr. 3", "Hütchen", "4 Minitore"],
      "phases": [
        {
          "name": "Aufwärmen",
          "durationMinutes": 5,
          "title": "Übungsname",
          "organization": "Feldmaße 20x20m, Verteilung der Hütchen und Aufteilung aller Kinder mit Ball für minimale Standzeiten.",
          "drillRules": "1. Start: Alle Kinder starten gleichzeitig.\\n2. Ablauf: Dribbling durch den Parcours mit Tempowechsel.\\n3. Regeln: Auf Farbrufe Sohlenstopp oder Richtungswechsel.\\n4. Wertung: Wer die wenigsten Kontakte mit Hütchen hat, gewinnt.",
          "fieldDiagram": "Kompakte Feldskizze (4 Zeilen ASCII)",
          "sourceUrl": "https://www.soccerdrills.de"
        },
        {
          "name": "Koordination & Motorik",
          "durationMinutes": 5,
          "title": "Übungsname",
          "organization": "2-3 parallele Parcours mit Reifen, Hürden und Sprintziel für je 5-6 Kinder.",
          "drillRules": "1. Start: Erstes Kind startet auf Pfiff, nächstes Kind folgt direkt.\\n2. Ablauf: Sprünge durch Reifen, Seitschritte über Hürden und Zielsprint.\\n3. Rotation: Lockerer Trab außen zurück zum Start.",
          "fieldDiagram": "",
          "sourceUrl": ""
        },
        {
          "name": "Hauptteil",
          "durationMinutes": 20,
          "title": "Übungsname",
          "organization": "2 parallele Spielfelder/Stationen (je 15x12m) für je 8-10 Kinder mit klaren Anstellpositionen.",
          "drillRules": "1. Start: Angreifer dribbelt an, Verteidiger startet diagonal.\\n2. Ablauf: Körpertäuschung und gezielter Torabschluss mit maximal 3 Kontakten.\\n3. Regeln & Wertung: Bei Ballgewinn direkter Umschaltkonter. Tore mit schwachem Fuß zählen doppelt.\\n4. Rotation: Rollentausch nach jeder Aktion.",
          "fieldDiagram": "Kompakte Feldskizze (4 Zeilen ASCII)",
          "sourceUrl": ""
        },
        {
          "name": "Spielformen & Abschlussspiel",
          "durationMinutes": 30,
          "title": "Funino auf 4 Minitore",
          "organization": "2 Spielfelder (22x18m) nebeneinander mit je 4 Minitoren und 6m-Schusszone. 3vs3 mit Rotationsspielern.",
          "drillRules": "1. Start: Anstoß an der Mittellinie nach hinten.\\n2. Ablauf: Minifußball ohne Torwart auf die jeweils freien Minitore.\\n3. Regeln & Wertung: Tore zählen nur aus der 6m-Schusszone. Nach jedem Torerfolg rotiert 1 Kind an der Mittellinie aus.",
          "fieldDiagram": "",
          "sourceUrl": ""
        }
      ],
      "coachingPoints": [
        "Kindgerechter Tipp 1",
        "Kindgerechter Tipp 2",
        "Kindgerechter Tipp 3"
      ]
    }
  ]
}
`.trim();

    try {
      const rawText = await this.callGemini({
        prompt: prompt,
        generationConfig: {
          responseMimeType: 'application/json',
          maxOutputTokens: 8192,
          temperature: 0.3
        }
      });

      const parsedPlan = this.parseJsonSafe(rawText, { ageGroup, weeksCount: count, customFocus });
      parsedPlan.id = 'plan-ai-' + Date.now();
      parsedPlan.createdAt = new Date().toISOString();
      parsedPlan.isCustomAi = true;
      
      // Einheitennummerierung und IDs vereinheitlichen
      if (parsedPlan.units && Array.isArray(parsedPlan.units)) {
        parsedPlan.units.forEach((u, idx) => {
          if (!u.id) u.id = `unit-${idx + 1}`;
          if (!u.week) u.week = isSingleUnit ? 1 : Math.floor(idx / 2) + 1;
          if (!u.unitNumber) u.unitNumber = idx + 1;
          if (!u.dateDisplay) {
            if (isSingleUnit) {
              u.dateDisplay = `Trainingseinheit • Mittwoch (17:30 - 18:30)`;
            } else {
              const day = idx % 2 === 0 ? 'Mittwoch' : 'Freitag';
              u.dateDisplay = `Woche ${u.week} • ${day} (17:30 - 18:30)`;
            }
          }
        });
      }

      return parsedPlan;
    } catch (apiErr) {
      console.warn('KI-Aufruf fehlgeschlagen. Aktiviere intelligenten DFB-Offline-Plan:', apiErr.message);
      // Wenn Netzwerkfehler oder Quota-Fehler: Sicherer adaptierter Plan
      const fallback = this.getAdaptedPlan({ ageGroup, weeksCount: count, customFocus });
      fallback.aiWarning = apiErr.message;
      return fallback;
    }
  },

  /**
   * Eigenständige Suche nach soccerdrills.de Übungen
   * Sucht sowohl im kuratierten Katalog als auch via Gemini mit echten Links!
   */
  async searchSoccerdrills(query, focus = 'all') {
    // 1. Lokale Treffer im Katalog
    let localMatches = soccerdrillsService.search(query);
    if (focus && focus !== 'all') {
      localMatches = localMatches.filter(d => d.focus.toLowerCase().includes(focus.toLowerCase()) || d.phase === focus);
    }

    // 2. Wenn Gemini Key oder Trainer-Code vorhanden, erweiterte KI-Suche nach echten soccerdrills Übungen
    if (this.hasActiveAccess() && query && query.length > 2) {
      try {
        const prompt = `
Du bist ein Experte für Fußballtraining im Kinderbereich und kennst die Plattform soccerdrills.de sehr gut.
Der Trainer sucht nach Übungen zum Thema: "${query}" (Fokus: ${focus}) für eine F-Jugend (U9).

Finde oder schlage 3 konkrete, passende Übungen vor, die sich an realen soccerdrills.de Übungsformen orientieren.
Gib für jede Übung eine passende soccerdrills.de URL an (z.B. https://www.soccerdrills.de/themen/... oder https://www.soccerdrills.de/themen/minifussball-funino/...) sowie Phase, Organisation, kindgerechte Coaching-Punkte und eine ASCII-Skizze.

Antworte NUR mit validem JSON in diesem Format:
{
  "drills": [
    {
      "id": "sd-ai-1",
      "title": "Titel der Übung",
      "originalUrl": "https://www.soccerdrills.de/themen/...",
      "phase": "main",
      "phaseLabel": "Hauptteil (Schwerpunkt)",
      "focus": "${focus !== 'all' ? focus : 'Dribbling'}",
      "durationMinutes": 20,
      "equipment": ["Bälle", "Hütchen", "4 Minitore"],
      "organization": "Feldaufbau für 16-20 Kinder mit minimalen Standzeiten",
      "description": "Detaillierte kindgerechte Erklärung",
      "coachingPoints": ["Coaching-Punkt 1", "Coaching-Punkt 2"],
      "fieldAscii": "+-------+\\n| (K)   |\\n+-------+"
    }
  ]
}
`;
        const rawText = await this.callGemini({
          prompt: prompt,
          generationConfig: { responseMimeType: 'application/json' }
        });

        const aiData = JSON.parse(rawText || '{}');
        if (aiData.drills && Array.isArray(aiData.drills)) {
          return [...localMatches, ...aiData.drills];
        }
      } catch (e) {
        console.warn('Gemini soccerdrills Suche nicht verfügbar:', e);
      }
    }

    return localMatches;
  },

  /**
   * Smart Ingestion: Extrahiert aus einem Link (soccerdrills, YouTube etc.)
   * oder freiem Text eine U9-gerechte Trainingseinheit oder Einzelübung.
   */
  async ingestExternalSource(sourceUrlOrText, targetPhase = 'main') {
    if (!sourceUrlOrText || sourceUrlOrText.trim().length < 5) {
      throw new Error('Bitte gib eine gültige URL oder einen aussagekräftigen Übungstext ein.');
    }

    const isUrl = sourceUrlOrText.startsWith('http://') || sourceUrlOrText.startsWith('https://');

    if (!this.hasActiveAccess()) {
      // Intelligenter Offline-Parser
      return {
        id: 'imported-' + Date.now(),
        title: isUrl ? 'Importierte Übung von ' + new URL(sourceUrlOrText).hostname : 'Angepasste Übungseinheit',
        originalUrl: isUrl ? sourceUrlOrText : 'https://www.soccerdrills.de',
        phase: targetPhase,
        phaseLabel: targetPhase === 'warmup' ? 'Aufwärmen' : targetPhase === 'main' ? 'Hauptteil' : 'Spielformen',
        focus: 'Dribbling & Spielintelligenz',
        durationMinutes: targetPhase === 'main' ? 20 : targetPhase === 'game' ? 30 : 5,
        equipment: ['16 Bälle', '12 Hütchen', '4 Minitore'],
        organization: 'Aufbau in 2-3 parallelen Feldern für 16 Kinder, sodass keine Wartezeiten entstehen.',
        description: isUrl 
          ? `Übungsidee aus externer Quelle (${sourceUrlOrText}). Angepasst für F-Jugend U9 mit Fokus auf ständige Ballkontakte und freie Spielentscheidungen.`
          : sourceUrlOrText,
        coachingPoints: [
          'Kopf vor der Ballannahme heben und freie Räume scannen',
          'Lob für mutige Aktionen und eigene Entscheidungen',
          'Beide Füße aktiv fordern'
        ],
        fieldAscii: `
+-----------------------------------+
|  [Tor]                     [Tor]  |
|         (K)        (K)            |
|              (Ball)               |
|         (K)        (K)            |
|  [Tor]                     [Tor]  |
+-----------------------------------+
`
      };
    }

    const prompt = `
Du bist ein erfahrener DFB-Jugendtrainer für die F-Jugend (U9, ca. 8 Jahre).
Ein Trainer möchte folgende externe Quelle / Übungsidee in seinen KickerCoach-Trainingsplan übernehmen:
"""
${sourceUrlOrText}
"""

Deine Aufgabe:
Analysiere die Quelle und adaptiere sie perfekt auf die Rahmenbedingungen:
- Zielgruppe: F-Jugend (U9, 8 Jahre) nach DFB Trainingsphilosophie Deutschland
- Gruppe: 16 bis 20 Kinder (absolut KEINE langen Schlangen oder Wartezeiten!)
- Phasen-Zuordnung: ${targetPhase}
- Erstelle 2-3 kindgerechte Coaching-Punkte
- Erstelle einen übersichtlichen ASCII-Feldaufbau

Antworte NUR mit validem JSON:
{
  "id": "ingested-${Date.now()}",
  "title": "Kompakter Titel der Übung",
  "originalUrl": "${isUrl ? sourceUrlOrText : 'https://www.soccerdrills.de'}",
  "phase": "${targetPhase}",
  "phaseLabel": "Phasenname",
  "focus": "Schwerpunkt (z.B. Dribbling, 1vs1, Passspiel, Torschuss)",
  "durationMinutes": ${targetPhase === 'main' ? 20 : targetPhase === 'game' ? 30 : 5},
  "equipment": ["Liste der Materialien"],
  "organization": "Exakter Aufbau für 16-20 Kinder mit parallelen Feldern/Stationen",
  "description": "Kindgerechte Regeln und Spielablauf",
  "coachingPoints": ["Coaching-Punkt 1", "Coaching-Punkt 2", "Coaching-Punkt 3"],
  "fieldAscii": "ASCII-Skizze mit Markierungen"
}
`;

    const rawText = await this.callGemini({
      prompt: prompt,
      generationConfig: { responseMimeType: 'application/json' }
    });

    return JSON.parse(rawText);
  },

  /**
   * Kompletter, sofort einsatzbereiter DFB-U9-Masterplan
   * 4 Wochen, 8 Einheiten, 100% konform zu den DFB-Vorgaben aus dem Prompt!
   */
  getMasterPlan(customFocus = '') {
    return {
      id: 'dfb-u9-masterplan',
      title: 'DFB 4-Wochen-Entwicklungsplan (F-Jugend / U9)',
      subtitle: 'Nach der neuen Trainingsphilosophie Deutschland (Minifußball & Funino)',
      ageGroup: 'F-Jugend (U9)',
      totalWeeks: 4,
      unitsCount: 8,
      createdAt: new Date().toISOString(),
      framework: {
        trainingTimes: 'Mittwochs & Freitags, jeweils 60 Minuten (17:30 – 18:30 Uhr)',
        groupSize: '16 bis 20 Kinder (Fokus: minimale Wartezeiten & max. Ballkontakte)',
        equipment: 'Bälle Gr. 3 (1 Ball pro Kind), Markierungshütchen, Stangen, Reifen, Minihürden, 2 Jugendtore, 4 Minitore'
      },
      units: [
        // ================= WOCHE 1: DRIBBLING & RICHTUNGSWECHSEL =================
        {
          id: 'w1-u1',
          week: 1,
          unitNumber: 1,
          dayOfWeek: 'Mittwoch',
          dateDisplay: 'Woche 1 • Mittwoch (17:30 - 18:30)',
          durationMinutes: 60,
          focusTheme: 'Dribbling: Enge Ballführung & Kopfheben',
          targetGroupSize: '16 bis 20 Kinder',
          equipment: ['20 Bälle Gr. 3', '24 Hütchen (3 Farben)', '8 Minitore'],
          phases: [
            {
              name: 'Aufwärmen',
              durationMinutes: 5,
              title: 'Hütchenkönig im Zauberwald',
              organization: 'Feld 20x20m mit Begrenzungshütchen abstecken. Jedes Kind hat einen eigenen Ball. Im Feld stehen 20–24 bunte Markierungshütchen (rot, gelb, blau) kreuz und quer als "Bäume im Zauberwald". Alle Kinder bewegen sich gleichzeitig im Feld, keine Standzeiten.',
              drillRules: '1. Start: Alle Kinder dribbeln auf Pfiff gleichzeitig mit vielen kleinen Ballkontakten frei durch den Wald.\n2. Ablauf: Den Hütchen und anderen Kindern geschickt ausweichen. Der Trainer ruft in unregelmäßigen Abständen Farb-Kommandos:\n- "Rot": Ball sofort mit der Sohle stoppen und 3x mit dem anderen Fuß antippen.\n- "Gelb": Um das nächste gelbe Hütchen einen engen Kreis mit dem Außenrist ziehen.\n- "Blau": Sofortiger Richtungswechsel um 180 Grad mit Tempobeschleunigung.\n3. Wertung: Wer die gesamte Spielzeit durchhält, ohne einen Baum oder ein Mitspieler-Kind zu berühren, wird zum "Zauberwald-König" gekürt!',
              coachingPoints: ['Kopf immer wieder heben', 'Beide Füße abwechselnd nutzen', 'Sanfte, kontrollierte Ballkontakte'],
              sourceUrl: 'https://www.soccerdrills.de/themen/dribbling/kinderfussball-hütchenwald/',
              fieldDiagram: `
+------------------------------------+
|  [H]         (K)       [H]    (K)  |
|        (K)          (K)            |
|   [H]       [H]          [H]       |
|        (K)       (K)          (K)  |
|  [H]         [H]        (K)   [H]  |
+------------------------------------+
`
            },
            {
              name: 'Koordination & Motorik',
              durationMinutes: 5,
              title: 'Dschungelpfad: Reifen & Minihürden',
              organization: '2 parallele Parcours nebeneinander (Abstand 5m) für je 8–10 Kinder. Jede Bahn besteht aus: 4 Koordinationsreifen in Reihe, 3 Minihürden (Höhe ca. 15-20cm) und einer Sprintziellinie in 8m Entfernung. Bälle liegen am Ziel bereit.',
              drillRules: '1. Start: Das erste Kind startet auf Signal des Trainers. Das nächste Kind läuft los, sobald der Vordermann die Reifen verlässt (minimale Wartezeit!).\n2. Ablauf:\n- Reifen: Beidbeinige, rhythmische Prellsprünge von Reifen zu Reifen auf den Fußballen.\n- Minihürden: Schneller Seitschritt (Skipping mit Kniehub) ohne die Hürden zu berühren.\n- Zielantritt: Nach der letzten Hürde dynamischer 5m-Sprint zum Ball, Ball mit der Sohle stoppen.\n3. Rotation: Im lockeren Trab außen zurück zum Start anstellen. Im 2. Durchgang: Einbeinsprünge (rechts/links im Wechsel).',
              coachingPoints: ['Auf den Fußballen federn', 'Arme aktiv als Schwung- und Balanceelement mitnehmen'],
              sourceUrl: 'https://www.soccerdrills.de/themen/koordination/kinder-bewegungslandschaften/',
              fieldDiagram: `
Station 1: (K)(K) --> O O O O --> /\\ /\\ /\\ --> [Ziel]
Station 2: (K)(K) --> O O O O --> /\\ /\\ /\\ --> [Ziel]
`
            },
            {
              name: 'Hauptteil',
              durationMinutes: 20,
              title: 'Hütchentor-Jagd mit Zeitlimit',
              organization: 'Feld 25x20m. Im Feld verteilt stehen 10 Hütchentore (Breite jeweils 1,5m, farblich markiert). 16–20 Kinder werden in 2 Gruppen (Team Gelb und Team Blau) eingeteilt. Jedes Kind hat einen eigenen Ball.',
              drillRules: '1. Start: Beide Teams starten auf Pfiff gleichzeitig von den Außenlinien ins Feld.\n2. Ablauf: Jedes Kind versucht, innerhalb von 90 Sekunden so viele verschiedene Hütchentore wie möglich zu durchdribbeln. Jedes durchquerte Tor muss laut mitgezählt werden.\n3. Spielregeln & Wertung:\n- Ein Tor darf nicht zweimal hintereinander durchdribbelt werden (steter Wechsel erfordert Kopfheben & Vororientierung!).\n- Begegnen sich zwei Kinder an einem Tor, muss ausgewichen werden.\n- Nach 90 Sekunden werden die Punkte im Team addiert. Runde 2: Durchdribbeln nur mit dem schwachen Fuß (Tore zählen doppelt!).\n4. Rotation: Kurze 30-Sekunden Trinkpause und Auswertung zwischen den Runden.',
              coachingPoints: ['Vor dem Tordurchbruch Blickkontakt prüfen', 'Enge Ballführung vor dem Tor, Beschleunigung danach'],
              sourceUrl: 'https://www.soccerdrills.de/themen/dribbling/slalom-mit-wettkampfcharakter/',
              fieldDiagram: `
+------------------------------------+
|  [H-H]        (K)          [H-H]   |
|         [H-H]                      |
|  (K)             (K)        (K)    |
|         [H-H]          [H-H]       |
+------------------------------------+
`
            },
            {
              name: 'Spielformen & Abschlussspiel',
              durationMinutes: 30,
              title: 'Funino 3 vs. 3 auf 4 Minitore mit Schusszone',
              organization: '2 parallele Spielfelder (je 22x18m) nebeneinander. Jedes Feld hat 4 Minitore (2 pro Grundlinie mit je 10m Abstand zueinander) und eine markierte 6m-Schusszone vor jeder Grundlinie. Gespielt wird 3vs3, 1-2 Wechselspieler pro Team stehen an der Mittellinie bereit.',
              drillRules: '1. Start: Anstoß an der Mittellinie durch Pass nach hinten. Kein Torwart, alle Kinder sind Feldspieler.\n2. Spielregeln:\n- Ein Tor zählt nur, wenn der Torschuss innerhalb der 6m-Schusszone abgegeben wird.\n- Geht der Ball ins Aus (Seitenlinie): Einpassen oder Eindribbeln (kein Einwurf).\n- Nach jedem Torerfolg rotiert beim erfolgreichen Team sofort 1 Spieler an der Mittellinie gegen den Wechselspieler aus.\n3. Wertung: Spiele dauern 6 Minuten. Welches Team erzielt die meisten Treffer über die freien Außentore?',
              coachingPoints: ['Kopf hoch: Welches Minitor ist frei?', 'Verteidiger nach Ballverlust sofort hinter den Ball'],
              sourceUrl: 'https://www.soccerdrills.de/themen/minifussball-funino/funino-regeln-praxis/',
              fieldDiagram: `
[Tor 1]                                [Tor 2]
+--------------------------------------------+
| - - - - - - - - Schusszone - - - - - - - - |
|                                            |
|          (Team A)         (Team B)         |
|                                            |
| - - - - - - - - Schusszone - - - - - - - - |
+--------------------------------------------+
[Tor 3]                                [Tor 4]
`
            }
          ],
          coachingPoints: [
            'Blick vom Ball lösen: Trainer zeigt gelegentlich Fingerzahlen zur visuellen Kontrolle',
            'Tempo dosieren: Nicht bolzen, sondern den Ball wie einen Magneten am Fuß führen',
            'Mut belohnen: Jeder gelungene Richtungswechsel wird lautstark gefeiert'
          ]
        },
        {
          id: 'w1-u2',
          week: 1,
          unitNumber: 2,
          dayOfWeek: 'Freitag',
          dateDisplay: 'Woche 1 • Freitag (17:30 - 18:30)',
          durationMinutes: 60,
          focusTheme: 'Dribbling mit Finten & Richtungswechsel',
          targetGroupSize: '16 bis 20 Kinder',
          equipment: ['20 Bälle Gr. 3', '16 Hütchen', '4 Minitore', '2 Jugendtore'],
          phases: [
            {
              name: 'Aufwärmen',
              durationMinutes: 5,
              title: 'Fuchs und Hasen (Fangspiel mit Ball)',
              organization: 'Feld 20x20m klar mit Hütchen markiert. 14–16 "Hasen" haben jeweils einen Ball. 2 "Füchse" tragen rote Leibchen und starten ohne Ball in der Mitte des Feldes.',
              drillRules: '1. Start: Auf Pfiff jagen die Füchse los. Die Hasen dribbeln frei im Feld und schützen ihren Ball.\n2. Ablauf & Regeln: Die Füchse versuchen, den Ball eines Hasen ins Seitenaus zu spitzeln. Gelingt dies, muss der Hase seinen Ball holen, 3 Kniebeugen oder Hampelmänner am Rand machen und darf dann wieder als Hase mit Ball mitspielen.\n3. Rollenwechsel: Nach jeweils 90 Sekunden bestimmt der Trainer 2 neue Füchse. Welcher Fuchs spitzelt die meisten Bälle weg?',
              coachingPoints: ['Ball abschirmen (Körper zwischen Fuchs und Ball)', 'Schneller Antritt bei Annäherung'],
              sourceUrl: 'https://www.soccerdrills.de/themen/aufwaermen/fangspiele-kinderfussball/',
              fieldDiagram: `
+------------------------------------+
|  (Hase)       (Fuchs)      (Hase)  |
|         (Hase)                     |
|  (Hase)             (Fuchs)(Hase)  |
+------------------------------------+
`
            },
            {
              name: 'Koordination & Motorik',
              durationMinutes: 5,
              title: 'Slalomstangen & Stopp-and-Go',
              organization: '4 parallele Bahnen à 4–5 Kinder, um Standzeiten komplett zu vermeiden. Jede Bahn hat 4 Slalomstangen im Abstand von 1,5m und eine Abschlussmarkierung in 5m Entfernung.',
              drillRules: '1. Start: Erstes Kind jeder Bahn startet auf Trainerkommando.\n2. Ablauf:\n- Slalom: Schnelle, kurze Trippelschritte vorwärts durch die ersten beiden Stangen, anschließender Rückwärts-Slalom durch Stange 3 und 4.\n- Stopp-and-Go: An der letzten Stange abstoppen, tiefer Körperschwerpunkt, und auf Klatschen des Trainers explosionsartiger Sprint zur 5m-Markierung.\n3. Rotation: Nach Durchlauf locker außen zurückgehen und hinten anstellen. 4 Durchgänge pro Kind.',
              coachingPoints: ['Geringer Körperschwerpunkt', 'Schnelle Trippelschritte'],
              sourceUrl: 'https://www.soccerdrills.de/themen/koordination/kinder-bewegungslandschaften/',
              fieldDiagram: `
Bahn 1: (K)(K) --> |  |  |  |  --> [Ball]
Bahn 2: (K)(K) --> |  |  |  |  --> [Ball]
`
            },
            {
              name: 'Hauptteil',
              durationMinutes: 20,
              title: '1-gg-1 Dribbelduell auf 2 Kontertore',
              organization: '2 parallele Spielfelder (15x12m) mit je 2 Minitoren an den Stirnseiten. Je Feld 8–10 Kinder. Angreifer stehen an Startposition A (mit Ball), Verteidiger an Position B (ohne Ball) diagonal versetzt.',
              drillRules: '1. Start: Angreifer dribbelt dynamisch auf die Mitte zu. Gleichzeitig startet der Verteidiger und stellt den Angreifer.\n2. Ablauf: Der Angreifer wendet eine Finte an (z. B. Übersteiger, Ausfallschritt oder Körpertäuschung) und versucht auf eines der beiden Minitore abzuschließen.\n3. Regeln & Umschaltmoment: Erobert der Verteidiger den Ball, darf er sofort auf die beiden gegenüberliegenden Minitore kontern. Zeitlimit pro Duell: maximal 10 Sekunden (hohes Tempo!).\n4. Rotation: Angreifer wird nach der Aktion zum Verteidiger, Verteidiger holt den Ball und stellt sich bei den Angreifern an.',
              coachingPoints: ['Klare Körpertäuschung vor dem Verteidiger', 'Nach der Finte sofort Tempo anziehen'],
              sourceUrl: 'https://www.soccerdrills.de/themen/1-gegen-1/1-gegen-1-frontal-minitore/',
              fieldDiagram: `
[Tor 1]                                [Tor 2]
+--------------------------------------------+
|                     (V)                    |
|                      ^                     |
|                      |                     |
|                     (A) [Ball]             |
+--------------------------------------------+
`
            },
            {
              name: 'Spielformen & Abschlussspiel',
              durationMinutes: 30,
              title: 'Kaiserturnier Funino (Auf- und Abstieg)',
              organization: '3 Felder nebeneinander aufgeteilt: Feld 1 (Champions/Gold), Feld 2 (Herausforderer/Silber), Feld 3 (Aufsteiger/Bronze). Jedes Feld mit 4 Minitoren. Gespielt wird 3vs3 (4 Teams à 4-5 Kinder mit Rotation).',
              drillRules: '1. Start: Alle 3 Spiele starten und enden zeitgleich auf den zentralen Trainerpfiff.\n2. Spielzeit & Wertung: 4 Minuten Spielzeit pro Runde. Nach Abpfiff ermitteln die Teams den Sieger.\n3. Auf- und Abstieg:\n- Gewinner auf Feld 2 steigt auf Feld 1 auf. Verlierer auf Feld 1 steigt auf Feld 2 ab.\n- Gewinner auf Feld 3 steigt auf Feld 2 auf. Verlierer auf Feld 2 steigt auf Feld 3 ab.\n- Bei Unentschieden entscheidet ein "Golden Goal" oder Schere-Stein-Papier der Kapitäne.',
              coachingPoints: ['Selbstständiges Zählen der Tore', 'Faires Abklatschen nach Abpfiff'],
              sourceUrl: 'https://www.soccerdrills.de/themen/minifussball-funino/kaiserturnier-spielfelder/',
              fieldDiagram: `
[ Feld 1: Gold ] <--- Aufstieg aus Feld 2
[ Feld 2: Silber ]
[ Feld 3: Bronze ] ---> Abstieg aus Feld 2
`
            }
          ],
          coachingPoints: [
            'Kinder ermutigen, Finten im Spiel mutig auszuprobieren',
            'Keine Kritik bei Ballverlust in der 1-gg-1 Situation',
            'Wechselintervalle strikt alle 90 Sekunden einhalten'
          ]
        },

        // ================= WOCHE 2: PASSSPIEL & ERSTER KONTAKT =================
        {
          id: 'w2-u3',
          week: 2,
          unitNumber: 3,
          dayOfWeek: 'Mittwoch',
          dateDisplay: 'Woche 2 • Mittwoch (17:30 - 18:30)',
          durationMinutes: 60,
          focusTheme: 'Passspiel: Innenseite & Vororientierung',
          targetGroupSize: '16 bis 20 Kinder',
          equipment: ['20 Bälle Gr. 3', '20 Hütchen', '4 Minitore', 'Leibchen in 2 Farben'],
          phases: [
            {
              name: 'Aufwärmen',
              durationMinutes: 5,
              title: 'Chaos-Passen im Quadrat',
              organization: 'Feld 20x20m mit Hütchen markieren. Alle 16–20 Kinder bewegen sich frei im Quadrat. 8 bis 10 Bälle sind im Spiel (1 Ball pro 2 Kinder), sodass alle Kinder ständig in Bewegung und konzentriert sind.',
              drillRules: '1. Start: Kinder ohne Ball bieten sich aktiv in den freien Räumen an. Kinder mit Ball dribbeln mit erhobenem Kopf.\n2. Ablauf: Vor jedem Pass muss der Passgeber laut den Vornamen des Passempfängers rufen und Blickkontakt aufnehmen. Der Pass erfolgt sauber mit der Innenseite flach über den Rasen.\n3. Regeln: Kein direkter Rückpass zum Passgeber. Bälle dürfen sich im Feld nicht kreuzen oder berühren. Nach 2 Minuten Steigerung: Pass nur mit dem schwachen Fuß!\n4. Wertung: Schafft die Gruppe 30 Pässe in Folge ohne Zusammenstoß?',
              coachingPoints: ['Blickkontakt vor dem Pass!', 'Namen des Mitspielers rufen', 'Sauber mit der Innenseite passen'],
              sourceUrl: 'https://www.soccerdrills.de/themen/passspiel/dreiecksspiel-direktpass/',
              fieldDiagram: `
+------------------------------------+
|  (K) ----> (K)          (K)        |
|        (K)          (K) <--- (K)   |
|  (K) ----> (K)          (K)        |
+------------------------------------+
`
            },
            {
              name: 'Koordination & Motorik',
              durationMinutes: 5,
              title: 'Reaktionssprint nach Partnerpass',
              organization: 'Paarweise Aufstellung: Je 2 Kinder stehen sich im Abstand von 6 Metern gegenüber (insgesamt 8–10 Paare nebeneinander). Hinter jedem Kind steht ein Hütchentor in 4m Entfernung.',
              drillRules: '1. Start: Kind A spielt einen präzisen Innenseitpass zu Kind B.\n2. Ablauf: Sobald der Pass den Fuß verlässt, sprintet Kind A blitzschnell vorwärts um Kind B herum und rückwärts wieder auf seine eigene Startposition.\n3. Ballannahme: Kind B nimmt den Ball mit dem ersten Kontakt aktiv seitlich mit, kontrolliert ihn und spielt den Pass zurück, sobald A wieder steht.\n4. Rotation & Wechsel: Nach 6 Wiederholungen tauschen die Kinder die Rollen.',
              coachingPoints: ['Schneller erster Schritt', 'Körper vorwärts geneigt', 'Saubere Ballmitnahme'],
              sourceUrl: 'https://www.soccerdrills.de/themen/schnelligkeit/reaktionssprints-jugend/',
              fieldDiagram: `
(A) ----(Pass)----> (B)
 ^                   |
 +---(Umlaufen)------+
`
            },
            {
              name: 'Hauptteil',
              durationMinutes: 20,
              title: 'Pass-Dreieck mit Erstem Kontakt nach vorne',
              organization: '3 bis 4 parallele Dreiecksstationen (Hütchendreieck mit 8–10m Seitenlänge). 4–5 Kinder pro Dreieck mit den Positionen A, B und C. Bälle liegen bei Position A bereit.',
              drillRules: '1. Start: Spieler A passt druckvoll mit der rechten Innenseite zu Spieler B.\n2. Ablauf: Spieler B nimmt den Ball in einer offenen Körperstellung mit der linken Innenseite aktiv mit und passt mit dem 2. Kontakt direkt zu Spieler C.\n- Spieler C nimmt den Ball ebenfalls aktiv nach vorne mit, dribbelt im Tempo zur Startposition A und übergibt den Ball an den nächsten Spieler.\n3. Rotation: Jeder Spieler läuft seinem gespielten Pass im lockeren Trab hinterher (A geht zu B, B geht zu C, C geht zu A).\n4. Steigerung: Nach 8 Minuten Wechsel der Passrichtung über die andere Seite.',
              coachingPoints: ['Offene Spielstellung: beide Mitspieler im Blick', 'Erster Kontakt aktiv in die neue Spielrichtung', 'Gewicht auf den Vorderfuß'],
              sourceUrl: 'https://www.soccerdrills.de/themen/passspiel/dreiecksspiel-direktpass/',
              fieldDiagram: `
               (C)
              /   \\
             /     \\
           (A) ---> (B)
`
            },
            {
              name: 'Spielformen & Abschlussspiel',
              durationMinutes: 30,
              title: 'Funino mit Pass-Vorgabe (Bonuspunkt nach Doppelpass)',
              organization: '2 Funino-Felder (je 22x18m) mit 4 Minitoren und 6m-Schusszone. 3 vs. 3 plus je 1 Rotationsspieler pro Team.',
              drillRules: '1. Start: Anstoß an der Mittellinie nach hinten. Gespielt wird Minifußball ohne Torwart.\n2. Spielregeln: Tore zählen nur, wenn der Torschuss innerhalb der 6m-Schusszone abgegeben wird.\n3. Bonus-Regel: Gelingt einem Team unmittelbar vor dem Torerfolg ein direkter Doppelpass (Wandpass), zählt der Treffer dreifach (3 Punkte)!\n4. Rotation: Nach jedem Torabschluss rotiert beim erfolgreichen Team 1 Kind an der Mittellinie aus.',
              coachingPoints: ['Geduld beim Spielaufbau', 'Gemeinsam angreifen, gemeinsam verteidigen', 'Dreiecke auf dem Spielfeld bilden'],
              sourceUrl: 'https://www.soccerdrills.de/themen/minifussball-funino/funino-regeln-praxis/',
              fieldDiagram: `
[Tor 1]                        [Tor 2]
+------------------------------------+
|                                    |
|      (Team A)       (Team B)       |
|                                    |
+------------------------------------+
[Tor 3]                        [Tor 4]
`
            }
          ],
          coachingPoints: [
            'Saubere Innenseite schulen: Fußspitze leicht nach außen drehen, Fußgelenk fixieren',
            'Ruhiger erster Kontakt ist wichtiger als überhastetes Tempo',
            'Jeden Mitspieler mit Namen ansprechen'
          ]
        },
        {
          id: 'w2-u4',
          week: 2,
          unitNumber: 4,
          dayOfWeek: 'Freitag',
          dateDisplay: 'Woche 2 • Freitag (17:30 - 18:30)',
          durationMinutes: 60,
          focusTheme: 'Passspiel & Spielverlagerung im Minifußball',
          targetGroupSize: '16 bis 20 Kinder',
          equipment: ['20 Bälle Gr. 3', '8 Minitore', 'Hütchen', 'Leibchen'],
          phases: [
            {
              name: 'Aufwärmen',
              durationMinutes: 5,
              title: 'Farben-Passspiel mit Kommando',
              organization: 'Feld 20x20m. An den 4 Ecken steht je ein andersfarbiges Hütchen (Rot, Gelb, Blau, Grün). 2 Gruppen à 8–10 Kinder mit je 3 Bällen im Feld.',
              drillRules: '1. Start: Freies Passspiel in der Gruppe innerhalb des Feldes (Blickkontakt & Rufen).\n2. Kommando & Ablauf: Der Trainer ruft plötzlich eine Farbe (z. B. "BLAU!"). Das Kind, das den Ball im Moment des Rufs hat oder gerade angespielt wird, muss den Ball mit maximal 2 Kontakten zur entsprechenden Farbecke passen.\n3. Sprint: Alle anderen Kinder sprinten sofort in die gegenüberliegende Ecke.\n4. Wertung: Welches Team schafft 5 fehlerfreie Zielpässe am schnellsten?',
              coachingPoints: ['Präzises Passen auf den richtigen Fuß', 'Vororientierung im Raum'],
              sourceUrl: 'https://www.soccerdrills.de/themen/passspiel/dreiecksspiel-direktpass/',
              fieldDiagram: `
  [Rot]       [Blau]
      (K)---(K)
      (K)   (K)
  [Gelb]      [Grün]
`
            },
            {
              name: 'Koordination & Motorik',
              durationMinutes: 5,
              title: 'Häschenhüpf & Stangen-Pendel',
              organization: '3 parallele Bahnen nebeneinander: Je Bahn 5 Koordinationsreifen versetzt am Boden, gefolgt von 4 Slalomstangen und 2 Markierungshütchen als Sprintziel.',
              drillRules: '1. Start: Auf Startsignal springt das erste Kind einbeinig im Rhythmus durch die Reifen (rechts-links im Wechsel wie ein Häschen).\n2. Stangen-Pendel: An den Slalomstangen wird im tiefen Schwerpunkt mit schnellen Sidesteps seitlich um die Stangen gependelt.\n3. Abschluss: Nach der letzten Stange explosiver 5m-Sprint zum Zielhütchen. Lockerer Trab außen zurück zum Start.',
              coachingPoints: ['Sprunggelenke federn', 'Lockerer Oberkörper', 'Blick nach vorne richten'],
              sourceUrl: 'https://www.soccerdrills.de/themen/koordination/kinder-bewegungslandschaften/',
              fieldDiagram: `
O O O O  (Reifen) ---> |   |   | (Stangen)
`
            },
            {
              name: 'Hauptteil',
              durationMinutes: 20,
              title: '2-gegen-1 Überzahlspiel mit Torabschluss',
              organization: '2 parallele Spielfelder (18x12m) mit je 2 Minitoren auf der Verteidigerseite. 2 Angreifer starten an der Grundlinie mit Ball, 1 Verteidiger startet an der Mittellinie.',
              drillRules: '1. Start: Angreifer A dribbelt an. Der Verteidiger rückt heraus und attackiert.\n2. Ablauf: Die beiden Angreifer müssen im 2v1 die Entscheidung treffen: Dribble ich selbst durch, oder binde ich den Verteidiger und passe quer zum freien Mitspieler Angreifer B?\n3. Regeln: Torabschluss auf die beiden Minitore nur mit maximal 3 Ballkontakten pro Kind. Erobert der Verteidiger den Ball, darf er auf ein einzelnes Kontertor an der Angreifer-Grundlinie umschalten.\n4. Rotation: Nach jedem Durchgang rückt Angreifer A auf die Verteidigerposition, Verteidiger wechselt zur Angreifer-Gruppe B.',
              coachingPoints: ['Den Verteidiger binden, dann im richtigen Moment abspielen', 'Mitspieler bietet sich schräg an (Passwinkel)'],
              sourceUrl: 'https://www.soccerdrills.de/themen/1-gegen-1/1-gegen-1-frontal-minitore/',
              fieldDiagram: `
[Minitor 1]              [Minitor 2]
+----------------------------------+
|               (V)                |
|              /   \\               |
|            (A1)  (A2)            |
+----------------------------------+
`
            },
            {
              name: 'Spielformen & Abschlussspiel',
              durationMinutes: 30,
              title: 'Funino 3vs3 mit 2 neutralen Jokern',
              organization: '2 Funino-Felder (24x18m) mit je 4 Minitoren. 3 gegen 3, zusätzlich agiert 1 neutraler Spieler (oder Trainer) als ständiger Joker.',
              drillRules: '1. Start: Funino-Spiel auf 4 Minitore mit Schusszone.\n2. Joker-Regel: Der neutrale Joker spielt immer für das Team, das gerade im Ballbesitz ist. Dadurch entsteht in jeder Ballbesitzphase eine 4-gegen-3-Überzahl.\n3. Lernziel: Das ballbesitzende Team lernt, die Überzahl geduldig auszuspielen und durch Spielverlagerung das jeweils unbewachte Minitor anzusteuern.\n4. Wechsel: Joker wechselt nach 6 Minuten (jedes Kind darf mal Joker sein).',
              coachingPoints: ['Überzahl ausnutzen', 'Schnell die freie Seite suchen', 'Kopf heben und Überblick behalten'],
              sourceUrl: 'https://www.soccerdrills.de/themen/minifussball-funino/funino-regeln-praxis/',
              fieldDiagram: `
[Tor 1]                        [Tor 2]
+------------------------------------+
|         (A)        (B)             |
|              [JOKER]               |
|         (A)        (B)             |
+------------------------------------+
[Tor 3]                        [Tor 4]
`
            }
          ],
          coachingPoints: [
            'Erkennen von Überzahlsituationen schon im Kindesalter spielerisch wecken',
            'Der Pass ist ein Geschenk an den Mitspieler – er muss ankommen!',
            'Freude am gemeinsamen Torerfolg'
          ]
        },

        // ================= WOCHE 3: 1-GEGEN-1 & ZWEIKAMPF =================
        {
          id: 'w3-u5',
          week: 3,
          unitNumber: 5,
          dayOfWeek: 'Mittwoch',
          dateDisplay: 'Woche 3 • Mittwoch (17:30 - 18:30)',
          durationMinutes: 60,
          focusTheme: '1-gegen-1 Offensiv: Mut & Finten',
          targetGroupSize: '16 bis 20 Kinder',
          equipment: ['20 Bälle', '8 Minitore', 'Hütchen', 'Leibchen'],
          phases: [
            {
              name: 'Aufwärmen',
              durationMinutes: 5,
              title: 'Spinnen-Fangspiel mit Ball',
              organization: 'Feld 20x20m klar abgesteckt. 14–16 Kinder dribbeln frei mit jeweils einem Ball. 2 Kinder starten als "Spinnen" auf allen Vieren (Hände und Füße am Boden, Bauch nach oben oder unten) ohne Ball im Zentrum.',
              drillRules: '1. Start: Auf Pfiff jagen die beiden Spinnen los.\n2. Ablauf: Die Spinnen versuchen mit einer Hand, die Fußbälle der dribbelnden Kinder zu berühren. Dribbelnde Kinder müssen den Spinnen durch geschickte Tempowechsel, Richtungsänderungen und Finten ausweichen.\n3. Rollenwechsel: Berührt eine Spinne einen Ball, wird das berührte Kind sofort ebenfalls zur Spinne. Wer nach 2 Minuten als letzter noch mit Ball dribbelt, ist der Runden-Sieger!\n4. Rotation: Neuer Durchgang mit 2 neuen Spinnen.',
              coachingPoints: ['Tempowechsel bei Annäherung', 'Ball eng am Fuß halten', 'Blickkontakt halten'],
              sourceUrl: 'https://www.soccerdrills.de/themen/aufwaermen/fangspiele-kinderfussball/',
              fieldDiagram: `
+------------------------------------+
|  (K)        [Spinne]        (K)    |
|       (K)           (K)            |
|  (K)        [Spinne]        (K)    |
+------------------------------------+
`
            },
            {
              name: 'Koordination & Motorik',
              durationMinutes: 5,
              title: 'Spiegelfechter (Partner-Koordination)',
              organization: 'Paare stehen sich im Abstand von 2 Metern gegenüber (8–10 Paare im Raum verteilt). Ein Hütchen markiert die Grundstellung jedes Paares. Bälle liegen am Rand.',
              drillRules: '1. Start: Kind A ist der "Vorgeber", Kind B ist der "Spiegel".\n2. Ablauf: Kind A führt schnelle, überraschende Bewegungen aus (z. B. Sidesteps, Kniehebelauf, tiefe Kniebeuge, Ausfallschritt, Sprung mit Drehung). Kind B muss jede Bewegung blitzschnell spiegelverkehrt mitmachen.\n3. Wettkampf & Fangsignal: Nach 45 Sekunden ruft der Trainer "HOPP!": Der Spiegel muss versuchen, den Vorgeber an der Schulter abzuschlagen, bevor dieser 3 Meter nach hinten über die Sicherheitslinie flieht.\n4. Wechsel: Nach jedem Sprint Rollentausch. 4 Runden pro Kind.',
              coachingPoints: ['Hohe Aufmerksamkeit', 'Schnelle Gewichtsverlagerung', 'Tiefer Schwerpunkt'],
              sourceUrl: 'https://www.soccerdrills.de/themen/koordination/kinder-bewegungslandschaften/',
              fieldDiagram: `
(A) <======= Blickkontakt =======> (B)
`
            },
            {
              name: 'Hauptteil',
              durationMinutes: 20,
              title: '1-gg-1 Frontal: Angriff auf 2 Minitore',
              organization: '2 parallele Felder (16x12m) mit je 2 Minitoren an der Verteidiger-Grundlinie. Je Feld 8–10 Kinder: Angreifer an Hütchen A (mit ausreichend Bällen), Verteidiger an Hütchen B im Abstand von 10m frontal gegenüber.',
              drillRules: '1. Start: Angreifer dribbelt mit Tempo frontal auf den Verteidiger zu.\n2. Ablauf: Ca. 2 Meter vor dem Verteidiger setzt der Angreifer eine Körpertäuschung oder Finte ein (z. B. Schere, Übersteiger, Ausfallschritt) und beschleunigt dynamisch auf das freie Minitor.\n3. Regeln: Der Angreifer kann frei wählen, auf welches der beiden Minitore er abschließt (DFB-Prinzip: Spielverlagerung im 1-gegen-1!).\n4. Umschaltaktion: Erobert der Verteidiger den Ball, darf er über die gegnerische Grundlinie dribbeln (1 Konterpunkt).\n5. Rotation: Schneller Rollentausch nach jeder Aktion: Angreifer holt den Ball und stellt sich bei den Verteidigern an.',
              coachingPoints: ['Mut zur Finte!', 'Tempo anziehen, sobald der Verteidiger auf einer Seite steht', 'Fehler gehören zum Lernen dazu'],
              sourceUrl: 'https://www.soccerdrills.de/themen/1-gegen-1/1-gegen-1-frontal-minitore/',
              fieldDiagram: `
[Tor L]                    [Tor R]
+--------------------------------+
|              (V)               |
|               ^                |
|               |                |
|              (A)               |
+--------------------------------+
`
            },
            {
              name: 'Spielformen & Abschlussspiel',
              durationMinutes: 30,
              title: 'Funino mit "Torjäger-Bonus"',
              organization: '2 Funino-Felder (22x18m) mit je 4 Minitoren und 6m-Schusszone. Gespielt wird 3vs3 plus 1-2 Rotationsspieler pro Mannschaft an der Mittellinie.',
              drillRules: '1. Start: Anstoß an der Mittellinie nach hinten. DFB-Minifußball ohne festen Torwart.\n2. Sonderregel Torjäger-Bonus: Überwindet ein Spieler einen gegnerischen Verteidiger im direkten 1-gegen-1 (durch Dribbling oder Finte) und erzielt anschließend ein Tor, zählt der Treffer doppelt (2 Punkte)!\n3. Tore zählen nur aus der 6m-Schusszone.\n4. Rotation: Nach jedem erzielten Tor wechselt beim erfolgreichen Team sofort 1 Kind mit dem Einwechselspieler an der Mittellinie.',
              coachingPoints: ['Mutige Dribblings in der gegnerischen Hälfte', 'Schnelles Gegenpressing bei Ballverlust', 'Freude am 1-gegen-1 Duell'],
              sourceUrl: 'https://www.soccerdrills.de/themen/minifussball-funino/funino-regeln-praxis/',
              fieldDiagram: `
[Tor 1]                        [Tor 2]
+------------------------------------+
|                                    |
|      (Team A)       (Team B)       |
|                                    |
+------------------------------------+
[Tor 3]                        [Tor 4]
`
            }
          ],
          coachingPoints: [
            'Loben, loben, loben bei jedem Dribbelversuch – Fehler gehören dazu!',
            'Dem Verteidiger beibringen: Seitlich stehen, nicht überstürzt zutreten',
            'Hohe Wiederholungszahl durch kurze Duelle (max. 10 Sekunden)'
          ]
        },
        {
          id: 'w3-u6',
          week: 3,
          unitNumber: 6,
          dayOfWeek: 'Freitag',
          dateDisplay: 'Woche 3 • Freitag (17:30 - 18:30)',
          durationMinutes: 60,
          focusTheme: '1-gegen-1 Defensiv: Geschicktes Ballerobern',
          targetGroupSize: '16 bis 20 Kinder',
          equipment: ['20 Bälle', '8 Minitore', 'Hütchen', 'Leibchen'],
          phases: [
            {
              name: 'Aufwärmen',
              durationMinutes: 5,
              title: 'Burgfräulein & Raubritter (Abschirmspiel)',
              organization: 'Feld 18x18m klar mit Hütchen begrenzt. Jedes Kind hat einen eigenen Ball (die "Burg"). Alle Kinder bewegen sich frei kreuz und quer im Feld.',
              drillRules: '1. Start: Alle Kinder dribbeln gleichzeitig und müssen ihre eigene Burg vor Angriffen schützen.\n2. Ablauf: Die Kinder versuchen, mit dem Fuß die Bälle der anderen aus dem Feld zu spitzeln, während sie ihren eigenen Ball mit dem Körper abschirmen.\n3. Wertung: Gelingt es einem Kind, einen fremden Ball ins Aus zu befördern, sammelt es einen "Ritterpunkt". Das herausgeschlagene Kind holt den Ball und spielt sofort wieder mit.\n4. Coaching: Breiter Stand, Gesäß raus, Körper zwischen Gegner und Ball bringen.',
              coachingPoints: ['Körper geschickt zwischen Gegner und Ball stellen', 'Niedriger Schwerpunkt', 'Ball mit der fernen Sohle führen'],
              sourceUrl: 'https://www.soccerdrills.de/themen/aufwaermen/fangspiele-kinderfussball/',
              fieldDiagram: `
+------------------------------------+
|  (K)[B]        (K)[B]      (K)[B]  |
|         (K)[B]        (K)[B]       |
+------------------------------------+
`
            },
            {
              name: 'Koordination & Motorik',
              durationMinutes: 5,
              title: 'Schattenlauf im Stangenwald',
              organization: '8 Slalomstangen unregelmäßig auf einer 15x15m Fläche verteilt. Kinder bilden Paare (Angreifer A und Schatten-Verteidiger B) ohne Ball.',
              drillRules: '1. Start: Kind A läuft im Zickzack im schnellen Tempo durch die Stangen.\n2. Ablauf: Kind B (der Schatten) muss in defensiver Grundstellung (seitlich versetzt, tiefer Schwerpunkt, flinke Sidesteps) im Abstand von 1 Meter folgen, ohne eine Stange zu touchieren.\n3. Abfang-Signal: Nach 30 Sekunden klatscht der Trainer in die Hände – auf Klatschen muss der Schatten versuchen, den Angreifer sanft an der Hüfte abzuschlagen.\n4. Wechsel: Nach jedem Durchgang Rollentausch. 4 Durchgänge pro Kind.',
              coachingPoints: ['Schnelle Beinarbeit', 'Gleichgewicht halten', 'Nicht kreuzen, sondern gleiten'],
              sourceUrl: 'https://www.soccerdrills.de/themen/koordination/kinder-bewegungslandschaften/',
              fieldDiagram: `
|   |   |   |  (Stangen)
(A) ----> (V läuft seitlich mit)
`
            },
            {
              name: 'Hauptteil',
              durationMinutes: 20,
              title: '1-gg-1 mit Start im Rücken des Angreifers',
              organization: '2 Stationen nebeneinander. Je Station 1 Minitor oder Jugendtor mit TW in 16m Entfernung. Angreifer startet an Hütchen A mit Ball. Verteidiger startet an Hütchen B, ca. 2 Meter versetzt HINTER dem Angreifer.',
              drillRules: '1. Start: Auf Trainerpfiff startet der Angreifer im Vollsprint mit Ball in Richtung Tor.\n2. Ablauf: Der Verteidiger nimmt sofort die Verfolgung auf und versucht, den Angreifer seitlich abzulaufen, fair den Körper vor den Ball zu schieben oder den Schuss zu blocken.\n3. Regeln: Strenges Verbot von Fouls von hinten (DFB Fairplay-Erziehung!). Schafft es der Verteidiger, den Ball sauber abzulaufen oder ins Aus zu spitzeln, erhält er 1 Verteidigerpunkt. Trifft der Angreifer, erhält er 1 Punkt.\n4. Rotation: Nach jedem Duell wechseln die Kinder die Rollen (Angreifer wird Verteidiger).',
              coachingPoints: ['Nicht foulen, sondern den Körper vor den Ball schieben', 'Nach Balleroberung sofort Kontertor suchen', 'Tempo im Sprint voll durchziehen'],
              sourceUrl: 'https://www.soccerdrills.de/themen/1-gegen-1/1-gegen-1-frontal-minitore/',
              fieldDiagram: `
[MINITOR]
   ^
   |
  (A) [Ball]
   ^
   | (Verfolgung)
  (V)
`
            },
            {
              name: 'Spielformen & Abschlussspiel',
              durationMinutes: 30,
              title: 'Funino 3vs3 mit Umschalt-Prämie',
              organization: '2 Funino-Felder (je 22x18m) mit 4 Minitoren und 6m-Schusszone. Gespielt wird 3vs3 mit Wechselspielern.',
              drillRules: '1. Start: Minifußball auf 4 Minitore.\n2. Umschalt-Prämie: Schafft es ein Team, dem Gegner in der eigenen Hälfte den Ball abzunehmen und innerhalb von maximal 8 Sekunden ein Kontertor zu erzielen, zählt dieser Treffer doppelt (2 Punkte)!\n3. Regeln: Normale Tore aus der Schusszone zählen 1 Punkt. Rotation nach jedem Tor.\n4. Wertung: 4 Runden à 6 Minuten Spielzeit.',
              coachingPoints: ['Sofortiger Torabschluss nach Balleroberung', 'Voller Einsatz aller Spieler', 'Kompaktes Verschieben'],
              sourceUrl: 'https://www.soccerdrills.de/themen/minifussball-funino/funino-regeln-praxis/',
              fieldDiagram: `
[Tor 1]                        [Tor 2]
+------------------------------------+
|      (Team A)       (Team B)       |
+------------------------------------+
[Tor 3]                        [Tor 4]
`
            }
          ],
          coachingPoints: [
            'Saubere Zweikampfführung: Körpereinsatz ja, aber faires Spiel!',
            'Balleroberung ist nur der halbe Schritt – der Konter macht das Tor',
            'Schnelle Wechselzeiten'
          ]
        },

        // ================= WOCHE 4: TORSCHUSS & ZIELSTREBIGKEIT =================
        {
          id: 'w4-u7',
          week: 4,
          unitNumber: 7,
          dayOfWeek: 'Mittwoch',
          dateDisplay: 'Woche 4 • Mittwoch (17:30 - 18:30)',
          durationMinutes: 60,
          focusTheme: 'Torschuss: Präzision mit Vollspan & Innenseite',
          targetGroupSize: '16 bis 20 Kinder',
          equipment: ['20 Bälle Gr. 3', '2 Jugendtore (5 vs 5)', '4 Minitore', 'Hütchen'],
          phases: [
            {
              name: 'Aufwärmen',
              durationMinutes: 5,
              title: 'Dribbel-Staffel mit Torschuss ins Minitor',
              organization: '4 parallele Teams à 4–5 Kinder an der Grundlinie aufstellen. Vor jedem Team steht in 10m Entfernung ein Wendemal (Hütchen) und in weiteren 6m ein Minitor. Jedes Team hat 3 Bälle.',
              drillRules: '1. Start: Erstes Kind jedes Teams startet auf Trainerpfiff im Dribbling um das Wendemal herum.\n2. Ablauf: Hinter dem Wendemal stoppt das Kind den Ball nicht ab, sondern schließt direkt mit der Innenseite gezielt flach ins Minitor ab.\n3. Staffel-Übergabe: Nach dem Schuss holt das Kind den Ball schnell aus dem Tor, dribbelt zurück zur Gruppe und klatscht das nächste Kind per Handshake ab.\n4. Wertung: Welches Team erzielt zuerst 10 Treffer? Runde 2: Schuss nur mit dem schwachen Fuß!',
              coachingPoints: ['Kontrollierter Schuss mit der Innenseite', 'Hohe Frequenz', 'Fairer Staffelwechsel'],
              sourceUrl: 'https://www.soccerdrills.de/themen/torschuss/torschuss-kinderfussball-spass/',
              fieldDiagram: `
(K)(K)(K) ----> [Hütchen] ----(Schuss)----> [MINITOR]
`
            },
            {
              name: 'Koordination & Motorik',
              durationMinutes: 5,
              title: 'Sprungkombination mit Torjubel',
              organization: '2 Bahnen vor dem Torraum: Je Bahn 2 Minihürden (oder Reifen), gefolgt von einem ruhenden Ball auf einem Markierungsteller in 5m Entfernung vor einem Jugendtor oder Minitor.',
              drillRules: '1. Start: Kind startet mit beidbeinigem Sprung über Hürde 1, sofortiger explosiver Reaktivsprung über Hürde 2.\n2. Landung & Schuss: Nach der zweiten Landung sofortiges stabiles Ausbalancieren auf dem Standbein und kraftvoller Vollspannstoß auf den ruhenden Ball ins Tor.\n3. Torjubel: Nach dem Treffer darf das Kind seinen persönlichen Torjubel zeigen (stärkt Selbstvertrauen und Motivation!).\n4. Rotation: Ball holen, auf den Teller legen und locker außen zurückgehen. 4 Durchgänge pro Kind.',
              coachingPoints: ['Stabiles Standbein', 'Dynamische Landung', 'Kopf über den Ball beim Schuss'],
              sourceUrl: 'https://www.soccerdrills.de/themen/koordination/kinder-bewegungslandschaften/',
              fieldDiagram: `
(K) --> /\\  /\\ --> [Ball] --> [TOR]
`
            },
            {
              name: 'Hauptteil',
              durationMinutes: 20,
              title: 'Torschuss-Feuerwerk auf Jugendtor mit Torwart',
              organization: 'Aufbau an 2 Jugendtoren (5m-Tore) mit Torhütern (Torwartwechsel alle 4 Minuten). Pro Tor 8–10 Kinder in 2 Positionen: Gruppe A (Schützen an der 11m-Linie) und Gruppe B (Passgeber an der Grundlinie). Viele Bälle bereitstellen.',
              drillRules: '1. Start: Passgeber B spielt den Ball flach und druckvoll schräg aus dem Strafraumeck in den Lauf von Schütze A.\n2. Ablauf: Schütze A läuft dynamisch an und schließt mit maximal 2 Kontakten (optimal Direktabnahme mit dem Vollspann) gezielt in eine der Torecken ab.\n3. Coaching & Technik: Standbein steht eine Fußbreite fest neben dem Ball, Fußspitze nach unten gestreckt, Oberkörper über den Ball geneigt (verhindert Bogenlampen über das Tor).\n4. Rotation: Schütze A holt seinen Ball und wird zum Passgeber B. Passgeber B reiht sich bei den Schützen der Gruppe A ein.',
              coachingPoints: ['Standbein neben den Ball (ca. 20 cm Abstand)', 'Körper über den Ball beugen', 'Blick kurz auf die Torecke richten'],
              sourceUrl: 'https://www.soccerdrills.de/themen/torschuss/torschuss-kinderfussball-spass/',
              fieldDiagram: `
           [ JUGENDTOR mit TW ]
                    ^
                    | (Schuss)
                   (K)
                  /
              [Ball]
                ^
                |
           (K1)(K2)(K3)
`
            },
            {
              name: 'Spielformen & Abschlussspiel',
              durationMinutes: 30,
              title: '5 vs. 5 auf 2 Jugendtore mit Torhütern',
              organization: '1 großes Spielfeld 35x25m mit 2 Jugendtoren und Torhütern. 2 Teams à 5 Feldspieler plus 1 TW. Auswechselspieler an der Seitenlinie rotieren alle 3 Minuten ein.',
              drillRules: '1. Start: Anstoß in der Feldmitte. Echtes 5-gegen-5 nach DFB-Kinderspielform mit Torhütern.\n2. Spielregeln: Torschüsse sind ab der Mittellinie erlaubt. Alle Kinder greifen gemeinsam an, alle verteidigen.\n3. Rebound-Regel: Nach jedem Torschuss muss mindestens ein Mitspieler auf den Abpraller (Rebound) nachsetzen!\n4. Spielzeit: 2 Halbzeiten à 12 Minuten mit kurzer Trinkpause.',
              coachingPoints: ['Schneller Abschluss sobald eine Lücke da ist', 'Rebound: Auf Abpraller lauern!', 'Torhüter loben und einbinden'],
              sourceUrl: 'https://www.soccerdrills.de/themen/minifussball-funino/funino-regeln-praxis/',
              fieldDiagram: `
[TOR A]                                          [TOR B]
+------------------------------------------------------+
|                       (Feld 5v5)                     |
+------------------------------------------------------+
`
            }
          ],
          coachingPoints: [
            'Echter Torschuss macht Kindern am meisten Spaß – Spielfreude maximieren!',
            'Tore laut bejubeln lassen',
            'Fehlschüsse ermutigend kommentieren: "Der nächste sitzt!"'
          ]
        },
        {
          id: 'w4-u8',
          week: 4,
          unitNumber: 8,
          dayOfWeek: 'Freitag',
          dateDisplay: 'Woche 4 • Freitag (17:30 - 18:30)',
          durationMinutes: 60,
          focusTheme: 'Großes Funino-Festival & Spieltag-Generalprobe',
          targetGroupSize: '16 bis 20 Kinder',
          equipment: ['20 Bälle Gr. 3', '8 Minitore', 'Leibchen in 4 Farben', 'Stoppuhr'],
          phases: [
            {
              name: 'Aufwärmen',
              durationMinutes: 5,
              title: 'KickerCoach Dribbel-Champions',
              organization: 'Feld 25x20m. Jedes der 16–20 Kinder hat einen Ball und dribbelt frei im Raum. An den 4 Außenseiten steht je ein Tor mit Hütchen markiert.',
              drillRules: '1. Start: Alle Kinder dribbeln gleichzeitig mit schnellen, kurzen Kontakten durch das Feld.\n2. Challenge: Der Trainer startet eine 60-Sekunden-Stoppuhr. Wer schafft mindestens 50 Ballberührungen (abwechselnd rechts/links), ohne mit einem anderen Kind zu kollidieren?\n3. Kommando-Abschluss: Auf "FEUER!" dribbeln alle Kinder im Vollsprint zum nächstgelegenen Außentor und stoppen den Ball exakt auf der Linie mit der Sohle.\n4. Wertung: 3 Runden mit Steigerung der Kriterien.',
              coachingPoints: ['Beide Füße einsetzen', 'Freude an der Ballberührung', 'Kopf heben für Überblick'],
              sourceUrl: 'https://www.soccerdrills.de/themen/dribbling/kinderfussball-hütchenwald/',
              fieldDiagram: `
+------------------------------------+
|   (K)       (K)         (K)        |
|        (K)         (K)       (K)   |
+------------------------------------+
`
            },
            {
              name: 'Koordination & Motorik',
              durationMinutes: 5,
              title: 'Sprint-Relais mit Farbhütchen',
              organization: '4 Teams à 4–5 Kinder an der Startlinie aufstellen. In 10m Entfernung stehen 4 verschiedenfarbige Hütchen (Rot, Gelb, Blau, Grün) nebeneinander.',
              drillRules: '1. Start: Die ersten Kinder jedes Teams stehen in Startposition (tiefer Ausfallschritt).\n2. Ablauf: Der Trainer ruft eine Farbkombination (z. B. "GELB-BLAU!"). Die Kinder sprinten blitzschnell los, berühren zuerst das gelbe, dann das blaue Hütchen mit der Hand und sprinten im Vollsprint zurück zur Startlinie.\n3. Staffel-Übergabe: Durch Abklatschen (Handshake) startet sofort das nächste Kind.\n4. Wertung: 3 Runden. Welches Team arbeitet am lautesten und schnellsten zusammen?',
              coachingPoints: ['Schneller Start', 'Teamgeist anfeuern', 'Körperschwerpunkt beim Abstoppen absenken'],
              sourceUrl: 'https://www.soccerdrills.de/themen/schnelligkeit/reaktionssprints-jugend/',
              fieldDiagram: `
Team 1: (K)(K) ----> [Rot]
Team 2: (K)(K) ----> [Blau]
`
            },
            {
              name: 'Hauptteil',
              durationMinutes: 20,
              title: '3-gegen-2 Überzahlspiel mit Konterchancen',
              organization: '2 parallele Spielfelder (20x15m) mit je 2 Minitoren auf beiden Seiten. 3 Angreifer starten mit Ball an der Grundlinie, 2 Verteidiger stehen an der Mittellinie.',
              drillRules: '1. Start: Die 3 Angreifer starten ihren Angriff im 3v2 im hohen Tempo.\n2. Ablauf: Die Angreifer versuchen, durch geschicktes Dreiecksspiel und Verlagern auf die freie Seite ein Tor auf die beiden Minitore zu erzielen.\n3. Umschaltaktion: Erobern die beiden Verteidiger den Ball, schalten sie sofort um und kontern auf die beiden gegenüberliegenden Minitore (die 3 Angreifer müssen blitzschnell auf Gegenpressing umschalten!).\n4. Rotation: Nach 3 Angriffen wechseln die Teams die Rollen (Verteidiger werden Angreifer).',
              coachingPoints: ['Schneller Pass zum freien Mitspieler', 'Zielstrebiger Torschuss', 'Blitzschnelles Umschalten nach Ballverlust'],
              sourceUrl: 'https://www.soccerdrills.de/themen/minifussball-funino/funino-regeln-praxis/',
              fieldDiagram: `
[Tor 1]                                [Tor 2]
+--------------------------------------------+
|             (V1)          (V2)             |
|                                            |
|        (A1)         (A2)        (A3)       |
+--------------------------------------------+
`
            },
            {
              name: 'Spielformen & Abschlussspiel',
              durationMinutes: 30,
              title: 'Abschluss-Funino-Turnier (DFB-Festival-Modus)',
              organization: '2 Spielfelder (22x18m) nebeneinander mit je 4 Minitoren und 6m-Schusszone. 4 feste 3er- oder 4er-Teams im Festival-Modus.',
              drillRules: '1. Spielmodus: 6 Runden à 4 Minuten Spielzeit. Alle Teams spielen gegeneinander.\n2. Regeln: DFB-Minifußball 3vs3 auf 4 Minitore mit Schusszone und automatischer Einwechsel-Rotation nach jedem Torerfolg.\n3. Festival-Atmosphäre: Kein Tabellendruck, Fokus auf Tore & Spielfreude! Alle erzielten Tore des gesamten Trainings werden am Ende gemeinsam zusammengezählt ("Knacken wir heute gemeinsam 50 Tore?").\n4. Abschluss: Großes gemeinsames Abklatschen aller Kinder und Trainer im Mittelkreis.',
              coachingPoints: ['Faires Miteinander', 'Jedes Kind spielt mindestens 70% der Gesamtzeit', 'Mutige Aktionen laut bejubeln'],
              sourceUrl: 'https://www.soccerdrills.de/themen/minifussball-funino/kaiserturnier-spielfelder/',
              fieldDiagram: `
[Feld 1: 3vs3 Funino]       [Feld 2: 3vs3 Funino]
`
            }
          ],
          coachingPoints: [
            'Abschlusslob für 4 Wochen intensives und erfolgreiches Training',
            'Gemeinsamer Team-Kreis zum Trainingsende: "1, 2, 3 - KickerCoach!"',
            'Trainer gibt jedem Kind ein individuelles positives Feedback mit auf den Weg'
          ]
        }
      ]
    };
  }
};

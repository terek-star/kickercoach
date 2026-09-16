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
    apiVersion: 'kickercoach_gemini_api_version'
  },

  defaultModel: 'gemini-2.0-flash',
  cachedModels: [],

  getApiKey() {
    return localStorage.getItem(this.storageKeys.apiKey) || '';
  },

  setApiKey(key, model = null, apiVersion = 'v1beta') {
    if (key) {
      localStorage.setItem(this.storageKeys.apiKey, key.trim());
    } else {
      localStorage.removeItem(this.storageKeys.apiKey);
    }
    if (model) {
      localStorage.setItem(this.storageKeys.model, model);
    }
    if (apiVersion) {
      localStorage.setItem(this.storageKeys.apiVersion, apiVersion);
    }
  },

  getModel() {
    return localStorage.getItem(this.storageKeys.model) || this.defaultModel;
  },

  getApiVersion() {
    return localStorage.getItem(this.storageKeys.apiVersion) || 'v1beta';
  },

  hasApiKey() {
    const key = this.getApiKey();
    return Boolean(key && key.length > 10);
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
        unit.focusTheme = `${focusText} • ${isBambini ? 'Spielerisch & Kindgerecht' : 'DFB Schwerpunkt'}`;
        const mainPhase = unit.phases.find(p => p.name === 'Hauptteil');
        if (mainPhase) {
          mainPhase.title = `${focusText} (${isBambini ? 'Bambini-Spielform' : 'Parallele Stationen'})`;
          mainPhase.coachingPoints = [
            `Trainerschwerpunkt: ${focusText}`,
            isBambini ? 'Mut belohnen und jedes Kind mitnehmen' : 'Kopf heben und Überblick behalten',
            'Beide Füße aktiv ausprobieren'
          ];
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
   * Universeller Gemini Aufruf mit automatischem Modell-Fallback
   */
  async callGemini({ prompt, generationConfig = {}, preferredModel = null }) {
    const apiKey = this.getApiKey();
    if (!apiKey) throw new Error('Kein API-Key vorhanden');

    let currentModel = preferredModel || this.getModel();
    let currentVersion = this.getApiVersion();

    // Modell-Kandidaten zur Auswahl (startend mit dem aktiven Modell)
    const fallbackList = [
      currentModel,
      'gemini-2.0-flash',
      'gemini-1.5-flash-latest',
      'gemini-1.5-flash-002',
      'gemini-1.5-flash-001',
      'gemini-1.5-flash',
      'gemini-1.5-pro-latest',
      'gemini-1.5-pro',
      'gemini-pro'
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
              return this.callGemini({ prompt, preferredModel: candidate, generationConfig: stripped });
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
      'gemini-2.0-flash',
      'gemini-1.5-flash-latest',
      'gemini-1.5-flash-002',
      'gemini-1.5-flash-001',
      'gemini-1.5-flash',
      'gemini-1.5-pro-latest',
      'gemini-1.5-pro',
      'gemini-pro'
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

    // 1. Prüfen, ob ein API-Key vorhanden ist
    if (!this.hasApiKey()) {
      const err = new Error('Kein Google Gemini API-Key hinterlegt.');
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
${customFocus ? `- TRAINER-SCHWERPUNKT: "${customFocus}". Integriere diesen Schwerpunkt altersgerecht und spielerisch in den Hauptteil und die Spielform. Verweigere den Schwerpunkt keinesfalls, sondern passe ihn kindgemäß an (z. B. "Passspiel" bei Bambini/U7 als Bälle ins Partner-Tor schieben oder Tor-Schuss-Freunde)!` : ''}

Zeitstruktur jeder 60-minütigen Einheit:
1. 00–05 Min.: Aufwärmen (Bewegungsspiel, Fangspiel oder Ballgewöhnung)
2. 05–10 Min.: Motorik & Koordination (altersgerechte Bewegungsbaustelle mit Reifen/Stangen/Hütchen)
3. 10–30 Min.: Hauptteil mit Schwerpunkt (${customFocus || 'Dribbling, Schießen oder Spiel mit Ball'})
4. 30–60 Min.: Spielformen & Abschlussspiel (Funino auf 4 Minitore)

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
          "organization": "Feldaufbau und minimale Wartezeiten",
          "drillRules": "Kindgerechte Spielregeln",
          "fieldDiagram": "Kompakte Feldskizze (4 Zeilen ASCII)",
          "sourceUrl": "https://www.soccerdrills.de"
        },
        {
          "name": "Koordination & Motorik",
          "durationMinutes": 5,
          "title": "Übungsname",
          "organization": "Stationsaufbau",
          "drillRules": "Ablauf für Kinder",
          "fieldDiagram": "",
          "sourceUrl": ""
        },
        {
          "name": "Hauptteil",
          "durationMinutes": 20,
          "title": "Übungsname",
          "organization": "Parallele Trainingszonen",
          "drillRules": "Ablauf",
          "fieldDiagram": "Kompakte Feldskizze (4 Zeilen ASCII)",
          "sourceUrl": ""
        },
        {
          "name": "Spielformen & Abschlussspiel",
          "durationMinutes": 30,
          "title": "Funino auf 4 Minitore",
          "organization": "Spielfeld mit 4 Minitoren",
          "drillRules": "Funino-Regeln",
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

    // 2. Wenn Gemini Key vorhanden, erweiterte KI-Suche nach echten soccerdrills Übungen
    if (this.hasApiKey() && query && query.length > 2) {
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

    if (!this.hasApiKey()) {
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
              organization: 'Feld 20x20m. Jedes Kind hat einen Ball. 20 Hütchen kreuz und quer verteilt.',
              drillRules: 'Freies Dribbeln durch den Wald. Auf Farbrufe: "Rot" = Ballsohle, "Gelb" = Außenrist-Kreis, "Blau" = Richtungswechsel.',
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
              organization: '2 parallele Stationen für je 8-10 Kinder. Sofortiges Nachrücken.',
              drillRules: 'Beidbeinige Prellsprünge durch Reifen, Seitwärtsschritte über Minihürden, abschließender Antritt zur Ziellinie.',
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
              organization: 'Feld 25x20m. 10 Hütchentore (Breite 1,5m) im Feld verteilt. 2 Teams à 8-10 Kinder im Parallelbetrieb.',
              drillRules: 'Kinder durchdribbeln in 90 Sekunden so viele Hütchentore wie möglich. Tore dürfen nicht zweimal hintereinander genutzt werden.',
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
              organization: '2 Spielfelder (je 22x18m) nebeneinander. Je 8-10 Kinder (3v3 plus 1-2 Rotationsspieler).',
              drillRules: 'Tore zählen nur aus der 6m-Schusszone. Nach jedem Treffer wird an der Mittellinie automatisch rotiert.',
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
              organization: 'Feld 20x20m. 16 "Hasen" dribbeln mit Ball, 2 "Füchse" mit Leibchen jagen ohne Ball.',
              drillRules: 'Füchse spitzeln Bälle ins Aus. Erwischter Hase macht 3 Kniebeugen und holt seinen Ball zurück.',
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
              organization: '4 Bahnen à 4-5 Kinder. Kurze Durchläufe.',
              drillRules: 'Vorwärts-, Rückwärts- und Seitschritte durch Stangen, dann auf Klatschen schneller Sprint zum Ball.',
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
              organization: '2 Felder nebeneinander. Angreifer startet mit Ball, Verteidiger läuft diagonal an.',
              drillRules: 'Angreifer nutzt Finte (Übersteiger, Ausfallschritt) und schließt auf eins von zwei Minitoren ab.',
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
              organization: '3 Felder nebeneinander. Feld 1 (Gold/Champions), Feld 2 (Silber), Feld 3 (Bronze).',
              drillRules: '5-Minuten-Spiele 3vs3. Gewinnerteam steigt ein Feld nach oben, Verlierer nach unten.',
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
              organization: 'Feld 20x20m. 10 Bälle bei 20 Kindern. Ständige Bewegung.',
              drillRules: 'Kinder im Raum verteilen. Spieler mit Ball passen zu Spielern ohne Ball. Kein Rückpass zum gleichen Spieler.',
              coachingPoints: ['Blickkontakt vor dem Pass!', 'Namen des Mitspielers rufen'],
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
              organization: 'Paarweise Aufstellung mit 5m Abstand.',
              drillRules: 'Nach kurzem Innenseitpass sprintet der Passgeber um den Partner herum zurück auf seine Position.',
              coachingPoints: ['Schneller erster Schritt', 'Körper vorwärts geneigt'],
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
              organization: '4 Stationen à 4-5 Kinder. Dreieck aus Hütchen mit 8m Seitenlänge.',
              drillRules: 'Pass von A auf B. B nimmt den Ball mit offener Stellung mit und passt auf C. C dribbelt zu A zurück.',
              coachingPoints: ['Offene Spielstellung: beide Mitspieler im Blick', 'Erster Kontakt aktiv in die neue Spielrichtung'],
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
              organization: '2 Funino-Felder mit 4 Minitoren. 3 vs. 3.',
              drillRules: 'Normale Funino-Regeln. Gelingt vor dem Torerfolg ein direkter Doppelpass, zählt der Treffer doppelt!',
              coachingPoints: ['Geduld beim Spielaufbau', 'Gemeinsam angreifen, gemeinsam verteidigen'],
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
              organization: '2 Zonen (je 8-10 Kinder). Markierungen in Rot, Blau, Gelb.',
              drillRules: 'Kinder passen im Kreis. Auf "Blau" muss der Ball zur blauen Ecke gespielt und dort angenommen werden.',
              coachingPoints: ['Präzises Passen auf den richtigen Fuß', 'Vororientierung'],
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
              organization: 'Koordinationsparcours mit Reifen und Stangen.',
              drillRules: 'Einbeinige Sprünge in Reifen, schnelles Ausweichen um Pendelstangen.',
              coachingPoints: ['Sprunggelenke federn', 'Lockerer Oberkörper'],
              sourceUrl: 'https://www.soccerdrills.de/themen/koordination/kinder-bewegungslandschaften/',
              fieldDiagram: `
O O O O  (Reifen) ---> |   |   | (Stangen)
`
            },
            {
              name: 'Hauptteil',
              durationMinutes: 20,
              title: '2-gegen-1 Überzahlspiel mit Torabschluss',
              organization: '2 Felder à 15x12m. 2 Angreifer gegen 1 Verteidiger auf 2 Minitore.',
              drillRules: 'Angreifer spielen im 2-gg-1 zusammen. Erkennen: Wann passe ich zum freien Mitspieler? Wann dribble ich selbst?',
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
              organization: '2 Funino-Felder. 3vs3 plus 1 Trainer/Joker-Kind pro Feld.',
              drillRules: 'Der Joker spielt immer mit dem ballbesitzenden Team. Dadurch ständige 4vs3-Überzahl und viele Passmöglichkeiten.',
              coachingPoints: ['Überzahl ausnutzen', 'Schnell die freie Seite suchen'],
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
              organization: 'Feld 20x20m. 2 Kinder krabbeln als Spinnen, 16 Kinder dribbeln.',
              drillRules: 'Spinnen versuchen mit den Händen die Bälle zu berühren. Berührte Kinder werden zur Spinne.',
              coachingPoints: ['Tempowechsel bei Annäherung', 'Ball eng am Fuß halten'],
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
              organization: 'Paare stehen sich im Abstand von 2 Metern gegenüber.',
              drillRules: 'Kind A macht Bewegungen vor (Kniehebelauf, Sprünge, Hocken). Kind B spiegelt blitzschnell.',
              coachingPoints: ['Hohe Aufmerksamkeit', 'Schnelle Gewichtsverlagerung'],
              sourceUrl: 'https://www.soccerdrills.de/themen/koordination/kinder-bewegungslandschaften/',
              fieldDiagram: `
(A) <======= Blickkontakt =======> (B)
`
            },
            {
              name: 'Hauptteil',
              durationMinutes: 20,
              title: '1-gg-1 Frontal: Angriff auf 2 Minitore',
              organization: '2 Stationen à 8-10 Kinder. Spielfeld 16x12m mit je 2 Minitoren.',
              drillRules: 'Trainer spielt Ball ins Feld. Angreifer und Verteidiger starten gleichzeitig. Angreifer kann auf Tor links oder rechts zielen.',
              coachingPoints: ['Mut zur Finte!', 'Tempo anziehen, sobald der Verteidiger auf einer Seite steht'],
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
              organization: '2 Funino-Felder. 3vs3 mit 4 Minitoren.',
              drillRules: 'Normale Funino-Regeln. Tore nach einem gewonnenen 1-gg-1 zählen doppelt.',
              coachingPoints: ['Mutige Dribblings in der gegnerischen Hälfte', 'Schnelles Gegenpressing bei Ballverlust'],
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
              organization: 'Feld 20x20m. Jedes Kind schützt seinen Ball wie eine "Burg".',
              drillRules: 'Die Kinder versuchen, die Bälle anderer wegzuspitzeln, während sie den eigenen beschützen.',
              coachingPoints: ['Körper geschickt zwischen Gegner und Ball stellen', 'Niedriger Schwerpunkt'],
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
              organization: 'Parcours mit 8 Slalomstangen.',
              drillRules: 'Verteidiger läuft dem Angreifer im Rückwärts-/Seitwärtslauf hinterher, ohne ihn zu berühren.',
              coachingPoints: ['Schnelle Beinarbeit', 'Gleichgewicht halten'],
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
              organization: '2 Stationen. Angreifer startet 2 Meter vor dem Verteidiger.',
              drillRules: 'Angreifer dribbelt aufs Minitor zu. Verteidiger sprintet hinterher und versucht sauber abzulaufen oder zu stören.',
              coachingPoints: ['Nicht foulen, sondern den Körper vor den Ball schieben', 'Nach Balleroberung sofort Kontertor suchen'],
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
              organization: '2 Funino-Felder. 3vs3 auf 4 Minitore.',
              drillRules: 'Erobert ein Team den Ball und erzielt innerhalb von 8 Sekunden ein Tor, gibt es 2 Punkte.',
              coachingPoints: ['Sofortiger Torabschluss nach Balleroberung', 'Voller Einsatz aller Spieler'],
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
              organization: '4 Teams à 4-5 Kinder. Jedes Team hat ein Minitor in 15m Entfernung.',
              drillRules: 'Dribbling um ein Wendemal, dann präziser Schuss ins Minitor. Ball holen und abklatschen.',
              coachingPoints: ['Kontrollierter Schuss mit der Innenseite', 'Hohe Frequenz'],
              sourceUrl: 'https://www.soccerdrills.de/themen/torschuss/torschuss-kinderfussball-spass/',
              fieldDiagram: `
(K)(K)(K) ----> [Hütchen] ----(Schuss)----> [MINITOR]
`
            },
            {
              name: 'Koordination & Motorik',
              durationMinutes: 5,
              title: 'Sprungkombination mit Torjubel',
              organization: '2 Minihürden vor der Schusslinie.',
              drillRules: 'Doppelsprung über Minihürden, sofortiges Abbremsen und gezielter Stoß auf den Ball.',
              coachingPoints: ['Stabiles Standbein', 'Dynamische Landung'],
              sourceUrl: 'https://www.soccerdrills.de/themen/koordination/kinder-bewegungslandschaften/',
              fieldDiagram: `
(K) --> /\\  /\\ --> [Ball] --> [TOR]
`
            },
            {
              name: 'Hauptteil',
              durationMinutes: 20,
              title: 'Torschuss-Feuerwerk auf Jugendtor mit Torwart',
              organization: '2 Jugendtore. 8-10 Kinder pro Tor. Rotierender Torwart alle 3 Minuten.',
              drillRules: 'Trainer oder Mitspieler rollt den Ball leicht schräg an. Kind läuft an und schließt mit max. 2 Kontakten ab.',
              coachingPoints: ['Standbein neben den Ball (ca. 20 cm Abstand)', 'Körper über den Ball beugen', 'Blick kurz auf die Torecke'],
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
              organization: '1 großes Feld 35x25m. 2 Teams 5vs5, Wechselspieler an der Seite.',
              drillRules: 'Echtes 5-gegen-5 nach DFB-Kinderspielform. Alle Kinder greifen an, alle verteidigen.',
              coachingPoints: ['Schneller Abschluss sobald eine Lücke da ist', 'Rebound: Auf Abpraller lauern!'],
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
              organization: 'Feld 25x20m. Alle Kinder dribbeln frei.',
              drillRules: 'Wer schafft 50 Ballkontakte in 60 Sekunden? Trainer zählt laut mit.',
              coachingPoints: ['Beide Füße einsetzen', 'Freude an der Ballberührung'],
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
              organization: '4 Teams à 4-5 Kinder an der Grundlinie.',
              drillRules: 'Auf Ruf sprintet das erste Kind um die Farbe und klatscht den Nächsten ab.',
              coachingPoints: ['Schneller Start', 'Teamgeist anfeuern'],
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
              organization: '2 Felder à 20x15m mit je 2 Minitoren.',
              drillRules: '3 Angreifer spielen gegen 2 Verteidiger. Verteidiger dürfen bei Ballgewinn sofort auf die Gegentore kontern.',
              coachingPoints: ['Schneller Pass zum freien Mitspieler', 'Zielstrebiger Torschuss'],
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
              organization: '2 Felder nebeneinander. Feste 3er-Teams, faire Rotation alle 2 Minuten.',
              drillRules: '7 Runden à 3,5 Minuten. Alle Teams spielen gegeneinander. Kein Tabellendruck, Fokus auf Tore & Spaß!',
              coachingPoints: ['Faires Miteinander', 'Jedes Kind spielt mindestens 70% der Gesamtzeit'],
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

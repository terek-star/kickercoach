/**
 * pitch-renderer.js
 * Vektor-Taktiktafel (2D SVG Pitch Engine) für KickerCoach
 * 
 * Rendert gestochen scharfe, professionelle Fußball-Übungsaufbauten
 * mit Rasenstreifen, Minitoren, Großtoren, Hütchen, Spielern, Bällen
 * und taktischen Bewegungspfeilen (Dribbling, Pässe, Laufwege, Torschuss).
 */

const pitchRenderer = {
  // ViewBox Abmessungen
  width: 600,
  height: 380,

  /**
   * Generiert eine vollständige SVG-Taktiktafel für eine Übung
   * @param {Object} drill - Übungsobjekt (aus TrainingUnit oder soccerdrillsCatalog)
   * @param {Object} options - Anzeigeoptionen
   */
  renderPitch(drill, options = {}) {
    const layout = this.detectOrGetLayout(drill, options);
    const svgContent = this.buildSvgElements(layout);

    return `
      <div class="pitch-tactics-board" data-drill-id="${drill.id || ''}">
        <svg viewBox="0 0 ${this.width} ${this.height}" class="pitch-svg-canvas" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
          ${this.getDefs()}
          ${this.getPitchBackground(layout.pitchType)}
          ${svgContent}
        </svg>
        ${this.getLegend(layout)}
      </div>
    `;
  },

  /**
   * Gemeinsame SVG-Definitionen (Pfeilspitzen, Muster, Schatten)
   */
  getDefs() {
    return `
      <defs>
        <!-- Rasenstreifen-Muster -->
        <pattern id="grass-stripes" width="60" height="380" patternUnits="userSpaceOnUse">
          <rect x="0" y="0" width="30" height="380" fill="#135230" />
          <rect x="30" y="0" width="30" height="380" fill="#165d37" />
        </pattern>

        <!-- Pfeilspitzen für taktische Pfeile -->
        <marker id="arrow-run" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 8 5 L 0 9 z" fill="#f8fafc" />
        </marker>
        <marker id="arrow-pass" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 8 5 L 0 9 z" fill="#00d2ff" />
        </marker>
        <marker id="arrow-dribble" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 8 5 L 0 9 z" fill="#f59e0b" />
        </marker>
        <marker id="arrow-shot" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 1 L 9 5 L 0 9 z" fill="#ef4444" />
        </marker>

        <!-- Tornetz-Muster -->
        <pattern id="goal-net" width="6" height="6" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill="rgba(255,255,255,0.05)" />
          <path d="M 0 0 L 6 6 M 6 0 L 0 6" stroke="rgba(255,255,255,0.4)" stroke-width="0.75" />
        </pattern>

        <!-- Schattenfilter -->
        <filter id="drop-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="1" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.6"/>
        </filter>
        <filter id="glow-shot" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="#ef4444" flood-opacity="0.8"/>
        </filter>
      </defs>
    `;
  },

  /**
   * Zeichnet das Spielfeld mit Markierungen
   */
  getPitchBackground(pitchType = 'standard') {
    const pad = 16;
    const w = this.width - (pad * 2);
    const h = this.height - (pad * 2);

    let extraLines = '';

    if (pitchType === 'funino' || pitchType === 'minifootball') {
      // 6-Meter Schusszonen
      const zoneLeft = pad + 90;
      const zoneRight = this.width - pad - 90;
      extraLines = `
        <!-- Schusszonen Funino -->
        <line x1="${zoneLeft}" y1="${pad}" x2="${zoneLeft}" y2="${this.height - pad}" stroke="rgba(255,255,255,0.45)" stroke-width="2" stroke-dasharray="6,6" />
        <line x1="${zoneRight}" y1="${pad}" x2="${zoneRight}" y2="${this.height - pad}" stroke="rgba(255,255,255,0.45)" stroke-width="2" stroke-dasharray="6,6" />
        <text x="${(pad + zoneLeft) / 2}" y="${pad + 18}" fill="rgba(255,255,255,0.5)" font-size="10" font-weight="700" text-anchor="middle" font-family="sans-serif">SCHUSSZONE</text>
        <text x="${(zoneRight + this.width - pad) / 2}" y="${pad + 18}" fill="rgba(255,255,255,0.5)" font-size="10" font-weight="700" text-anchor="middle" font-family="sans-serif">SCHUSSZONE</text>
      `;
    } else {
      // Klassische Mittellinie & Mittelkreis
      extraLines = `
        <line x1="${this.width / 2}" y1="${pad}" x2="${this.width / 2}" y2="${this.height - pad}" stroke="rgba(255,255,255,0.4)" stroke-width="2" />
        <circle cx="${this.width / 2}" cy="${this.height / 2}" r="45" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2" />
        <circle cx="${this.width / 2}" cy="${this.height / 2}" r="3" fill="rgba(255,255,255,0.6)" />
      `;
    }

    return `
      <!-- Rasenfläche mit Streifen -->
      <rect x="0" y="0" width="${this.width}" height="${this.height}" rx="12" fill="url(#grass-stripes)" />
      
      <!-- Äußere Spielfeldumrandung -->
      <rect x="${pad}" y="${pad}" width="${w}" height="${h}" rx="6" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2.5" />
      
      ${extraLines}
    `;
  },

  /**
   * Intelligenter Layout-Detektor:
   * Ermittelt aus Einheit, Phase, Titel, Schwerpunkt und Beschreibung
   * die passende, abwechslungsreiche Taktik-Visualisierung
   */
  detectOrGetLayout(drill, options = {}) {
    if (drill.tacticsLayout) return drill.tacticsLayout;

    const t = (drill.title || '').toLowerCase();
    const d = (drill.drillRules || drill.organization || drill.description || '').toLowerCase();
    const f = (options.unitFocus || drill.focus || drill.focusTheme || '').toLowerCase();
    const p = (drill.name || drill.phase || '').toLowerCase();
    const uNum = parseInt(options.unitNumber, 10) || 1;
    const phaseIdx = options.phaseIndex !== undefined ? options.phaseIndex : -1;

    // 1. SPIELFORMEN & FUNINO (Phase 4 / Abschlussspiel)
    if (phaseIdx === 3 || p.includes('spiel') || p.includes('funino') || p.includes('abschluss') || t.includes('festival') || d.includes('4 minitore')) {
      const variant = (uNum - 1) % 4;
      if (t.includes('joker') || t.includes('kaiser') || variant === 1) {
        return this.getFuninoJokerLayout();
      }
      if (t.includes('diagonal') || variant === 2) {
        return this.getFuninoDiagonaltoreLayout();
      }
      if (t.includes('festival') || t.includes('kombi') || variant === 3) {
        return this.getFuninoFestivalLayout();
      }
      return this.getFuninoStandardLayout();
    }

    // 2. KOORDINATION & MOTORIK (Phase 2)
    if (phaseIdx === 1 || p.includes('koord') || p.includes('motorik') || t.includes('parcours') || d.includes('reifen') || d.includes('stangen') || d.includes('hürden')) {
      const variant = (uNum - 1) % 4;
      if (t.includes('stange') || t.includes('slalom') || variant === 1) {
        return this.getCoordinationSlalomParcoursLayout();
      }
      if (t.includes('kreuz') || t.includes('viereck') || variant === 2) {
        return this.getCoordinationKreuzLayout();
      }
      if (t.includes('sprint') || t.includes('antritt') || variant === 3) {
        return this.getCoordinationHuerdenSprintLayout();
      }
      return this.getCoordinationReifenHuerdenLayout();
    }

    // 3. HAUPTTEIL (Phase 3)
    if (phaseIdx === 2 || p.includes('haupt')) {
      const variant = (uNum - 1) % 3;

      // A. Torschuss & Schusstechnik
      if (f.includes('schuss') || f.includes('torschuss') || t.includes('schuss') || t.includes('torschuss') || d.includes('jugendtor') || d.includes('torhüter') || d.includes('spannstoß')) {
        if (variant === 1 || t.includes('konter') || t.includes('doppel')) return this.getShootingDoppelStationLayout();
        if (variant === 2 || t.includes('kombination') || t.includes('zusammenspiel')) return this.getShootingKombinationLayout();
        return this.getShootingJugendtorLayout();
      }

      // B. Passspiel & Kombination
      if (f.includes('pass') || t.includes('pass') || d.includes('pass') || d.includes('zuspiel')) {
        if (variant === 1 || t.includes('doppelpass') || t.includes('wand')) return this.getPassingDoppelpassLayout();
        if (variant === 2 || t.includes('raute')) return this.getPassingRauteLayout();
        return this.getPassingDreieckeLayout();
      }

      // C. 1-gegen-1 / Zweikampf
      if (f.includes('1vs1') || f.includes('1-gegen-1') || f.includes('zweikampf') || t.includes('1-gegen-1') || t.includes('1vs1') || t.includes('duell')) {
        if (variant === 1 || t.includes('seitlich')) return this.getOneVsOneSeitlichLayout();
        if (variant === 2 || t.includes('umschalten')) return this.getOneVsOneDoppelDuellLayout();
        return this.getOneVsOneFrontalLayout();
      }

      // D. Dribbling & Ballführung
      if (variant === 1 || t.includes('slalom')) return this.getDribblingSlalomKonterLayout();
      if (variant === 2 || t.includes('zone')) return this.getDribblingZonenLayout();
      return this.getDribblingHütchentoreLayout();
    }

    // 4. AUFWÄRMEN & FANGSPIELE (Phase 1)
    const variant = (uNum - 1) % 4;
    if (t.includes('fuchs') || t.includes('fänger') || t.includes('hasen') || variant === 1) {
      return this.getWarmupFangspielLayout();
    }
    if (t.includes('farbe') || t.includes('eck') || variant === 2) {
      return this.getWarmupFarbenEckenLayout();
    }
    if (t.includes('insel') || t.includes('rettung') || variant === 3) {
      return this.getWarmupInselLayout();
    }
    return this.getWarmupHütchenwaldLayout();
  },

  // ==================== PHASE 1: AUFWÄRM-LAYOUTS ====================

  getWarmupHütchenwaldLayout() {
    return {
      pitchType: 'standard',
      goals: [],
      players: [
        { x: 120, y: 80, team: 'blue', label: 'K1' },
        { x: 220, y: 150, team: 'blue', label: 'K2' },
        { x: 160, y: 280, team: 'blue', label: 'K3' },
        { x: 340, y: 90, team: 'blue', label: 'K4' },
        { x: 460, y: 180, team: 'blue', label: 'K5' },
        { x: 380, y: 290, team: 'blue', label: 'K6' },
        { x: 280, y: 200, team: 'red', label: 'F' }
      ],
      balls: [
        { x: 135, y: 85 },
        { x: 235, y: 155 },
        { x: 175, y: 285 },
        { x: 355, y: 95 },
        { x: 475, y: 185 },
        { x: 395, y: 295 }
      ],
      cones: [
        { x: 80, y: 40, color: 'yellow' },
        { x: 520, y: 40, color: 'yellow' },
        { x: 80, y: 340, color: 'yellow' },
        { x: 520, y: 340, color: 'yellow' },
        { x: 270, y: 70, color: 'blue' },
        { x: 400, y: 130, color: 'red' },
        { x: 130, y: 190, color: 'red' },
        { x: 230, y: 240, color: 'yellow' },
        { x: 450, y: 260, color: 'yellow' }
      ],
      arrows: [
        { type: 'dribble', points: [[135, 85], [170, 130], [215, 90]] },
        { type: 'run', from: [280, 200], to: [235, 170] }
      ]
    };
  },

  getWarmupFangspielLayout() {
    return {
      pitchType: 'standard',
      goals: [],
      players: [
        { x: 90, y: 100, team: 'blue', label: 'A1' },
        { x: 90, y: 200, team: 'blue', label: 'A2' },
        { x: 90, y: 300, team: 'blue', label: 'A3' },
        { x: 300, y: 140, team: 'red', label: 'F1' },
        { x: 300, y: 260, team: 'red', label: 'F2' },
        { x: 500, y: 190, team: 'blue', label: 'A4' }
      ],
      balls: [
        { x: 105, y: 100 },
        { x: 105, y: 200 },
        { x: 105, y: 300 },
        { x: 515, y: 190 }
      ],
      cones: [
        { x: 300, y: 40, color: 'yellow' },
        { x: 300, y: 340, color: 'yellow' },
        { x: 20, y: 40, color: 'blue' },
        { x: 580, y: 40, color: 'blue' }
      ],
      arrows: [
        { type: 'dribble', points: [[105, 100], [200, 120], [280, 80], [450, 100]] },
        { type: 'dribble', points: [[105, 300], [200, 280], [280, 320], [450, 300]] },
        { type: 'run', from: [300, 140], to: [220, 125] }
      ]
    };
  },

  getWarmupFarbenEckenLayout() {
    return {
      pitchType: 'standard',
      goals: [],
      players: [
        { x: 270, y: 170, team: 'blue', label: 'K1' },
        { x: 330, y: 170, team: 'blue', label: 'K2' },
        { x: 270, y: 210, team: 'blue', label: 'K3' },
        { x: 330, y: 210, team: 'blue', label: 'K4' }
      ],
      balls: [
        { x: 285, y: 170 },
        { x: 345, y: 170 },
        { x: 285, y: 210 },
        { x: 345, y: 210 }
      ],
      cones: [
        // Ecke oben links (Gelb)
        { x: 60, y: 50, color: 'yellow' },
        { x: 110, y: 50, color: 'yellow' },
        // Ecke oben rechts (Rot)
        { x: 490, y: 50, color: 'red' },
        { x: 540, y: 50, color: 'red' },
        // Ecke unten links (Blau)
        { x: 60, y: 330, color: 'blue' },
        { x: 110, y: 330, color: 'blue' },
        // Ecke unten rechts (Grün/Gelb)
        { x: 490, y: 330, color: 'yellow' },
        { x: 540, y: 330, color: 'yellow' }
      ],
      arrows: [
        { type: 'dribble', points: [[285, 170], [180, 110], [90, 65]] },
        { type: 'dribble', points: [[345, 170], [420, 110], [510, 65]] },
        { type: 'dribble', points: [[285, 210], [180, 270], [90, 315]] },
        { type: 'dribble', points: [[345, 210], [420, 270], [510, 315]] }
      ]
    };
  },

  getWarmupInselLayout() {
    return {
      pitchType: 'standard',
      goals: [],
      players: [
        { x: 110, y: 120, team: 'blue', label: 'K1' },
        { x: 230, y: 270, team: 'blue', label: 'K2' },
        { x: 430, y: 110, team: 'blue', label: 'K3' },
        { x: 460, y: 270, team: 'blue', label: 'K4' },
        { x: 290, y: 190, team: 'red', label: 'F' }
      ],
      balls: [
        { x: 125, y: 120 },
        { x: 245, y: 270 },
        { x: 445, y: 110 },
        { x: 475, y: 270 }
      ],
      rings: [
        { x: 170, y: 90 },
        { x: 150, y: 290 },
        { x: 380, y: 80 },
        { x: 390, y: 290 }
      ],
      cones: [
        { x: 40, y: 40, color: 'yellow' },
        { x: 560, y: 40, color: 'yellow' },
        { x: 40, y: 340, color: 'yellow' },
        { x: 560, y: 340, color: 'yellow' }
      ],
      arrows: [
        { type: 'dribble', points: [[125, 120], [150, 100], [170, 90]] },
        { type: 'run', from: [290, 190], to: [200, 120] }
      ]
    };
  },

  // ==================== PHASE 2: KOORDINATION & MOTORIK ====================

  getCoordinationReifenHuerdenLayout() {
    return {
      pitchType: 'standard',
      goals: [],
      players: [
        { x: 60, y: 110, team: 'blue', label: 'K1' },
        { x: 30, y: 110, team: 'blue', label: 'K2' },
        { x: 60, y: 260, team: 'blue', label: 'K3' },
        { x: 30, y: 260, team: 'blue', label: 'K4' }
      ],
      balls: [{ x: 75, y: 260 }],
      cones: [
        { x: 520, y: 110, color: 'red' },
        { x: 520, y: 260, color: 'red' }
      ],
      rings: [
        { x: 140, y: 110 },
        { x: 180, y: 110 },
        { x: 220, y: 110 },
        { x: 260, y: 110 }
      ],
      hurdles: [
        { x: 330, y: 110 },
        { x: 380, y: 110 },
        { x: 430, y: 110 }
      ],
      poles: [
        { x: 160, y: 260 },
        { x: 220, y: 235 },
        { x: 280, y: 275 },
        { x: 340, y: 240 },
        { x: 400, y: 265 }
      ],
      arrows: [
        { type: 'run', from: [75, 110], to: [510, 110] },
        { type: 'dribble', points: [[75, 260], [160, 275], [220, 230], [280, 280], [340, 235], [400, 275], [510, 260]] }
      ]
    };
  },

  getCoordinationSlalomParcoursLayout() {
    return {
      pitchType: 'standard',
      goals: [],
      players: [
        { x: 60, y: 120, team: 'blue', label: 'K1' },
        { x: 30, y: 120, team: 'blue', label: 'K2' },
        { x: 60, y: 260, team: 'blue', label: 'K3' },
        { x: 30, y: 260, team: 'blue', label: 'K4' }
      ],
      balls: [{ x: 75, y: 120 }],
      poles: [
        { x: 140, y: 90 },
        { x: 200, y: 140 },
        { x: 260, y: 90 },
        { x: 320, y: 140 },
        { x: 380, y: 90 },
        { x: 440, y: 140 }
      ],
      hurdles: [
        { x: 170, y: 260 },
        { x: 240, y: 260 },
        { x: 320, y: 260 },
        { x: 400, y: 260 }
      ],
      rings: [
        { x: 470, y: 260 },
        { x: 510, y: 260 }
      ],
      cones: [
        { x: 520, y: 115, color: 'yellow' }
      ],
      arrows: [
        { type: 'dribble', points: [[75, 120], [140, 115], [200, 110], [260, 115], [320, 110], [380, 115], [440, 110], [510, 115]] },
        { type: 'run', from: [75, 260], to: [530, 260] }
      ]
    };
  },

  getCoordinationKreuzLayout() {
    return {
      pitchType: 'standard',
      goals: [],
      players: [
        { x: 140, y: 190, team: 'blue', label: 'K1' },
        { x: 100, y: 190, team: 'blue', label: 'K2' },
        { x: 140, y: 230, team: 'blue', label: 'K3' }
      ],
      balls: [{ x: 155, y: 190 }],
      rings: [
        // Koordinations-Kreuz im Zentrum
        { x: 300, y: 190 }, // Mitte
        { x: 300, y: 140 }, // Oben
        { x: 300, y: 240 }, // Unten
        { x: 250, y: 190 }, // Links
        { x: 350, y: 190 }  // Rechts
      ],
      cones: [
        // Sprint-Ziele in 4 Richtungen
        { x: 300, y: 60, color: 'red' },
        { x: 300, y: 320, color: 'red' },
        { x: 480, y: 130, color: 'blue' },
        { x: 480, y: 250, color: 'yellow' }
      ],
      hurdles: [
        { x: 410, y: 130 },
        { x: 410, y: 250 }
      ],
      arrows: [
        { type: 'run', from: [155, 190], to: [240, 190] },
        { type: 'run', from: [300, 190], to: [300, 75] },
        { type: 'dribble', points: [[300, 190], [360, 200], [405, 240], [470, 250]] }
      ]
    };
  },

  getCoordinationHuerdenSprintLayout() {
    return {
      pitchType: 'standard',
      goals: [
        { type: 'mini', x: 550, y: 90, dir: 'left', label: 'Tor 1' },
        { type: 'mini', x: 550, y: 270, dir: 'left', label: 'Tor 2' }
      ],
      players: [
        { x: 70, y: 90, team: 'blue', label: 'K1' },
        { x: 30, y: 90, team: 'blue', label: 'K2' },
        { x: 70, y: 270, team: 'blue', label: 'K3' },
        { x: 30, y: 270, team: 'blue', label: 'K4' }
      ],
      balls: [
        { x: 85, y: 90 },
        { x: 85, y: 270 }
      ],
      hurdles: [
        { x: 160, y: 90 },
        { x: 230, y: 90 },
        { x: 300, y: 90 },
        { x: 160, y: 270 },
        { x: 230, y: 270 },
        { x: 300, y: 270 }
      ],
      cones: [
        { x: 380, y: 90, color: 'yellow' },
        { x: 380, y: 270, color: 'yellow' }
      ],
      arrows: [
        { type: 'run', from: [85, 90], to: [370, 90] },
        { type: 'shot', from: [390, 90], to: [540, 90] },
        { type: 'dribble', points: [[85, 270], [300, 270], [370, 270]] },
        { type: 'shot', from: [390, 270], to: [540, 270] }
      ]
    };
  },

  // ==================== PHASE 3: HAUPTTEIL-LAYOUTS ====================

  getShootingJugendtorLayout() {
    return {
      pitchType: 'half',
      goals: [
        { type: 'youth', x: 550, y: 130, dir: 'left', label: 'Jugendtor' },
        { type: 'mini', x: 20, y: 65, dir: 'right', label: 'Konter' },
        { type: 'mini', x: 20, y: 275, dir: 'right', label: 'Konter' }
      ],
      players: [
        { x: 535, y: 190, team: 'keeper', label: 'TW' },
        { x: 110, y: 130, team: 'blue', label: 'A1' },
        { x: 70, y: 130, team: 'blue', label: 'A2' },
        { x: 110, y: 250, team: 'blue', label: 'B1' },
        { x: 70, y: 250, team: 'blue', label: 'B2' },
        { x: 270, y: 90, team: 'trainer', label: 'Tr' }
      ],
      balls: [
        { x: 125, y: 130 },
        { x: 85, y: 130 },
        { x: 125, y: 250 },
        { x: 255, y: 100 }
      ],
      cones: [
        { x: 370, y: 120, color: 'red' },
        { x: 370, y: 260, color: 'red' },
        { x: 200, y: 130, color: 'yellow' },
        { x: 200, y: 250, color: 'yellow' }
      ],
      arrows: [
        { type: 'pass', from: [260, 105], to: [340, 150] },
        { type: 'run', from: [125, 130], to: [345, 150] },
        { type: 'shot', from: [355, 155], to: [540, 160] },
        { type: 'dribble', points: [[125, 250], [200, 250], [330, 230]] },
        { type: 'shot', from: [340, 230], to: [540, 210] }
      ]
    };
  },

  getShootingDoppelStationLayout() {
    return {
      pitchType: 'half',
      goals: [
        { type: 'youth', x: 550, y: 130, dir: 'left', label: 'Jugendtor' },
        { type: 'mini', x: 440, y: 40, dir: 'down', label: 'Rebound L' },
        { type: 'mini', x: 440, y: 310, dir: 'up', label: 'Rebound R' }
      ],
      players: [
        { x: 535, y: 190, team: 'keeper', label: 'TW' },
        { x: 120, y: 120, team: 'blue', label: 'A1' },
        { x: 120, y: 260, team: 'red', label: 'B1' },
        { x: 290, y: 190, team: 'trainer', label: 'Tr' }
      ],
      balls: [
        { x: 135, y: 120 },
        { x: 135, y: 260 },
        { x: 275, y: 190 }
      ],
      cones: [
        { x: 240, y: 120, color: 'yellow' },
        { x: 240, y: 260, color: 'yellow' },
        { x: 380, y: 190, color: 'red' }
      ],
      arrows: [
        { type: 'pass', from: [280, 190], to: [230, 130] },
        { type: 'shot', from: [250, 120], to: [535, 160] },
        { type: 'dribble', points: [[135, 260], [220, 260], [330, 220]] },
        { type: 'shot', from: [340, 220], to: [535, 210] }
      ]
    };
  },

  getShootingKombinationLayout() {
    return {
      pitchType: 'half',
      goals: [
        { type: 'youth', x: 550, y: 130, dir: 'left', label: 'Jugendtor' }
      ],
      players: [
        { x: 535, y: 190, team: 'keeper', label: 'TW' },
        { x: 110, y: 190, team: 'blue', label: 'A1' },
        { x: 60, y: 190, team: 'blue', label: 'A2' },
        { x: 330, y: 130, team: 'blue', label: 'Wand' }
      ],
      balls: [
        { x: 125, y: 190 },
        { x: 75, y: 190 }
      ],
      cones: [
        { x: 220, y: 190, color: 'yellow' },
        { x: 220, y: 150, color: 'yellow' },
        { x: 390, y: 190, color: 'red' }
      ],
      arrows: [
        { type: 'pass', from: [125, 190], to: [320, 140] },
        { type: 'run', from: [125, 190], to: [380, 200] },
        { type: 'pass', from: [330, 140], to: [380, 200] },
        { type: 'shot', from: [390, 200], to: [540, 190] }
      ]
    };
  },

  getPassingDreieckeLayout() {
    return {
      pitchType: 'standard',
      goals: [
        { type: 'mini', x: 550, y: 160, dir: 'left', label: 'Tor' }
      ],
      players: [
        { x: 140, y: 270, team: 'blue', label: 'A' },
        { x: 280, y: 100, team: 'blue', label: 'B' },
        { x: 420, y: 270, team: 'blue', label: 'C' }
      ],
      balls: [{ x: 155, y: 260 }],
      cones: [
        { x: 140, y: 290, color: 'yellow' },
        { x: 280, y: 80, color: 'yellow' },
        { x: 420, y: 290, color: 'yellow' }
      ],
      arrows: [
        { type: 'pass', from: [155, 260], to: [270, 115] },
        { type: 'pass', from: [285, 115], to: [410, 260] },
        { type: 'run', from: [140, 270], to: [270, 100] },
        { type: 'shot', from: [425, 260], to: [540, 190] }
      ]
    };
  },

  getPassingDoppelpassLayout() {
    return {
      pitchType: 'standard',
      goals: [
        { type: 'mini', x: 550, y: 190, dir: 'left', label: 'Tor' }
      ],
      players: [
        { x: 100, y: 190, team: 'blue', label: 'A1' },
        { x: 50, y: 190, team: 'blue', label: 'A2' },
        { x: 280, y: 110, team: 'blue', label: 'Wand' }
      ],
      balls: [{ x: 115, y: 190 }],
      cones: [
        { x: 280, y: 180, color: 'yellow' },
        { x: 280, y: 220, color: 'yellow' },
        { x: 420, y: 190, color: 'red' }
      ],
      arrows: [
        { type: 'pass', from: [115, 190], to: [270, 125] },
        { type: 'run', from: [115, 190], to: [390, 190] },
        { type: 'pass', from: [285, 125], to: [390, 190] },
        { type: 'shot', from: [400, 190], to: [540, 190] }
      ]
    };
  },

  getPassingRauteLayout() {
    return {
      pitchType: 'standard',
      goals: [],
      players: [
        { x: 140, y: 190, team: 'blue', label: 'A' },
        { x: 300, y: 90, team: 'blue', label: 'B' },
        { x: 460, y: 190, team: 'blue', label: 'C' },
        { x: 300, y: 290, team: 'blue', label: 'D' }
      ],
      balls: [{ x: 155, y: 190 }],
      cones: [
        { x: 140, y: 210, color: 'blue' },
        { x: 300, y: 70, color: 'blue' },
        { x: 460, y: 210, color: 'blue' },
        { x: 300, y: 310, color: 'blue' }
      ],
      arrows: [
        { type: 'pass', from: [155, 190], to: [290, 100] },
        { type: 'pass', from: [310, 100], to: [450, 185] },
        { type: 'pass', from: [450, 195], to: [310, 280] },
        { type: 'pass', from: [290, 285], to: [155, 195] },
        { type: 'run', from: [140, 190], to: [290, 95] }
      ]
    };
  },

  getOneVsOneFrontalLayout() {
    return {
      pitchType: 'standard',
      goals: [
        { type: 'mini', x: 550, y: 80, dir: 'left', label: 'Tor L' },
        { type: 'mini', x: 550, y: 260, dir: 'left', label: 'Tor R' }
      ],
      players: [
        { x: 120, y: 190, team: 'blue', label: 'A' },
        { x: 380, y: 190, team: 'red', label: 'V' }
      ],
      balls: [{ x: 135, y: 190 }],
      cones: [
        { x: 240, y: 140, color: 'blue' },
        { x: 240, y: 240, color: 'blue' }
      ],
      arrows: [
        { type: 'dribble', points: [[135, 190], [220, 190], [270, 150], [350, 110]] },
        { type: 'run', from: [380, 190], to: [320, 160] },
        { type: 'shot', from: [350, 110], to: [540, 85] }
      ]
    };
  },

  getOneVsOneSeitlichLayout() {
    return {
      pitchType: 'standard',
      goals: [
        { type: 'mini', x: 550, y: 190, dir: 'left', label: 'Zieltor' },
        { type: 'mini', x: 30, y: 190, dir: 'right', label: 'Konter' }
      ],
      players: [
        { x: 100, y: 80, team: 'blue', label: 'A' },
        { x: 100, y: 300, team: 'red', label: 'V' }
      ],
      balls: [{ x: 115, y: 80 }],
      cones: [
        { x: 260, y: 80, color: 'yellow' },
        { x: 260, y: 300, color: 'yellow' },
        { x: 360, y: 190, color: 'red' }
      ],
      arrows: [
        { type: 'dribble', points: [[115, 80], [250, 120], [330, 160]] },
        { type: 'run', from: [100, 300], to: [280, 220], to: [330, 180] },
        { type: 'shot', from: [350, 160], to: [540, 190] }
      ]
    };
  },

  getOneVsOneDoppelDuellLayout() {
    return {
      pitchType: 'standard',
      goals: [
        { type: 'mini', x: 550, y: 90, dir: 'left', label: 'Tor 1' },
        { type: 'mini', x: 550, y: 270, dir: 'left', label: 'Tor 2' }
      ],
      players: [
        { x: 100, y: 140, team: 'blue', label: 'A1' },
        { x: 100, y: 240, team: 'blue', label: 'A2' },
        { x: 350, y: 190, team: 'red', label: 'V' }
      ],
      balls: [{ x: 115, y: 140 }],
      cones: [
        { x: 220, y: 190, color: 'blue' },
        { x: 440, y: 190, color: 'yellow' }
      ],
      arrows: [
        { type: 'dribble', points: [[115, 140], [200, 150]] },
        { type: 'pass', from: [200, 150], to: [320, 240] },
        { type: 'run', from: [100, 240], to: [320, 240] },
        { type: 'shot', from: [330, 240], to: [540, 270] }
      ]
    };
  },

  getDribblingHütchentoreLayout() {
    return {
      pitchType: 'standard',
      goals: [],
      players: [
        { x: 90, y: 120, team: 'blue', label: '1' },
        { x: 90, y: 260, team: 'blue', label: '2' },
        { x: 290, y: 190, team: 'blue', label: '3' },
        { x: 490, y: 110, team: 'blue', label: '4' },
        { x: 490, y: 270, team: 'blue', label: '5' }
      ],
      balls: [
        { x: 105, y: 125 },
        { x: 105, y: 265 },
        { x: 305, y: 195 },
        { x: 475, y: 115 },
        { x: 475, y: 275 }
      ],
      cones: [
        { x: 170, y: 80, color: 'yellow' },
        { x: 170, y: 140, color: 'yellow' },
        { x: 170, y: 240, color: 'red' },
        { x: 170, y: 300, color: 'red' },
        { x: 270, y: 130, color: 'blue' },
        { x: 330, y: 130, color: 'blue' },
        { x: 270, y: 250, color: 'blue' },
        { x: 330, y: 250, color: 'blue' },
        { x: 430, y: 80, color: 'yellow' },
        { x: 430, y: 140, color: 'yellow' },
        { x: 430, y: 240, color: 'red' },
        { x: 430, y: 300, color: 'red' }
      ],
      arrows: [
        { type: 'dribble', points: [[105, 125], [170, 110], [230, 160]] },
        { type: 'dribble', points: [[105, 265], [170, 270], [230, 220]] },
        { type: 'dribble', points: [[305, 195], [360, 150], [430, 110]] },
        { type: 'dribble', points: [[475, 275], [430, 270], [360, 270]] }
      ]
    };
  },

  getDribblingSlalomKonterLayout() {
    return {
      pitchType: 'standard',
      goals: [
        { type: 'mini', x: 550, y: 90, dir: 'left', label: 'Tor 1' },
        { type: 'mini', x: 550, y: 270, dir: 'left', label: 'Tor 2' }
      ],
      players: [
        { x: 80, y: 190, team: 'blue', label: 'A1' },
        { x: 40, y: 190, team: 'blue', label: 'A2' }
      ],
      balls: [{ x: 95, y: 190 }],
      poles: [
        { x: 180, y: 160 },
        { x: 240, y: 220 },
        { x: 300, y: 160 },
        { x: 360, y: 220 },
        { x: 420, y: 190 }
      ],
      cones: [
        { x: 470, y: 120, color: 'yellow' },
        { x: 470, y: 260, color: 'yellow' }
      ],
      arrows: [
        { type: 'dribble', points: [[95, 190], [180, 185], [240, 195], [300, 185], [360, 195], [420, 190], [460, 130]] },
        { type: 'shot', from: [470, 125], to: [540, 95] }
      ]
    };
  },

  getDribblingZonenLayout() {
    return {
      pitchType: 'standard',
      goals: [],
      players: [
        { x: 80, y: 90, team: 'blue', label: 'Z1' },
        { x: 80, y: 190, team: 'blue', label: 'Z2' },
        { x: 80, y: 290, team: 'blue', label: 'Z3' }
      ],
      balls: [
        { x: 95, y: 90 },
        { x: 95, y: 190 },
        { x: 95, y: 290 }
      ],
      cones: [
        // Trennlinien der 3 Zonen
        { x: 220, y: 40, color: 'yellow' },
        { x: 220, y: 340, color: 'yellow' },
        { x: 400, y: 40, color: 'red' },
        { x: 400, y: 340, color: 'red' }
      ],
      arrows: [
        { type: 'dribble', points: [[95, 90], [200, 90], [280, 80], [380, 90], [510, 90]] },
        { type: 'dribble', points: [[95, 190], [180, 175], [240, 205], [320, 180], [480, 190]] },
        { type: 'dribble', points: [[95, 290], [200, 290], [350, 300], [510, 290]] }
      ]
    };
  },

  // ==================== PHASE 4: SPIELFORMEN & FUNINO ====================

  getFuninoStandardLayout() {
    return {
      pitchType: 'funino',
      goals: [
        { type: 'mini', x: 22, y: 55, dir: 'right', label: 'Tor 1' },
        { type: 'mini', x: 22, y: 285, dir: 'right', label: 'Tor 2' },
        { type: 'mini', x: 558, y: 55, dir: 'left', label: 'Tor 3' },
        { type: 'mini', x: 558, y: 285, dir: 'left', label: 'Tor 4' }
      ],
      players: [
        { x: 190, y: 110, team: 'blue', label: 'A1' },
        { x: 170, y: 200, team: 'blue', label: 'A2' },
        { x: 190, y: 290, team: 'blue', label: 'A3' },
        { x: 410, y: 110, team: 'red', label: 'B1' },
        { x: 430, y: 200, team: 'red', label: 'B2' },
        { x: 410, y: 290, team: 'red', label: 'B3' }
      ],
      balls: [{ x: 205, y: 195 }],
      arrows: [
        { type: 'pass', from: [190, 110], to: [175, 190] },
        { type: 'dribble', points: [[175, 200], [250, 180], [330, 230]] },
        { type: 'shot', from: [330, 230], to: [550, 285] }
      ],
      cones: []
    };
  },

  getFuninoJokerLayout() {
    return {
      pitchType: 'funino',
      goals: [
        { type: 'mini', x: 22, y: 55, dir: 'right', label: 'Tor 1' },
        { type: 'mini', x: 22, y: 285, dir: 'right', label: 'Tor 2' },
        { type: 'mini', x: 558, y: 55, dir: 'left', label: 'Tor 3' },
        { type: 'mini', x: 558, y: 285, dir: 'left', label: 'Tor 4' }
      ],
      players: [
        { x: 180, y: 120, team: 'blue', label: 'A1' },
        { x: 180, y: 260, team: 'blue', label: 'A2' },
        { x: 420, y: 120, team: 'red', label: 'B1' },
        { x: 420, y: 260, team: 'red', label: 'B2' },
        // Neutraler Joker im Zentrum
        { x: 300, y: 190, team: 'trainer', label: 'J' }
      ],
      balls: [{ x: 315, y: 190 }],
      arrows: [
        { type: 'pass', from: [180, 120], to: [290, 180] },
        { type: 'pass', from: [315, 195], to: [410, 250] },
        { type: 'shot', from: [420, 260], to: [550, 285] }
      ],
      cones: []
    };
  },

  getFuninoDiagonaltoreLayout() {
    return {
      pitchType: 'funino',
      goals: [
        { type: 'mini', x: 22, y: 55, dir: 'right', label: 'Tor Gelb' },
        { type: 'mini', x: 22, y: 285, dir: 'right', label: 'Tor Rot' },
        { type: 'mini', x: 558, y: 55, dir: 'left', label: 'Tor Rot' },
        { type: 'mini', x: 558, y: 285, dir: 'left', label: 'Tor Gelb' }
      ],
      players: [
        { x: 190, y: 140, team: 'blue', label: 'A1' },
        { x: 190, y: 240, team: 'blue', label: 'A2' },
        { x: 410, y: 140, team: 'red', label: 'B1' },
        { x: 410, y: 240, team: 'red', label: 'B2' }
      ],
      balls: [{ x: 205, y: 140 }],
      cones: [
        { x: 300, y: 190, color: 'yellow' }
      ],
      arrows: [
        // Diagonale Verlagerung
        { type: 'pass', from: [205, 140], to: [390, 230] },
        { type: 'dribble', points: [[190, 240], [250, 270], [350, 280]] },
        { type: 'shot', from: [360, 280], to: [550, 285] }
      ]
    };
  },

  getFuninoFestivalLayout() {
    return {
      pitchType: 'standard',
      goals: [
        { type: 'youth', x: 550, y: 130, dir: 'left', label: 'Großtor' },
        { type: 'mini', x: 22, y: 65, dir: 'right', label: 'Minitor 1' },
        { type: 'mini', x: 22, y: 275, dir: 'right', label: 'Minitor 2' }
      ],
      players: [
        { x: 535, y: 190, team: 'keeper', label: 'TW' },
        { x: 210, y: 120, team: 'blue', label: 'A1' },
        { x: 210, y: 260, team: 'blue', label: 'A2' },
        { x: 370, y: 140, team: 'red', label: 'B1' },
        { x: 370, y: 240, team: 'red', label: 'B2' }
      ],
      balls: [{ x: 225, y: 120 }],
      cones: [
        { x: 420, y: 40, color: 'yellow' },
        { x: 420, y: 340, color: 'yellow' }
      ],
      arrows: [
        { type: 'pass', from: [225, 120], to: [220, 240] },
        { type: 'dribble', points: [[210, 260], [290, 260], [390, 210]] },
        { type: 'shot', from: [400, 210], to: [540, 190] }
      ]
    };
  },

  // Legacy-Aliase für Rückwärtskompatibilität
  getFuninoLayout() { return this.getFuninoStandardLayout(); },
  getShootingLayout() { return this.getShootingJugendtorLayout(); },
  getOneVsOneLayout() { return this.getOneVsOneFrontalLayout(); },
  getPassingLayout() { return this.getPassingDreieckeLayout(); },
  getDribblingLayout() { return this.getDribblingHütchentoreLayout(); },
  getCoordinationLayout() { return this.getCoordinationReifenHuerdenLayout(); },
  getWarmupLayout() { return this.getWarmupHütchenwaldLayout(); },

  /**
   * Baut alle SVG-Elemente (Tore, Hütchen, Ringe, Pfeile, Spieler, Bälle) zusammen
   */
  buildSvgElements(layout) {
    let html = '';

    // 1. Zonen / Hürden / Ringe / Stangen
    if (layout.rings) {
      layout.rings.forEach(r => {
        html += `<circle cx="${r.x}" cy="${r.y}" r="12" fill="none" stroke="#38bdf8" stroke-width="3" filter="url(#drop-shadow)" />`;
      });
    }

    if (layout.hurdles) {
      layout.hurdles.forEach(h => {
        html += `
          <!-- Minihürde -->
          <g filter="url(#drop-shadow)">
            <line x1="${h.x - 10}" y1="${h.y}" x2="${h.x + 10}" y2="${h.y}" stroke="#facc15" stroke-width="4" stroke-linecap="round" />
            <circle cx="${h.x - 10}" cy="${h.y}" r="2.5" fill="#ca8a04" />
            <circle cx="${h.x + 10}" cy="${h.y}" r="2.5" fill="#ca8a04" />
          </g>
        `;
      });
    }

    if (layout.poles) {
      layout.poles.forEach(p => {
        html += `
          <!-- Slalomstange -->
          <g filter="url(#drop-shadow)">
            <circle cx="${p.x}" cy="${p.y}" r="4" fill="#ef4444" stroke="#ffffff" stroke-width="1.5" />
            <circle cx="${p.x}" cy="${p.y}" r="8" fill="rgba(239, 68, 68, 0.2)" />
          </g>
        `;
      });
    }

    // 2. Tore
    if (layout.goals) {
      layout.goals.forEach(g => {
        html += this.renderGoal(g);
      });
    }

    // 3. Markierungshütchen
    if (layout.cones) {
      layout.cones.forEach(c => {
        html += this.renderCone(c);
      });
    }

    // 4. Taktische Pfeile
    if (layout.arrows) {
      layout.arrows.forEach(a => {
        html += this.renderArrow(a);
      });
    }

    // 5. Spieler & Trainer
    if (layout.players) {
      layout.players.forEach(p => {
        html += this.renderPlayer(p);
      });
    }

    // 6. Bälle
    if (layout.balls) {
      layout.balls.forEach(b => {
        html += this.renderBall(b);
      });
    }

    return html;
  },

  /**
   * Zeichnet ein Minitor oder Großtor
   */
  renderGoal(g) {
    if (g.type === 'youth') {
      // 5vs5 Jugendtor
      return `
        <g filter="url(#drop-shadow)">
          <!-- Netz -->
          <rect x="${g.x}" y="${g.y}" width="26" height="120" rx="3" fill="url(#goal-net)" stroke="rgba(255,255,255,0.7)" stroke-width="2" />
          <!-- Pfosten & Latte -->
          <line x1="${g.x}" y1="${g.y}" x2="${g.x}" y2="${g.y + 120}" stroke="#ffffff" stroke-width="4" stroke-linecap="round" />
          <line x1="${g.x}" y1="${g.y}" x2="${g.x + 24}" y2="${g.y}" stroke="#ffffff" stroke-width="3" />
          <line x1="${g.x}" y1="${g.y + 120}" x2="${g.x + 24}" y2="${g.y + 120}" stroke="#ffffff" stroke-width="3" />
          <text x="${g.x + 13}" y="${g.y - 6}" fill="rgba(255,255,255,0.8)" font-size="9" font-weight="700" text-anchor="middle" font-family="sans-serif">JUGENDTOR</text>
        </g>
      `;
    }

    // Minitor (Funino)
    const isRight = g.dir === 'right';
    const postX = isRight ? g.x : g.x;
    const netX = isRight ? g.x - 14 : g.x + 2;

    return `
      <g filter="url(#drop-shadow)">
        <!-- Netz -->
        <rect x="${netX}" y="${g.y}" width="14" height="40" rx="2" fill="url(#goal-net)" stroke="rgba(255,255,255,0.5)" stroke-width="1.5" />
        <!-- Torlinie & Pfosten -->
        <line x1="${postX}" y1="${g.y}" x2="${postX}" y2="${g.y + 40}" stroke="#ef4444" stroke-width="3.5" stroke-linecap="round" />
        <circle cx="${postX}" cy="${g.y}" r="2" fill="#ffffff" />
        <circle cx="${postX}" cy="${g.y + 40}" r="2" fill="#ffffff" />
      </g>
    `;
  },

  /**
   * Zeichnet ein Hütchen
   */
  renderCone(c) {
    let fill = '#f59e0b'; // Gold / Gelb
    if (c.color === 'red') fill = '#ef4444';
    if (c.color === 'blue') fill = '#00d2ff';
    if (c.color === 'green') fill = '#10b981';

    return `
      <g filter="url(#drop-shadow)">
        <polygon points="${c.x},${c.y - 9} ${c.x + 8},${c.y + 5} ${c.x - 8},${c.y + 5}" fill="${fill}" stroke="#ffffff" stroke-width="0.75" />
        <ellipse cx="${c.x}" cy="${c.y + 5}" rx="7" ry="2.5" fill="${fill}" />
        <circle cx="${c.x}" cy="${c.y - 9}" r="1.5" fill="#ffffff" />
      </g>
    `;
  },

  /**
   * Zeichnet einen Spieler-Token
   */
  renderPlayer(p) {
    let bg = '#0284c7'; // Team Blau
    let border = '#38bdf8';
    let text = '#ffffff';

    if (p.team === 'red') {
      bg = '#dc2626';
      border = '#f87171';
    } else if (p.team === 'keeper') {
      bg = '#eab308';
      border = '#fef08a';
      text = '#000000';
    } else if (p.team === 'trainer') {
      bg = '#10b981';
      border = '#6ee7b7';
    }

    return `
      <g filter="url(#drop-shadow)">
        <!-- Spieler Kreis -->
        <circle cx="${p.x}" cy="${p.y}" r="12" fill="${bg}" stroke="${border}" stroke-width="2" />
        <!-- Spieler Label -->
        <text x="${p.x}" y="${p.y + 4}" fill="${text}" font-size="10" font-weight="800" text-anchor="middle" font-family="'Outfit', sans-serif">
          ${p.label || ''}
        </text>
      </g>
    `;
  },

  /**
   * Zeichnet einen Fußball
   */
  renderBall(b) {
    return `
      <g filter="url(#drop-shadow)">
        <circle cx="${b.x}" cy="${b.y}" r="7" fill="#ffffff" stroke="#000000" stroke-width="1.2" />
        <!-- Ballmuster -->
        <circle cx="${b.x}" cy="${b.y}" r="2.2" fill="#000000" />
        <path d="M ${b.x} ${b.y - 7} L ${b.x} ${b.y - 2.2} M ${b.x + 6} ${b.y + 3} L ${b.x + 1.8} ${b.y + 1.2} M ${b.x - 6} ${b.y + 3} L ${b.x - 1.8} ${b.y + 1.2}" stroke="#000000" stroke-width="1" />
      </g>
    `;
  },

  /**
   * Zeichnet taktische Pfeile (Laufweg, Pass, Dribbling, Torschuss)
   */
  renderArrow(a) {
    if (a.type === 'dribble') {
      // Geschwungene Dribbel-Wellenlinie
      let d = `M ${a.points[0][0]} ${a.points[0][1]}`;
      for (let i = 1; i < a.points.length; i++) {
        const prev = a.points[i - 1];
        const curr = a.points[i];
        const midX = (prev[0] + curr[0]) / 2;
        const midY = (prev[1] + curr[1]) / 2 + (i % 2 === 0 ? 12 : -12);
        d += ` Q ${midX} ${midY} ${curr[0]} ${curr[1]}`;
      }
      return `
        <path d="${d}" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" marker-end="url(#arrow-dribble)" filter="url(#drop-shadow)" />
      `;
    }

    if (a.type === 'pass') {
      // Gestrichelter Pass-Pfeil (Cyan)
      return `
        <line x1="${a.from[0]}" y1="${a.from[1]}" x2="${a.to[0]}" y2="${a.to[1]}" stroke="#00d2ff" stroke-width="2.5" stroke-dasharray="6,4" stroke-linecap="round" marker-end="url(#arrow-pass)" filter="url(#drop-shadow)" />
      `;
    }

    if (a.type === 'shot') {
      // Torschuss-Pfeil (Rot glühend)
      return `
        <line x1="${a.from[0]}" y1="${a.from[1]}" x2="${a.to[0]}" y2="${a.to[1]}" stroke="#ef4444" stroke-width="3" stroke-linecap="round" marker-end="url(#arrow-shot)" filter="url(#glow-shot)" />
      `;
    }

    // Normaler Laufweg (Weiß)
    return `
      <line x1="${a.from[0]}" y1="${a.from[1]}" x2="${a.to[0]}" y2="${a.to[1]}" stroke="#f8fafc" stroke-width="2" stroke-linecap="round" marker-end="url(#arrow-run)" filter="url(#drop-shadow)" />
    `;
  },

  /**
   * Kompakte, realitätsnahe Vektor-Legende unterhalb der Taktiktafel
   * Bildet exakt die gleichen Elemente ab, die auf dem Spielfeld zu sehen sind!
   */
  getLegend(layout = {}) {
    const items = [];

    const hasMiniGoal = layout.goals && layout.goals.some(g => g.type === 'mini' || !g.type);
    const hasYouthGoal = layout.goals && layout.goals.some(g => g.type === 'youth');
    const hasKeeper = layout.players && layout.players.some(p => p.team === 'keeper');
    const hasBlueTeam = layout.players && layout.players.some(p => p.team === 'blue' || !p.team);
    const hasRedTeam = layout.players && layout.players.some(p => p.team === 'red');
    const hasTrainer = layout.players && layout.players.some(p => p.team === 'trainer');
    const hasCones = layout.cones && layout.cones.length > 0;
    const hasRings = layout.rings && layout.rings.length > 0;
    const hasHurdles = layout.hurdles && layout.hurdles.length > 0;
    const hasPoles = layout.poles && layout.poles.length > 0;
    const hasBalls = layout.balls && layout.balls.length > 0;
    const hasPass = layout.arrows && layout.arrows.some(a => a.type === 'pass');
    const hasDribble = layout.arrows && layout.arrows.some(a => a.type === 'dribble');
    const hasShot = layout.arrows && layout.arrows.some(a => a.type === 'shot');
    const hasRun = layout.arrows && layout.arrows.some(a => a.type === 'run');

    // 1. Tore
    if (hasYouthGoal) {
      items.push(`
        <span class="legend-item" title="Jugendtor (5m)">
          <svg class="legend-icon-svg" width="20" height="13" viewBox="0 0 20 13">
            <rect x="2" y="1" width="16" height="11" rx="1.5" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.5)" stroke-width="1" stroke-dasharray="2,2" />
            <line x1="18" y1="1" x2="18" y2="12" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" />
            <line x1="2" y1="1" x2="18" y2="1" stroke="#ffffff" stroke-width="1.8" />
            <line x1="2" y1="12" x2="18" y2="12" stroke="#ffffff" stroke-width="1.8" />
          </svg>
          Jugendtor
        </span>
      `);
    }

    if (hasMiniGoal) {
      items.push(`
        <span class="legend-item" title="Minitor (Funino)">
          <svg class="legend-icon-svg" width="16" height="13" viewBox="0 0 16 13">
            <rect x="2" y="1" width="9" height="11" rx="1" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.4)" stroke-width="1" stroke-dasharray="2,2" />
            <line x1="11" y1="1" x2="11" y2="12" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" />
            <circle cx="11" cy="1" r="1.5" fill="#ffffff" />
            <circle cx="11" cy="12" r="1.5" fill="#ffffff" />
          </svg>
          Minitor
        </span>
      `);
    }

    // 2. Materialien & Hindernisse
    if (hasCones || (!hasHurdles && !hasRings && !hasPoles)) {
      items.push(`
        <span class="legend-item" title="Pylone / Hütchen">
          <svg class="legend-icon-svg" width="14" height="14" viewBox="0 0 16 16">
            <polygon points="8,1 15,13 1,13" fill="#f59e0b" stroke="#ffffff" stroke-width="0.75" />
            <ellipse cx="8" cy="13" rx="7" ry="2.2" fill="#f59e0b" />
            <circle cx="8" cy="1.5" r="1.2" fill="#ffffff" />
          </svg>
          Hütchen
        </span>
      `);
    }

    if (hasRings) {
      items.push(`
        <span class="legend-item" title="Koordinationsreifen">
          <svg class="legend-icon-svg" width="14" height="14" viewBox="0 0 16 16">
            <circle cx="8" cy="8" r="6" fill="none" stroke="#38bdf8" stroke-width="2.5" />
          </svg>
          Reifen
        </span>
      `);
    }

    if (hasHurdles) {
      items.push(`
        <span class="legend-item" title="Minihürde">
          <svg class="legend-icon-svg" width="18" height="12" viewBox="0 0 20 12">
            <line x1="2" y1="6" x2="18" y2="6" stroke="#facc15" stroke-width="3" stroke-linecap="round" />
            <circle cx="2" cy="6" r="2" fill="#ca8a04" />
            <circle cx="18" cy="6" r="2" fill="#ca8a04" />
          </svg>
          Minihürde
        </span>
      `);
    }

    if (hasPoles) {
      items.push(`
        <span class="legend-item" title="Slalomstange">
          <svg class="legend-icon-svg" width="14" height="14" viewBox="0 0 16 16">
            <circle cx="8" cy="8" r="6" fill="rgba(239, 68, 68, 0.25)" />
            <circle cx="8" cy="8" r="3.5" fill="#ef4444" stroke="#ffffff" stroke-width="1.2" />
          </svg>
          Slalomstange
        </span>
      `);
    }

    // 3. Personen
    if (hasKeeper) {
      items.push(`
        <span class="legend-item" title="Torhüter">
          <svg class="legend-icon-svg" width="16" height="16" viewBox="0 0 18 18">
            <circle cx="9" cy="9" r="7.5" fill="#eab308" stroke="#fef08a" stroke-width="1.5" />
            <text x="9" y="11.5" fill="#000000" font-size="6.5" font-weight="900" text-anchor="middle" font-family="'Outfit', sans-serif">TW</text>
          </svg>
          Torwart
        </span>
      `);
    }

    if (hasBlueTeam) {
      items.push(`
        <span class="legend-item" title="Team Blau">
          <svg class="legend-icon-svg" width="16" height="16" viewBox="0 0 18 18">
            <circle cx="9" cy="9" r="7.5" fill="#0284c7" stroke="#38bdf8" stroke-width="1.5" />
            <text x="9" y="11.5" fill="#ffffff" font-size="7" font-weight="900" text-anchor="middle" font-family="'Outfit', sans-serif">A</text>
          </svg>
          Team Blau
        </span>
      `);
    }

    if (hasRedTeam) {
      items.push(`
        <span class="legend-item" title="Team Rot">
          <svg class="legend-icon-svg" width="16" height="16" viewBox="0 0 18 18">
            <circle cx="9" cy="9" r="7.5" fill="#dc2626" stroke="#f87171" stroke-width="1.5" />
            <text x="9" y="11.5" fill="#ffffff" font-size="7" font-weight="900" text-anchor="middle" font-family="'Outfit', sans-serif">B</text>
          </svg>
          Team Rot
        </span>
      `);
    }

    if (hasTrainer) {
      items.push(`
        <span class="legend-item" title="Trainer">
          <svg class="legend-icon-svg" width="16" height="16" viewBox="0 0 18 18">
            <circle cx="9" cy="9" r="7.5" fill="#10b981" stroke="#6ee7b7" stroke-width="1.5" />
            <text x="9" y="11.5" fill="#ffffff" font-size="6.5" font-weight="900" text-anchor="middle" font-family="'Outfit', sans-serif">Tr</text>
          </svg>
          Trainer
        </span>
      `);
    }

    if (hasBalls) {
      items.push(`
        <span class="legend-item" title="Fußball">
          <svg class="legend-icon-svg" width="14" height="14" viewBox="0 0 16 16">
            <circle cx="8" cy="8" r="6" fill="#ffffff" stroke="#000000" stroke-width="1" />
            <circle cx="8" cy="8" r="2" fill="#000000" />
            <line x1="8" y1="2" x2="8" y2="6" stroke="#000000" stroke-width="0.8" />
            <line x1="13" y1="11" x2="9.5" y2="9" stroke="#000000" stroke-width="0.8" />
            <line x1="3" y1="11" x2="6.5" y2="9" stroke="#000000" stroke-width="0.8" />
          </svg>
          Ball
        </span>
      `);
    }

    // 4. Aktionen / Pfeile
    if (hasPass) {
      items.push(`
        <span class="legend-item" title="Pass">
          <svg class="legend-icon-svg" width="24" height="12" viewBox="0 0 24 12">
            <line x1="1" y1="6" x2="18" y2="6" stroke="#00d2ff" stroke-width="2.5" stroke-dasharray="4,3" stroke-linecap="round" />
            <polygon points="17,3 23,6 17,9" fill="#00d2ff" />
          </svg>
          Pass
        </span>
      `);
    }

    if (hasDribble) {
      items.push(`
        <span class="legend-item" title="Dribbling">
          <svg class="legend-icon-svg" width="24" height="12" viewBox="0 0 24 12">
            <path d="M 1 6 Q 6 1 11 6 T 19 6" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" />
            <polygon points="17,3 23,6 17,9" fill="#f59e0b" />
          </svg>
          Dribbling
        </span>
      `);
    }

    if (hasShot) {
      items.push(`
        <span class="legend-item" title="Torschuss">
          <svg class="legend-icon-svg" width="24" height="12" viewBox="0 0 24 12">
            <line x1="1" y1="6" x2="18" y2="6" stroke="#ef4444" stroke-width="3" stroke-linecap="round" />
            <polygon points="16,2 23,6 16,10" fill="#ef4444" />
          </svg>
          Torschuss
        </span>
      `);
    }

    if (hasRun) {
      items.push(`
        <span class="legend-item" title="Laufweg">
          <svg class="legend-icon-svg" width="24" height="12" viewBox="0 0 24 12">
            <line x1="1" y1="6" x2="18" y2="6" stroke="#f8fafc" stroke-width="2" stroke-linecap="round" />
            <polygon points="17,3 23,6 17,9" fill="#f8fafc" />
          </svg>
          Laufweg
        </span>
      `);
    }

    return `
      <div class="pitch-tactics-legend">
        ${items.join('')}
      </div>
    `;
  }
};

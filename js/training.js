/**
 * training.js
 * Modul Trainingsplanung für KickerCoach
 * 
 * Verwaltet Trainingspläne, Einheiten, 4-Phasen-Struktur (DFB U9),
 * soccerdrills.de Suche & Ingestion, Platz-Modus mit Phasen-Timer und Druckansicht.
 */

const training = {
  // State
  activePlan: null,
  activeWeek: 1,
  activeUnitId: null,
  activeSubView: 'plan', // 'plan' | 'generator' | 'soccerdrills' | 'pitch'
  
  // Replace Drill Context
  replacementTarget: null, // { unitId, phaseIndex }

  // On-pitch Timer State
  pitchTimer: {
    isRunning: false,
    elapsedSeconds: 0,
    totalSeconds: 60 * 60, // 60 Min
    intervalId: null,
    currentPhaseIndex: 0
  },

  init() {
    this.loadState();
    this.setupEventListeners();
    this.renderActiveView();
    this.updateApiKeyIndicator();
  },

  loadState() {
    const saved = localStorage.getItem('kickercoach_active_plan');
    if (saved) {
      try {
        this.activePlan = JSON.parse(saved);
      } catch (e) {
        console.warn('Fehler beim Parsen des gespeicherten Plans:', e);
      }
    }
    
    // Falls noch kein Plan da ist, laden wir den vollständigen DFB-U9-Masterplan
    if (!this.activePlan || !this.activePlan.units || this.activePlan.units.length === 0) {
      this.activePlan = aiService.getMasterPlan();
      this.saveState();
    }

    // Standardmäßig erste Einheit aktivieren
    const firstUnit = this.getUnitsForWeek(this.activeWeek)[0] || this.activePlan.units[0];
    this.activeUnitId = firstUnit ? firstUnit.id : null;
  },

  saveState() {
    if (this.activePlan) {
      localStorage.setItem('kickercoach_active_plan', JSON.stringify(this.activePlan));
    }
  },

  getUnitsForWeek(weekNum) {
    if (!this.activePlan || !this.activePlan.units) return [];
    return this.activePlan.units.filter(u => u.week === weekNum);
  },

  getActiveUnit() {
    if (!this.activePlan || !this.activePlan.units) return null;
    return this.activePlan.units.find(u => u.id === this.activeUnitId) || this.activePlan.units[0];
  },

  // ================= EVENT LISTENERS & SETUP =================
  setupEventListeners() {
    // Sub-view switch buttons
    document.querySelectorAll('.training-subnav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const view = btn.getAttribute('data-view');
        this.switchSubView(view);
      });
    });

    // Week selector pills
    document.querySelectorAll('.week-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const week = parseInt(pill.getAttribute('data-week'), 10);
        this.selectWeek(week);
      });
    });

    // AI Generator Submit
    const genForm = document.getElementById('ai-plan-generator-form');
    if (genForm) {
      genForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleGeneratePlanSubmit();
      });
    }

    // soccerdrills Search Input & Buttons
    const sdSearchInput = document.getElementById('sd-search-query');
    if (sdSearchInput) {
      sdSearchInput.addEventListener('input', (e) => {
        this.renderSoccerdrillsCatalog(e.target.value);
      });
    }

    // soccerdrills Filter Chips
    document.querySelectorAll('.sd-filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.sd-filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const focus = chip.getAttribute('data-focus');
        const query = document.getElementById('sd-search-query')?.value || '';
        this.renderSoccerdrillsCatalog(query, focus);
      });
    });

    // Ingest Link Form
    const ingestForm = document.getElementById('smart-link-ingest-form');
    if (ingestForm) {
      ingestForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleIngestSubmit();
      });
    }

    // Pitch Timer Controls
    const pitchPlayBtn = document.getElementById('pitch-timer-toggle');
    if (pitchPlayBtn) {
      pitchPlayBtn.addEventListener('click', () => this.togglePitchTimer());
    }
    const pitchResetBtn = document.getElementById('pitch-timer-reset');
    if (pitchResetBtn) {
      pitchResetBtn.addEventListener('click', () => this.resetPitchTimer());
    }
  },

  updateApiKeyIndicator() {
    const indicator = document.getElementById('api-status-badge');
    if (!indicator) return;
    if (aiService.hasTrainerCode()) {
      indicator.className = 'badge badge-green';
      indicator.innerHTML = '<i class="fa-solid fa-bolt"></i> Vereins-KI Aktiv';
      indicator.title = 'Trainer-Zugangscode aktiv. Klicken für Einstellungen.';
    } else if (aiService.hasApiKey()) {
      indicator.className = 'badge badge-green';
      indicator.innerHTML = '<i class="fa-solid fa-key"></i> Eigener Key Aktiv';
      indicator.title = 'Persönlicher Gemini API-Key aktiv. Klicken für Einstellungen.';
    } else {
      indicator.className = 'badge badge-gold';
      indicator.innerHTML = '<i class="fa-solid fa-lock-open"></i> KI freischalten';
      indicator.title = 'Klicken, um Trainer-Zugangscode oder Key einzurichten.';
    }
  },

  switchSubView(view) {
    this.activeSubView = view;
    document.querySelectorAll('.training-subnav-btn').forEach(btn => {
      if (btn.getAttribute('data-view') === view) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    document.querySelectorAll('.training-subview-panel').forEach(panel => {
      if (panel.id === `training-view-${view}`) {
        panel.classList.add('active');
      } else {
        panel.classList.remove('active');
      }
    });

    if (view === 'plan') {
      this.renderPlanView();
    } else if (view === 'soccerdrills') {
      this.renderSoccerdrillsCatalog();
    } else if (view === 'pitch') {
      this.renderPitchMode();
    }
  },

  renderWeekSelector() {
    const listEl = document.getElementById('week-pills-list');
    if (!listEl || !this.activePlan) return;

    const totalWeeks = this.activePlan.totalWeeks || 1;
    const totalUnits = (this.activePlan.units || []).length;
    const isSingleUnit = totalWeeks === 1 || totalUnits === 1;

    if (isSingleUnit) {
      const unit = this.activePlan.units[0];
      listEl.innerHTML = `
        <div class="week-pill active" data-week="1" style="min-width: 240px; cursor: default;">
          <span class="week-pill-title"><i class="fa-solid fa-futbol" style="color: var(--primary);"></i> 1 Einzelne Trainingseinheit</span>
          <span class="week-pill-subtitle">${unit ? unit.focusTheme : 'DFB-Einheit'}</span>
        </div>
      `;
      return;
    }

    let html = '';
    for (let w = 1; w <= totalWeeks; w++) {
      const unitsInWeek = this.getUnitsForWeek(w);
      const weekTheme = unitsInWeek[0]?.focusTheme || `Woche ${w}`;
      const isActive = this.activeWeek === w;

      html += `
        <div class="week-pill ${isActive ? 'active' : ''}" data-week="${w}">
          <span class="week-pill-title">Woche ${w}</span>
          <span class="week-pill-subtitle">${weekTheme}</span>
        </div>
      `;
    }
    listEl.innerHTML = html;

    listEl.querySelectorAll('.week-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const week = parseInt(pill.getAttribute('data-week'), 10);
        this.selectWeek(week);
      });
    });
  },

  selectWeek(weekNum) {
    this.activeWeek = weekNum;
    const listEl = document.getElementById('week-pills-list');
    if (listEl) {
      listEl.querySelectorAll('.week-pill').forEach(p => {
        if (parseInt(p.getAttribute('data-week'), 10) === weekNum) {
          p.classList.add('active');
        } else {
          p.classList.remove('active');
        }
      });
    }

    const weekUnits = this.getUnitsForWeek(weekNum);
    if (weekUnits.length > 0) {
      this.activeUnitId = weekUnits[0].id;
    }
    this.renderPlanView();
  },

  selectUnit(unitId) {
    this.activeUnitId = unitId;
    this.renderPlanView();
  },

  renderActiveView() {
    this.switchSubView(this.activeSubView);
  },

  // ================= PLAN & UNIT RENDERING =================
  renderPlanView() {
    this.renderWeekSelector();

    const container = document.getElementById('training-plan-content');
    if (!container) return;

    const unit = this.getActiveUnit();
    if (!unit) {
      container.innerHTML = `<div class="empty-state"><p>Keine Einheit gefunden.</p></div>`;
      return;
    }

    const weekUnits = this.getUnitsForWeek(this.activeWeek);
    const totalWeeks = this.activePlan.totalWeeks || 1;
    const totalUnits = (this.activePlan.units || []).length;
    const isSingleUnit = totalWeeks === 1 || totalUnits === 1;

    // 1. Render Units Selector Tabs for current week (nur wenn mehr als 1 Einheit in dieser Woche)
    let unitsTabsHtml = '';
    if (weekUnits.length > 1) {
      unitsTabsHtml = '<div class="units-selector-tabs">';
      weekUnits.forEach(u => {
        const isActive = u.id === unit.id;
        unitsTabsHtml += `
          <button class="btn ${isActive ? 'btn-primary' : 'btn-outline'} unit-select-btn" onclick="training.selectUnit('${u.id}')">
            <i class="fa-solid fa-calendar-day"></i>
            <span>Einheit ${u.unitNumber}: ${u.dayOfWeek} (${u.durationMinutes} Min)</span>
          </button>
        `;
      });
      unitsTabsHtml += '</div>';
    }

    // 2. Render Unit Header (Title, Focus, Material)
    const equipmentHtml = (unit.equipment || []).map(item => `
      <span class="equipment-tag"><i class="fa-solid fa-check"></i> ${item}</span>
    `).join('');

    // 3. Render 4 Phases Cards
    const phasesHtml = (unit.phases || []).map((phase, idx) => {
      let phaseBadge = 'badge-blue';
      let phaseIcon = 'fa-person-running';
      let phaseTime = '00–05 Min';

      if (idx === 0) {
        phaseBadge = 'badge-blue';
        phaseIcon = 'fa-child-reaching';
        phaseTime = '00–05 Min (5 Min)';
      } else if (idx === 1) {
        phaseBadge = 'badge-orange';
        phaseIcon = 'fa-dumbbell';
        phaseTime = '05–10 Min (5 Min)';
      } else if (idx === 2) {
        phaseBadge = 'badge-green';
        phaseIcon = 'fa-bullseye';
        phaseTime = '10–30 Min (20 Min)';
      } else if (idx === 3) {
        phaseBadge = 'badge-gold';
        phaseIcon = 'fa-trophy';
        phaseTime = '30–60 Min (30 Min)';
      }

      const sourceLink = phase.sourceUrl ? `
        <a href="${phase.sourceUrl}" target="_blank" class="phase-source-link" title="Original auf soccerdrills.de ansehen">
          <i class="fa-solid fa-arrow-up-right-from-square"></i> soccerdrills.de
        </a>
      ` : '';

      return `
        <div class="phase-card glass-card">
          <div class="phase-card-header">
            <div class="phase-badge-group">
              <span class="badge ${phaseBadge}"><i class="fa-solid ${phaseIcon}"></i> ${phase.name}</span>
              <span class="phase-time-pill"><i class="fa-regular fa-clock"></i> ${phaseTime}</span>
            </div>
            <div class="phase-actions">
              ${sourceLink}
              <button class="btn btn-sm btn-outline" onclick="training.openReplaceDrillModal('${unit.id}', ${idx})" title="Übung austauschen / soccerdrills.de suchen">
                <i class="fa-solid fa-arrows-rotate"></i> <span>Tauschen</span>
              </button>
            </div>
          </div>

          <h3 class="phase-title">${phase.title}</h3>

          <div class="phase-grid-details">
            <div class="phase-detail-item">
              <strong><i class="fa-solid fa-diagram-project"></i> Organisation (16–20 Kinder, minimale Standzeiten):</strong>
              <p>${phase.organization || 'Aufbau in 2-3 parallelen Zonen ohne Wartezeiten.'}</p>
            </div>

            <div class="phase-detail-item">
              <strong><i class="fa-solid fa-play"></i> Ablauf & Spielregeln:</strong>
              <p>${phase.drillRules || phase.description || 'Spieldurchlauf nach Vorgabe.'}</p>
            </div>
          </div>

          <div class="field-diagram-wrapper">
            <div class="diagram-header">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span><i class="fa-solid fa-futbol"></i> Feldaufbau & Taktik:</span>
                <span class="diagram-hint">DFB-Minifußball / Funino Feld</span>
              </div>
              <div class="diagram-view-toggle">
                <button type="button" class="diagram-toggle-btn active" id="btn-svg-${unit.id}-${idx}" onclick="training.toggleDiagramMode('${unit.id}-${idx}', 'svg')">
                  <i class="fa-solid fa-chalkboard-user"></i> <span>Taktiktafel (2D)</span>
                </button>
                <button type="button" class="diagram-toggle-btn" id="btn-ascii-${unit.id}-${idx}" onclick="training.toggleDiagramMode('${unit.id}-${idx}', 'ascii')">
                  <i class="fa-solid fa-font"></i> <span>ASCII</span>
                </button>
              </div>
            </div>

            <div id="diagram-svg-${unit.id}-${idx}" class="diagram-content-svg">
              ${typeof pitchRenderer !== 'undefined' ? pitchRenderer.renderPitch(phase, {
                unitNumber: unit.unitNumber || 1,
                phaseIndex: idx,
                unitFocus: unit.focusTheme || '',
                unitId: unit.id || ''
              }) : ''}
            </div>

            <div id="diagram-ascii-${unit.id}-${idx}" class="diagram-content-ascii" style="display: none;">
              <pre class="ascii-field">${(phase.fieldDiagram || '').trim()}</pre>
            </div>
          </div>

          ${phase.coachingPoints && phase.coachingPoints.length > 0 ? `
            <div class="phase-coaching-box">
              <div class="coaching-title"><i class="fa-solid fa-lightbulb"></i> Coaching-Punkte für diesen Teil:</div>
              <ul class="coaching-list">
                ${phase.coachingPoints.map(cp => `<li>${cp}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    // 4. Render Unit Coaching Summary Box
    const generalCoachingHtml = (unit.coachingPoints || []).map(cp => `
      <div class="coaching-summary-item">
        <i class="fa-solid fa-circle-check coaching-check-icon"></i>
        <span>${cp}</span>
      </div>
    `).join('');

    // Combine entire Unit View
    container.innerHTML = `
      <div class="unit-view-wrapper">
        
        <!-- Header Controls -->
        <div class="unit-action-bar">
          <div>
            <div class="plan-header-meta">
              <span class="badge badge-green"><i class="fa-solid fa-shield-halved"></i> ${this.activePlan.ageGroup || 'F-Jugend (U9)'}</span>
              ${isSingleUnit 
                ? `<span class="badge badge-blue"><i class="fa-solid fa-futbol"></i> 1 Trainingseinheit</span>`
                : `<span class="badge badge-blue">Woche ${unit.week} von ${totalWeeks}</span>`}
              <span class="badge badge-gray">${isSingleUnit ? '60 Minuten' : `Einheit ${unit.unitNumber} von ${totalUnits}`}</span>
            </div>
            <h2 class="unit-main-heading">${unit.focusTheme}</h2>
            <p class="unit-subtext">${unit.dateDisplay || `${unit.dayOfWeek} • 17:30 – 18:30 Uhr (60 Minuten)`}</p>
          </div>

          <div class="unit-quick-actions">
            <button class="btn btn-success" onclick="training.startPitchMode('${unit.id}')">
              <i class="fa-solid fa-stopwatch"></i>
              <span>Platz-Modus starten</span>
            </button>
            <button class="btn btn-secondary" onclick="training.printCurrentUnit()">
              <i class="fa-solid fa-print"></i>
              <span>Drucken / PDF</span>
            </button>
          </div>
        </div>

        ${unitsTabsHtml}

        <!-- Material Checklist Card -->
        <div class="glass-card equipment-card">
          <div class="equipment-header">
            <i class="fa-solid fa-boxes-stacked"></i>
            <span>Benötigtes Material für diese Einheit (16–20 Kinder):</span>
          </div>
          <div class="equipment-tags-container">
            ${equipmentHtml}
          </div>
        </div>

        <!-- Coaching Key Points Banner -->
        <div class="coaching-key-banner glass-card">
          <div class="coaching-banner-header">
            <i class="fa-solid fa-bullhorn coaching-icon-pulse"></i>
            <div>
              <h3>Zentrale DFB-Coaching-Punkte der Einheit</h3>
              <p>Worauf muss der Trainer besonders achten? Kindgerecht loben und korrigieren:</p>
            </div>
          </div>
          <div class="coaching-summary-grid">
            ${generalCoachingHtml}
          </div>
        </div>

        <!-- 4 Phases of Training -->
        <div class="phases-container">
          <div class="phases-timeline-heading">
            <i class="fa-solid fa-timeline"></i> Ablauf der 60-Minuten-Einheit (4 Phasen nach DFB-Konzept)
          </div>
          ${phasesHtml}
        </div>

      </div>
    `;
  },

  // ================= SOCCERDRILLS FINDER & CATALOG =================
  renderSoccerdrillsCatalog(query = '', focus = 'all') {
    const listContainer = document.getElementById('soccerdrills-results-list');
    if (!listContainer) return;

    listContainer.innerHTML = '<div class="loading-state"><i class="fa-solid fa-circle-notch fa-spin"></i> Übungen werden geladen...</div>';

    // Call service to find drills
    aiService.searchSoccerdrills(query, focus).then(drills => {
      if (!drills || drills.length === 0) {
        listContainer.innerHTML = `
          <div class="empty-state">
            <i class="fa-solid fa-magnifying-glass" style="font-size: 32px; color: var(--text-muted); margin-bottom: 12px;"></i>
            <p>Keine Übungen für "${query || focus}" gefunden.</p>
            <button class="btn btn-outline btn-sm" onclick="training.renderSoccerdrillsCatalog('', 'all')">Alle Übungen anzeigen</button>
          </div>
        `;
        return;
      }

      listContainer.innerHTML = drills.map(drill => {
        let badgeColor = 'badge-blue';
        if (drill.phase === 'main') badgeColor = 'badge-green';
        else if (drill.phase === 'game') badgeColor = 'badge-gold';
        else if (drill.phase === 'coordination') badgeColor = 'badge-orange';

        return `
          <div class="glass-card drill-catalog-card">
            <div class="drill-card-top">
              <div class="drill-tags">
                <span class="badge ${badgeColor}">${drill.phaseLabel || drill.phase}</span>
                <span class="badge badge-gray"><i class="fa-solid fa-bullseye"></i> ${drill.focus}</span>
                <span class="badge badge-gray"><i class="fa-regular fa-clock"></i> ${drill.durationMinutes || 15} Min</span>
              </div>
              <a href="${drill.originalUrl || 'https://www.soccerdrills.de'}" target="_blank" class="sd-external-link" title="Auf soccerdrills.de öffnen">
                <i class="fa-solid fa-arrow-up-right-from-square"></i> soccerdrills.de
              </a>
            </div>

            <h3 class="drill-catalog-title">${drill.title}</h3>
            <p class="drill-catalog-desc">${drill.description || drill.organization}</p>

            <div class="diagram-header" style="margin-bottom: 4px; margin-top: 6px;">
              <span style="font-size: 11px; font-weight: 700; color: #6ee7b7;"><i class="fa-solid fa-futbol"></i> Taktikaufbau:</span>
              <div class="diagram-view-toggle">
                <button type="button" class="diagram-toggle-btn active" id="btn-svg-${drill.id}" onclick="training.toggleDiagramMode('${drill.id}', 'svg')">
                  <i class="fa-solid fa-chalkboard-user"></i> 2D
                </button>
                <button type="button" class="diagram-toggle-btn" id="btn-ascii-${drill.id}" onclick="training.toggleDiagramMode('${drill.id}', 'ascii')">
                  <i class="fa-solid fa-font"></i> ASCII
                </button>
              </div>
            </div>

            <div id="diagram-svg-${drill.id}" class="diagram-content-svg" style="margin-bottom: 10px;">
              ${typeof pitchRenderer !== 'undefined' ? pitchRenderer.renderPitch(drill) : ''}
            </div>

            <div id="diagram-ascii-${drill.id}" class="diagram-content-ascii" style="display: none; margin-bottom: 10px;">
              <div class="drill-mini-ascii">
                <pre>${(drill.fieldAscii || '').trim()}</pre>
              </div>
            </div>

            <div class="drill-card-footer">
              <div class="drill-equip-snippet">
                <i class="fa-solid fa-shirt"></i> ${(drill.equipment || []).slice(0, 2).join(', ')}...
              </div>
              <button class="btn btn-sm btn-primary" onclick="training.adoptDrillIntoPlan('${drill.id}')">
                <i class="fa-solid fa-plus"></i>
                <span>In Trainingsplan übernehmen</span>
              </button>
            </div>
          </div>
        `;
      }).join('');
    }).catch(err => {
      listContainer.innerHTML = `<div class="error-msg">Fehler bei der Suche: ${err.message}</div>`;
    });
  },

  adoptDrillIntoPlan(drillId) {
    const drill = soccerdrillsCatalog.find(d => d.id === drillId);
    if (!drill) {
      alert('Übung nicht im Katalog gefunden.');
      return;
    }

    const unit = this.getActiveUnit();
    if (!unit) return;

    // Finde passende Phase in der aktiven Einheit
    let phaseIdx = 2; // Default: Hauptteil
    if (drill.phase === 'warmup') phaseIdx = 0;
    else if (drill.phase === 'coordination') phaseIdx = 1;
    else if (drill.phase === 'game') phaseIdx = 3;

    // Ersetze die Phase
    unit.phases[phaseIdx] = {
      name: unit.phases[phaseIdx].name,
      durationMinutes: unit.phases[phaseIdx].durationMinutes,
      title: drill.title,
      organization: drill.organization,
      drillRules: drill.description,
      fieldDiagram: drill.fieldAscii,
      sourceUrl: drill.originalUrl,
      coachingPoints: drill.coachingPoints
    };

    this.saveState();
    this.switchSubView('plan');
    alert(`Die Übung "${drill.title}" wurde erfolgreich in Einheit ${unit.unitNumber} (${unit.phases[phaseIdx].name}) übernommen!`);
  },

  openReplaceDrillModal(unitId, phaseIndex) {
    this.replacementTarget = { unitId, phaseIndex };
    const unit = this.activePlan.units.find(u => u.id === unitId);
    const phase = unit.phases[phaseIndex];
    
    // Switch to soccerdrills view and filter by this phase
    this.switchSubView('soccerdrills');
    
    let focusKey = 'all';
    if (phaseIndex === 0) focusKey = 'warmup';
    else if (phaseIndex === 1) focusKey = 'coordination';
    else if (phaseIndex === 2) focusKey = 'Dribbling';
    else if (phaseIndex === 3) focusKey = 'game';

    // Highlight chip
    document.querySelectorAll('.sd-filter-chip').forEach(c => {
      if (c.getAttribute('data-focus').toLowerCase() === focusKey.toLowerCase()) {
        c.classList.add('active');
      } else {
        c.classList.remove('active');
      }
    });

    this.renderSoccerdrillsCatalog('', focusKey);
  },

  // ================= SMART LINK INGESTION =================
  async handleIngestSubmit() {
    const input = document.getElementById('smart-link-input');
    const targetPhaseSelect = document.getElementById('ingest-target-phase');
    const resultBox = document.getElementById('ingest-result-preview');

    if (!input || !input.value.trim()) return;

    const source = input.value.trim();
    const phase = targetPhaseSelect ? targetPhaseSelect.value : 'main';

    resultBox.style.display = 'block';
    resultBox.innerHTML = `
      <div class="loading-state">
        <i class="fa-solid fa-circle-notch fa-spin"></i>
        <span>Analysiere Quelle & adaptiere für F-Jugend U9...</span>
      </div>
    `;

    try {
      const adaptedDrill = await aiService.ingestExternalSource(source, phase);
      
      resultBox.innerHTML = `
        <div class="glass-card" style="border: 1px solid var(--primary); padding: 16px; margin-top: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span class="badge badge-green"><i class="fa-solid fa-check"></i> Erfolgreich adaptiert</span>
            <span class="badge badge-gray">${adaptedDrill.focus}</span>
          </div>
          <h4 style="font-size: 16px; font-weight: 700; color: var(--text-primary); margin-bottom: 6px;">${adaptedDrill.title}</h4>
          <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px;">${adaptedDrill.description}</p>
          <div style="margin-bottom: 12px;">
            ${typeof pitchRenderer !== 'undefined' ? pitchRenderer.renderPitch(adaptedDrill) : `<pre class="ascii-field" style="max-height: 120px;">${adaptedDrill.fieldAscii}</pre>`}
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px;">
            <button class="btn btn-secondary btn-sm" onclick="document.getElementById('ingest-result-preview').style.display='none'">Verwerfen</button>
            <button class="btn btn-primary btn-sm" id="btn-apply-ingested-drill">
              <i class="fa-solid fa-circle-plus"></i> In aktuelle Einheit einfügen
            </button>
          </div>
        </div>
      `;

      document.getElementById('btn-apply-ingested-drill').addEventListener('click', () => {
        const unit = this.getActiveUnit();
        let pIdx = phase === 'warmup' ? 0 : phase === 'coordination' ? 1 : phase === 'game' ? 3 : 2;
        unit.phases[pIdx] = {
          name: unit.phases[pIdx].name,
          durationMinutes: unit.phases[pIdx].durationMinutes,
          title: adaptedDrill.title,
          organization: adaptedDrill.organization,
          drillRules: adaptedDrill.description,
          fieldDiagram: adaptedDrill.fieldAscii,
          sourceUrl: adaptedDrill.originalUrl,
          coachingPoints: adaptedDrill.coachingPoints
        };
        this.saveState();
        this.switchSubView('plan');
        alert(`Übung erfolgreich in "${unit.phases[pIdx].name}" eingefügt!`);
      });

    } catch (err) {
      resultBox.innerHTML = `
        <div class="error-msg" style="padding: 12px; margin-top: 12px;">
          <i class="fa-solid fa-triangle-exclamation"></i> ${err.message}
        </div>
      `;
    }
  },

  // ================= AI PLAN GENERATION =================
  async handleGeneratePlanSubmit() {
    const statusBox = document.getElementById('generator-status-msg');
    const submitBtn = document.getElementById('generator-submit-btn');
    
    const weeksCount = parseInt(document.getElementById('gen-weeks')?.value, 10) || 4;
    const isSingleUnit = weeksCount === 1;
    const customFocus = (document.getElementById('gen-focus')?.value || '').trim();
    const ageGroup = document.getElementById('gen-age-group')?.value || 'F-Jugend (U9)';
    const unitsLabel = isSingleUnit ? '1 Trainingseinheit' : `${weeksCount}-Wochen-Plan`;
    const offlineBtnText = isSingleUnit ? 'Einheit offline anpassen' : `Plan offline anpassen (${weeksCount} Wo.)`;

    // 1. Wenn weder Zugangscode noch API-Key hinterlegt ist: Dem Trainer eine klare Wahl bieten!
    if (!aiService.hasActiveAccess()) {
      if (statusBox) {
        statusBox.style.display = 'block';
        statusBox.innerHTML = `
          <div style="background: rgba(0, 229, 155, 0.08); border: 1px solid var(--primary); border-radius: var(--radius-sm); padding: 16px; margin-top: 10px;">
            <div style="font-weight: 700; font-size: 15px; color: var(--primary); margin-bottom: 6px;">
              <i class="fa-solid fa-wand-magic-sparkles"></i> KI-Zugang aktivieren
            </div>
            <p style="font-size: 13px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 12px;">
              Um echte, individuelle Trainingspläne per KI zu erstellen, gib einfach den <strong>Trainer-Zugangscode</strong> ein (z. B. <code>kicker2026</code> – kein Google-Account nötig) – oder passe den DFB-Plan sofort offline an.
            </p>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button type="button" class="btn btn-primary btn-sm" id="btn-open-trainer-code">
                <i class="fa-solid fa-key"></i> Zugangscode eingeben
              </button>
              <button type="button" class="btn btn-outline btn-sm" id="btn-create-offline-plan">
                <i class="fa-solid fa-sliders"></i> ${offlineBtnText}
              </button>
            </div>
          </div>
        `;

        document.getElementById('btn-open-trainer-code')?.addEventListener('click', () => {
          const dialog = document.getElementById('gemini-settings-dialog');
          if (dialog) {
            document.getElementById('tab-btn-code')?.click();
            dialog.showModal();
          }
        });

        document.getElementById('btn-create-offline-plan')?.addEventListener('click', () => {
          this.applyAdaptedPlan({ ageGroup, weeksCount, customFocus });
        });
      }
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Generiere Trainingsplan mit KI...';
    }

    if (statusBox) {
      statusBox.style.display = 'block';
      statusBox.innerHTML = `
        <div class="loading-state">
          <i class="fa-solid fa-wand-magic-sparkles fa-spin"></i>
          <span>Gemini KI erstellt maßgeschneiderte ${unitsLabel} für ${ageGroup}...</span>
        </div>
      `;
    }

    try {
      const plan = await aiService.generateTrainingPlan({
        ageGroup,
        weeksCount,
        customFocus
      });

      this.activePlan = plan;
      this.activeWeek = 1;
      this.activeUnitId = plan.units[0]?.id || null;
      this.saveState();

      if (statusBox) {
        const warningNotice = plan.aiWarning ? `<div style="font-size: 12px; margin-top: 4px; color: var(--accent);"><i class="fa-solid fa-info-circle"></i> ${plan.aiWarning}</div>` : '';
        statusBox.innerHTML = `
          <div class="success-msg" style="padding: 12px;">
            <i class="fa-solid fa-circle-check"></i> ${isSingleUnit ? 'Trainingseinheit' : 'Trainingsplan'} (${plan.units.length} ${plan.units.length === 1 ? 'Einheit' : 'Einheiten'}) erfolgreich geladen!
            ${warningNotice}
          </div>
        `;
      }

      setTimeout(() => {
        this.switchSubView('plan');
      }, 1000);

    } catch (err) {
      console.error('Plan-Generierung fehlgeschlagen:', err);
      if (statusBox) {
        statusBox.innerHTML = `
          <div style="background: rgba(239, 68, 68, 0.12); border: 1px solid var(--danger); border-radius: var(--radius-sm); padding: 14px; margin-top: 10px;">
            <div style="font-weight: 700; font-size: 14px; color: var(--danger); margin-bottom: 6px;">
              <i class="fa-solid fa-triangle-exclamation"></i> KI-Generierung fehlgeschlagen
            </div>
            <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px; line-height: 1.4;">
              ${err.message || 'Die Antwort der Gemini API konnte nicht verarbeitet werden.'}
            </p>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button type="button" class="btn btn-outline btn-sm" id="btn-retry-ai-gen">
                <i class="fa-solid fa-rotate-right"></i> Erneut versuchen
              </button>
              <button type="button" class="btn btn-secondary btn-sm" id="btn-fallback-offline">
                <i class="fa-solid fa-book-open"></i> ${offlineBtnText}
              </button>
            </div>
          </div>
        `;

        document.getElementById('btn-retry-ai-gen')?.addEventListener('click', () => {
          this.handleGeneratePlanSubmit();
        });

        document.getElementById('btn-fallback-offline')?.addEventListener('click', () => {
          this.applyAdaptedPlan({ ageGroup, weeksCount, customFocus });
        });
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Trainingsplan generieren';
      }
    }
  },

  /**
   * Wendet den anpassbaren DFB-Plan sofort lokal an (für Offline-Nutzung oder wenn kein Key hinterlegt ist)
   */
  applyAdaptedPlan({ ageGroup, weeksCount, customFocus }) {
    const plan = aiService.getAdaptedPlan({ ageGroup, weeksCount, customFocus });
    this.activePlan = plan;
    this.activeWeek = 1;
    this.activeUnitId = plan.units[0]?.id || null;
    this.saveState();
    
    const statusBox = document.getElementById('generator-status-msg');
    if (statusBox) {
      statusBox.innerHTML = `
        <div class="success-msg" style="padding: 12px;">
          <i class="fa-solid fa-circle-check"></i> Plan angepasst und geladen (${plan.units.length} Einheiten)!
        </div>
      `;
    }
    setTimeout(() => {
      this.switchSubView('plan');
    }, 800);
  },

  // ================= PITCH MODE & LIVE TIMER =================
  startPitchMode(unitId) {
    if (unitId) this.activeUnitId = unitId;
    this.switchSubView('pitch');
  },

  renderPitchMode() {
    const container = document.getElementById('pitch-mode-container');
    if (!container) return;

    const unit = this.getActiveUnit();
    if (!unit) return;

    const currentPhase = unit.phases[this.pitchTimer.currentPhaseIndex] || unit.phases[0];

    container.innerHTML = `
      <div class="pitch-mode-wrapper">
        
        <div class="pitch-top-bar">
          <div>
            <span class="badge badge-green"><i class="fa-solid fa-futbol"></i> Platz-Modus Aktiv</span>
            <span class="badge badge-gray">${unit.dayOfWeek} • Einheit ${unit.unitNumber}</span>
          </div>
          <button class="btn btn-outline btn-sm" onclick="training.switchSubView('plan')">
            <i class="fa-solid fa-xmark"></i> Beenden
          </button>
        </div>

        <div class="pitch-timer-display-box">
          <div class="pitch-timer-digits" id="pitch-timer-clock">
            ${this.formatSeconds(this.pitchTimer.elapsedSeconds)}
          </div>
          <div class="pitch-timer-subtext">
            Gesamtzeit: 60 Minuten • Phase ${this.pitchTimer.currentPhaseIndex + 1} von 4
          </div>
          
          <div class="pitch-timer-controls">
            <button class="btn btn-lg ${this.pitchTimer.isRunning ? 'btn-danger' : 'btn-primary'}" id="pitch-timer-toggle" onclick="training.togglePitchTimer()">
              <i class="fa-solid ${this.pitchTimer.isRunning ? 'fa-pause' : 'fa-play'}"></i>
              <span>${this.pitchTimer.isRunning ? 'Pause' : 'Starten'}</span>
            </button>
            <button class="btn btn-lg btn-secondary" onclick="training.resetPitchTimer()">
              <i class="fa-solid fa-arrow-rotate-left"></i> Reset
            </button>
            <button class="btn btn-lg btn-outline" onclick="training.nextPitchPhase()">
              <i class="fa-solid fa-forward-step"></i> Nächste Phase
            </button>
          </div>
        </div>

        <!-- Phase Navigation Bar -->
        <div class="pitch-phases-nav">
          ${unit.phases.map((p, i) => `
            <button class="pitch-phase-tab ${i === this.pitchTimer.currentPhaseIndex ? 'active' : ''}" onclick="training.setPitchPhase(${i})">
              <span>${i + 1}. ${p.name}</span>
              <small>(${p.durationMinutes} Min)</small>
            </button>
          `).join('')}
        </div>

        <!-- Current Phase Fullscreen Card -->
        <div class="glass-card pitch-current-phase-card">
          <div class="pitch-phase-title-row">
            <h2>${currentPhase.name}: ${currentPhase.title}</h2>
            <span class="badge badge-gold"><i class="fa-regular fa-clock"></i> ${currentPhase.durationMinutes} Minuten</span>
          </div>

          <div class="pitch-field-display">
            <div class="diagram-header" style="margin-bottom: 8px;">
              <span><i class="fa-solid fa-futbol"></i> Taktikaufbau:</span>
              <div class="diagram-view-toggle">
                <button type="button" class="diagram-toggle-btn active" id="btn-svg-pitch" onclick="training.toggleDiagramMode('pitch', 'svg')">
                  <i class="fa-solid fa-chalkboard-user"></i> Taktiktafel (2D)
                </button>
                <button type="button" class="diagram-toggle-btn" id="btn-ascii-pitch" onclick="training.toggleDiagramMode('pitch', 'ascii')">
                  <i class="fa-solid fa-font"></i> ASCII
                </button>
              </div>
            </div>
            <div id="diagram-svg-pitch" class="diagram-content-svg">
              ${typeof pitchRenderer !== 'undefined' ? pitchRenderer.renderPitch(currentPhase, {
                unitNumber: activeUnit.unitNumber || 1,
                phaseIndex: this.activePhaseIndex,
                unitFocus: activeUnit.focusTheme || '',
                unitId: activeUnit.id || ''
              }) : ''}
            </div>
            <div id="diagram-ascii-pitch" class="diagram-content-ascii" style="display: none;">
              <pre class="ascii-field-pitch">${(currentPhase.fieldDiagram || '').trim()}</pre>
            </div>
          </div>

          <div class="pitch-instructions-grid">
            <div class="pitch-inst-box">
              <h4><i class="fa-solid fa-diagram-project"></i> Organisation:</h4>
              <p>${currentPhase.organization}</p>
            </div>
            <div class="pitch-inst-box">
              <h4><i class="fa-solid fa-list-check"></i> Ablauf:</h4>
              <p>${currentPhase.drillRules || currentPhase.description}</p>
            </div>
          </div>

          ${currentPhase.coachingPoints && currentPhase.coachingPoints.length > 0 ? `
            <div class="pitch-coaching-box">
              <h4><i class="fa-solid fa-bullhorn"></i> COACHING-PUNKTE (Am Platz beachten!):</h4>
              <ul>
                ${currentPhase.coachingPoints.map(cp => `<li><strong>${cp}</strong></li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>

      </div>
    `;
  },

  togglePitchTimer() {
    if (this.pitchTimer.isRunning) {
      clearInterval(this.pitchTimer.intervalId);
      this.pitchTimer.isRunning = false;
    } else {
      this.pitchTimer.isRunning = true;
      this.pitchTimer.intervalId = setInterval(() => {
        this.pitchTimer.elapsedSeconds++;
        const clock = document.getElementById('pitch-timer-clock');
        if (clock) {
          clock.textContent = this.formatSeconds(this.pitchTimer.elapsedSeconds);
        }

        // Automatische Phasen-Erkennung (5' -> 10' -> 30' -> 60')
        const mins = Math.floor(this.pitchTimer.elapsedSeconds / 60);
        if (mins >= 30 && this.pitchTimer.currentPhaseIndex < 3) {
          this.setPitchPhase(3);
          this.playWhistleSound();
        } else if (mins >= 10 && this.pitchTimer.currentPhaseIndex < 2) {
          this.setPitchPhase(2);
          this.playWhistleSound();
        } else if (mins >= 5 && this.pitchTimer.currentPhaseIndex < 1) {
          this.setPitchPhase(1);
          this.playWhistleSound();
        }
      }, 1000);
    }
    this.renderPitchMode();
  },

  resetPitchTimer() {
    clearInterval(this.pitchTimer.intervalId);
    this.pitchTimer.isRunning = false;
    this.pitchTimer.elapsedSeconds = 0;
    this.pitchTimer.currentPhaseIndex = 0;
    this.renderPitchMode();
  },

  nextPitchPhase() {
    const unit = this.getActiveUnit();
    if (!unit) return;
    if (this.pitchTimer.currentPhaseIndex < unit.phases.length - 1) {
      this.setPitchPhase(this.pitchTimer.currentPhaseIndex + 1);
    }
  },

  setPitchPhase(index) {
    this.pitchTimer.currentPhaseIndex = index;
    this.renderPitchMode();
  },

  formatSeconds(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  },

  playWhistleSound() {
    // Web Audio API Whistle
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
      // Audio not permitted without touch
    }
  },

  // Diagram mode switch (SVG Tactics vs ASCII)
  toggleDiagramMode(id, mode) {
    const svgEl = document.getElementById(`diagram-svg-${id}`);
    const asciiEl = document.getElementById(`diagram-ascii-${id}`);
    const btnSvg = document.getElementById(`btn-svg-${id}`);
    const btnAscii = document.getElementById(`btn-ascii-${id}`);

    if (mode === 'svg') {
      if (svgEl) svgEl.style.display = 'block';
      if (asciiEl) asciiEl.style.display = 'none';
      if (btnSvg) btnSvg.classList.add('active');
      if (btnAscii) btnAscii.classList.remove('active');
    } else {
      if (svgEl) svgEl.style.display = 'none';
      if (asciiEl) asciiEl.style.display = 'block';
      if (btnSvg) btnSvg.classList.remove('active');
      if (btnAscii) btnAscii.classList.add('active');
    }
  },

  // ================= PRINT / PDF =================
  printCurrentUnit() {
    window.print();
  }
};

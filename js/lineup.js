const lineups = {
  // Lineup state inside module
  activeTeamIdx: 0,
  pitchType: 'funino', // 'funino' or 'fourplusone'
  
  // Timer State
  timer: {
    running: false,
    elapsedSeconds: 0,
    totalDurationMinutes: 10,
    rotationIntervalMinutes: 2,
    soundEnabled: true,
    intervalId: null
  },

  // Playtimes in seconds for currently active game session, mapped by player ID
  playtimes: {},

  init() {
    this.setupListeners();
    this.initOwnTeams();
  },

  setupListeners() {
    // Pitch type selector
    const pitchSelect = document.getElementById('pitch-type-selector');
    if (pitchSelect) {
      pitchSelect.value = this.pitchType;
      pitchSelect.addEventListener('change', (e) => {
        this.pitchType = e.target.value;
        this.renderLineup();
      });
    }

    // Timer Duration Inputs
    const totalDurInput = document.getElementById('timer-total-duration');
    if (totalDurInput) {
      totalDurInput.value = this.timer.totalDurationMinutes;
      totalDurInput.addEventListener('change', (e) => {
        this.timer.totalDurationMinutes = Math.max(1, parseInt(e.target.value) || 10);
        this.updateTimerDisplay();
      });
    }

    const rotIntervalInput = document.getElementById('timer-rotation-interval');
    if (rotIntervalInput) {
      rotIntervalInput.value = this.timer.rotationIntervalMinutes;
      rotIntervalInput.addEventListener('change', (e) => {
        this.timer.rotationIntervalMinutes = Math.max(1, parseInt(e.target.value) || 2);
        this.updateIntervalIndicator();
      });
    }

    const soundToggle = document.getElementById('timer-sound-enable');
    if (soundToggle) {
      soundToggle.checked = this.timer.soundEnabled;
      soundToggle.addEventListener('change', (e) => {
        this.timer.soundEnabled = e.target.checked;
      });
    }

    // Play/Pause Button
    const playPauseBtn = document.getElementById('timer-play-pause-btn');
    if (playPauseBtn) {
      playPauseBtn.addEventListener('click', () => this.toggleTimer());
    }

    // Reset Button
    const resetBtn = document.getElementById('timer-reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetTimer());
    }

    // Bench Drop Target Setup
    const benchContainer = document.getElementById('bench-slots-container');
    if (benchContainer) {
      benchContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        benchContainer.classList.add('drag-over');
      });
      benchContainer.addEventListener('dragleave', () => {
        benchContainer.classList.remove('drag-over');
      });
      benchContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        benchContainer.classList.remove('drag-over');
        const playerId = e.dataTransfer.getData('text/plain');
        this.movePlayerToSlot(playerId, 'bench');
      });
    }
  },

  onTabFocus() {
    this.initOwnTeams();
    this.renderLineup();
  },

  initOwnTeams() {
    const selectorContainer = document.getElementById('lineup-team-selector');
    if (!selectorContainer) return;

    const ownTeams = app.state.ownTeams || [];

    if (ownTeams.length === 0) {
      selectorContainer.innerHTML = `<span style="color:var(--text-muted); font-size:14px; font-weight:600;">Keine Teams im Kader-Tab generiert!</span>`;
      this.activeTeamIdx = -1;
      return;
    }

    // Bounds check
    if (this.activeTeamIdx >= ownTeams.length) {
      this.activeTeamIdx = 0;
    }

    selectorContainer.innerHTML = '';
    ownTeams.forEach((team, idx) => {
      const btn = document.createElement('button');
      const isActive = idx === this.activeTeamIdx;
      
      let badgeClass = 'badge-gray';
      if (team.name.includes('Gold')) badgeClass = 'badge-gold';
      else if (team.name.includes('Silber')) badgeClass = 'badge-silver';
      else if (team.name.includes('Bronze')) badgeClass = 'badge-bronze';

      btn.className = `btn ${isActive ? 'btn-primary' : 'btn-secondary'}`;
      btn.style.padding = '8px 14px';
      btn.innerHTML = `<span class="badge ${badgeClass}">${team.name}</span>`;
      btn.addEventListener('click', () => {
        this.activeTeamIdx = idx;
        this.initPlaytimesForActiveTeam();
        this.renderTeamTabs();
        this.renderLineup();
      });
      selectorContainer.appendChild(btn);
    });

    this.initPlaytimesForActiveTeam();
  },

  renderTeamTabs() {
    const buttons = document.querySelectorAll('#lineup-team-selector button');
    buttons.forEach((btn, idx) => {
      if (idx === this.activeTeamIdx) {
        btn.className = 'btn btn-primary';
      } else {
        btn.className = 'btn btn-secondary';
      }
    });
  },

  initPlaytimesForActiveTeam() {
    const ownTeams = app.state.ownTeams || [];
    if (this.activeTeamIdx < 0 || this.activeTeamIdx >= ownTeams.length) return;

    const team = ownTeams[this.activeTeamIdx];
    
    // Initialize playtimes for this team's players if not already set
    team.players.forEach(p => {
      if (this.playtimes[p.id] === undefined) {
        this.playtimes[p.id] = 0;
      }
      
      // Default to bench slot if not assigned yet
      if (!p.slot) {
        p.slot = 'bench';
      }
    });
  },

  renderLineup() {
    const ownTeams = app.state.ownTeams || [];
    if (this.activeTeamIdx < 0 || this.activeTeamIdx >= ownTeams.length) {
      const fieldSlots = document.getElementById('pitch-slots-container');
      const benchSlots = document.getElementById('bench-slots-container');
      if (fieldSlots) fieldSlots.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:50px; color:var(--text-muted);">Bitte zuerst im Kader-Tab Spieler eintragen & Teams generieren.</div>`;
      if (benchSlots) benchSlots.innerHTML = '';
      return;
    }

    const team = ownTeams[this.activeTeamIdx];
    
    this.renderGoals();
    this.renderPitchSlots(team);
    this.renderBench(team);
    this.renderPlaytimesList(team);
    this.updateTimerDisplay();
    this.updateIntervalIndicator();
  },

  // Renders soccer goals based on field type
  renderGoals() {
    const container = document.getElementById('pitch-goals-container');
    const penaltyTop = document.getElementById('penalty-area-top');
    const penaltyBottom = document.getElementById('penalty-area-bottom');
    if (!container) return;

    container.innerHTML = '';

    if (this.pitchType === 'funino') {
      // 4 mini goals on sides
      container.innerHTML = `
        <div class="funino-goal goal-top-left" title="Funino Minitor"></div>
        <div class="funino-goal goal-top-right" title="Funino Minitor"></div>
        <div class="funino-goal goal-bottom-left" title="Funino Minitor"></div>
        <div class="funino-goal goal-bottom-right" title="Funino Minitor"></div>
      `;
      if (penaltyTop) penaltyTop.style.display = 'none';
      if (penaltyBottom) penaltyBottom.style.display = 'none';
    } else {
      // 4+1 field: 2 central goals + Strafraum boxes
      container.innerHTML = `
        <div class="standard-goal goal-top-center" title="Juniorentor"></div>
        <div class="standard-goal goal-bottom-center" title="Juniorentor"></div>
      `;
      if (penaltyTop) penaltyTop.style.display = 'block';
      if (penaltyBottom) penaltyBottom.style.display = 'block';
    }
  },

  // Renders the drop positions on the field
  renderPitchSlots(team) {
    const container = document.getElementById('pitch-slots-container');
    if (!container) return;

    container.innerHTML = '';

    // Define positions according to field type
    let slots = [];
    if (this.pitchType === 'funino') {
      slots = [
        { id: 'funino-1', class: 'slot-funino-1', label: '1' },
        { id: 'funino-2', class: 'slot-funino-2', label: '2' },
        { id: 'funino-3', class: 'slot-funino-3', label: '3' }
      ];
    } else {
      slots = [
        { id: '41-tw', class: 'slot-41-tw', label: '1' },
        { id: '41-abw-l', class: 'slot-41-abw-l', label: '2' },
        { id: '41-abw-r', class: 'slot-41-abw-r', label: '3' },
        { id: '41-mf', class: 'slot-41-mf', label: '4' },
        { id: '41-ang', class: 'slot-41-ang', label: '5' }
      ];
    }

    slots.forEach(slotDef => {
      const slot = document.createElement('div');
      slot.className = `pitch-player-slot ${slotDef.class}`;
      slot.id = `slot_${slotDef.id}`;
      slot.innerHTML = `<span class="pitch-slot-label">${slotDef.label}</span>`;

      // Set up Drag Over & Drop Events
      slot.addEventListener('dragover', (e) => {
        e.preventDefault();
        slot.classList.add('drag-over');
      });
      
      slot.addEventListener('dragleave', () => {
        slot.classList.remove('drag-over');
      });

      slot.addEventListener('drop', (e) => {
        e.preventDefault();
        slot.classList.remove('drag-over');
        const playerId = e.dataTransfer.getData('text/plain');
        this.movePlayerToSlot(playerId, slotDef.id);
      });

      // Find if there is a player placed in this slot
      // If we switched from 4+1 to Funino, the 4+1 slots are obsolete.
      // We will only render players whose slot IDs match the active layout, else they show in the bench.
      const assignedPlayer = team.players.find(p => p.slot === slotDef.id);
      if (assignedPlayer) {
        const token = this.createPlayerToken(assignedPlayer);
        slot.innerHTML = ''; // Clear label
        slot.appendChild(token);
      }

      container.appendChild(slot);
    });
  },

  // Renders the reserve bench
  renderBench(team) {
    const container = document.getElementById('bench-slots-container');
    if (!container) return;

    container.innerHTML = '';

    // Active slot IDs to filter who belongs on the bench
    let activeSlotIds = [];
    if (this.pitchType === 'funino') {
      activeSlotIds = ['funino-1', 'funino-2', 'funino-3'];
    } else {
      activeSlotIds = ['41-tw', '41-abw-l', '41-abw-r', '41-mf', '41-ang'];
    }

    // Players on bench are either explicitly 'bench' or belong to slot IDs not active in current layout
    const benchPlayers = team.players.filter(p => p.slot === 'bench' || !activeSlotIds.includes(p.slot));

    if (benchPlayers.length === 0) {
      container.innerHTML = `<p style="color:var(--text-muted); font-size:13px; text-align:center; width:100%;">Alle Spieler auf dem Platz!</p>`;
      return;
    }

    benchPlayers.forEach(p => {
      const token = this.createPlayerToken(p);
      container.appendChild(token);
    });
  },

  createPlayerToken(player) {
    const token = document.createElement('div');
    token.className = 'player-token';
    token.setAttribute('draggable', 'true');
    token.id = `token_${player.id}`;

    // Draggable events
    token.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', player.id);
      token.style.opacity = '0.4';
    });

    token.addEventListener('dragend', () => {
      token.style.opacity = '1';
    });

    // Formatting active playtime in MM:SS
    const seconds = this.playtimes[player.id] || 0;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    const formattedTime = `${m}:${s.toString().padStart(2, '0')}`;

    // Playtime heat color coding (so coach sees visually who has high/low playtime)
    let timeHeatClass = 'low-time';
    const totalElapsed = this.timer.elapsedSeconds;
    
    if (totalElapsed > 0) {
      const ratio = seconds / totalElapsed;
      if (ratio > 0.75) timeHeatClass = 'high-time';
      else if (ratio > 0.4) timeHeatClass = 'med-time';
    }

    token.innerHTML = `
      <span class="badge-squad-strength">${player.strength}</span>
      <i class="fa-solid fa-circle-user player-token-avatar"></i>
      <span class="player-token-name" title="${player.name}">${player.name}</span>
      <span class="player-token-time ${timeHeatClass}">${formattedTime}</span>
    `;

    return token;
  },

  movePlayerToSlot(playerId, targetSlotId) {
    const ownTeams = app.state.ownTeams || [];
    if (this.activeTeamIdx < 0 || this.activeTeamIdx >= ownTeams.length) return;

    const team = ownTeams[this.activeTeamIdx];
    const player = team.players.find(p => p.id === playerId);
    
    if (!player) return;

    // Swap support!
    // If targetSlotId is a pitch slot (not 'bench') and already occupied by Player B:
    if (targetSlotId !== 'bench') {
      const occupant = team.players.find(p => p.slot === targetSlotId);
      if (occupant && occupant.id !== playerId) {
        // Move occupant to the previous slot of the dragged player (swapping them!)
        occupant.slot = player.slot;
      }
    }

    // Put dragged player in the new slot
    player.slot = targetSlotId;
    
    app.saveState();
    this.renderLineup();
  },

  // ==================== TIMER FUNCTIONS ====================
  toggleTimer() {
    const playPauseBtn = document.getElementById('timer-play-pause-btn');
    if (!playPauseBtn) return;

    if (this.timer.running) {
      // Pause
      this.timer.running = false;
      clearInterval(this.timer.intervalId);
      this.timer.intervalId = null;
      playPauseBtn.className = 'btn btn-primary';
      playPauseBtn.innerHTML = `<i class="fa-solid fa-play"></i> Fortsetzen`;
    } else {
      // Start
      this.timer.running = true;
      playPauseBtn.className = 'btn btn-glow-blue';
      playPauseBtn.innerHTML = `<i class="fa-solid fa-pause"></i> Pausieren`;
      
      this.timer.intervalId = setInterval(() => {
        this.tickTimer();
      }, 1000);
    }
  },

  resetTimer() {
    this.timer.running = false;
    clearInterval(this.timer.intervalId);
    this.timer.intervalId = null;
    this.timer.elapsedSeconds = 0;
    
    // Reset playtimes for active team
    const ownTeams = app.state.ownTeams || [];
    if (this.activeTeamIdx >= 0 && this.activeTeamIdx < ownTeams.length) {
      ownTeams[this.activeTeamIdx].players.forEach(p => {
        this.playtimes[p.id] = 0;
      });
    }

    const playPauseBtn = document.getElementById('timer-play-pause-btn');
    if (playPauseBtn) {
      playPauseBtn.className = 'btn btn-primary';
      playPauseBtn.innerHTML = `<i class="fa-solid fa-play"></i> Starten`;
    }

    this.dismissRotationBanner();
    this.renderLineup();
  },

  tickTimer() {
    this.timer.elapsedSeconds++;

    const ownTeams = app.state.ownTeams || [];
    if (this.activeTeamIdx >= 0 && this.activeTeamIdx < ownTeams.length) {
      const team = ownTeams[this.activeTeamIdx];

      // Active slot definitions
      let activeSlots = [];
      if (this.pitchType === 'funino') {
        activeSlots = ['funino-1', 'funino-2', 'funino-3'];
      } else {
        activeSlots = ['41-tw', '41-abw-l', '41-abw-r', '41-mf', '41-ang'];
      }

      // Add 1 second of playtime to every player who is currently in an active pitch slot
      team.players.forEach(p => {
        if (activeSlots.includes(p.slot)) {
          this.playtimes[p.id] = (this.playtimes[p.id] || 0) + 1;
        }
      });
    }

    // Refresh UI timer display and tokens
    this.updateTimerDisplay();
    this.renderPitchSlots(ownTeams[this.activeTeamIdx]);
    this.renderBench(ownTeams[this.activeTeamIdx]);
    this.renderPlaytimesList(ownTeams[this.activeTeamIdx]);

    // Check Rotation Alert Trigger (every N minutes)
    const intervalSeconds = this.timer.rotationIntervalMinutes * 60;
    if (this.timer.elapsedSeconds > 0 && this.timer.elapsedSeconds % intervalSeconds === 0) {
      this.triggerRotationSuggestion();
    }
  },

  updateTimerDisplay() {
    const display = document.getElementById('timer-clock-display');
    if (!display) return;

    // We can count UP, or count DOWN. In children soccer, counting UP is standard, 
    // but showing remaining time of the segment is awesome. Let's count UP from 0:00!
    const m = Math.floor(this.timer.elapsedSeconds / 60);
    const s = this.timer.elapsedSeconds % 60;
    display.textContent = `${m}:${s.toString().padStart(2, '0')}`;
  },

  updateIntervalIndicator() {
    const indicator = document.getElementById('timer-interval-indicator');
    if (!indicator) return;
    indicator.textContent = `Intervall: ${this.timer.rotationIntervalMinutes}:00 Min`;
  },

  // Generates fair rotation recommendation
  triggerRotationSuggestion() {
    const ownTeams = app.state.ownTeams || [];
    if (this.activeTeamIdx < 0 || this.activeTeamIdx >= ownTeams.length) return;

    const team = ownTeams[this.activeTeamIdx];

    // Determine active slot IDs
    let activeSlots = [];
    if (this.pitchType === 'funino') {
      activeSlots = ['funino-1', 'funino-2', 'funino-3'];
    } else {
      activeSlots = ['41-tw', '41-abw-l', '41-abw-r', '41-mf', '41-ang'];
    }

    const onPitchPlayers = team.players.filter(p => activeSlots.includes(p.slot));
    const onBenchPlayers = team.players.filter(p => p.slot === 'bench' || !activeSlots.includes(p.slot));

    if (onPitchPlayers.length === 0 || onBenchPlayers.length === 0) return;

    // Find the player on the pitch with the MAX active playtime
    let pitchTarget = onPitchPlayers[0];
    let maxTime = -1;
    onPitchPlayers.forEach(p => {
      const time = this.playtimes[p.id] || 0;
      if (time > maxTime) {
        maxTime = time;
        pitchTarget = p;
      }
    });

    // Find the player on the bench with the MIN active playtime
    let benchTarget = onBenchPlayers[0];
    let minTime = Infinity;
    onBenchPlayers.forEach(p => {
      const time = this.playtimes[p.id] || 0;
      if (time < minTime) {
        minTime = time;
        benchTarget = p;
      }
    });

    // Show suggestion banner!
    const banner = document.getElementById('rotation-banner');
    const textDetail = document.getElementById('rotation-banner-detail');

    if (banner && textDetail) {
      textDetail.innerHTML = `Wechsel empfohlen: <strong>${pitchTarget.name}</strong> (Bank ➔ Platz) gegen <strong>${benchTarget.name}</strong> (Platz ➔ Bank) tauschen!`;
      banner.classList.add('active');
    }

    // Play synthesis chime!
    this.playChime();
  },

  dismissRotationBanner() {
    const banner = document.getElementById('rotation-banner');
    if (banner) {
      banner.classList.remove('active');
    }
  },

  // Synthesize acoustic warning completely offline
  playChime() {
    if (!this.timer.soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      
      // Triple sporty tone!
      const playTone = (freq, startTime, duration) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);
        
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.2, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        
        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      const now = ctx.currentTime;
      playTone(523.25, now, 0.15); // C5
      playTone(659.25, now + 0.15, 0.15); // E5
      playTone(783.99, now + 0.30, 0.35); // G5
      
    } catch (e) {
      console.warn("Acoustic context not allowed or failed:", e);
    }
  },

  renderPlaytimesList(team) {
    const container = document.getElementById('timer-playtimes-list');
    if (!container) return;

    container.innerHTML = '';

    // Sort players of the active team by playtime descending
    const sorted = [...team.players].sort((a, b) => {
      const timeA = this.playtimes[a.id] || 0;
      const timeB = this.playtimes[b.id] || 0;
      return timeB - timeA;
    });

    sorted.forEach(p => {
      const seconds = this.playtimes[p.id] || 0;
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      const formattedTime = `${m}:${s.toString().padStart(2, '0')}`;

      // Check slot status
      let activeSlots = [];
      if (this.pitchType === 'funino') {
        activeSlots = ['funino-1', 'funino-2', 'funino-3'];
      } else {
        activeSlots = ['41-tw', '41-abw-l', '41-abw-r', '41-mf', '41-ang'];
      }

      const isOnPitch = activeSlots.includes(p.slot);
      const statusBadge = isOnPitch 
        ? `<span class="badge badge-primary" style="font-size:8px;">Platz</span>` 
        : `<span class="badge badge-gray" style="font-size:8px; opacity: 0.6;">Bank</span>`;

      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.alignItems = 'center';
      row.style.padding = '8px 12px';
      row.style.borderBottom = '1px solid var(--border-color)';
      row.style.fontSize = '13px';

      row.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
          ${statusBadge}
          <span style="font-weight: 500; color: var(--text-primary);">${p.name}</span>
        </div>
        <span style="font-weight:600; font-family:monospace; color:${isOnPitch ? 'var(--primary)' : 'var(--text-secondary)'};">${formattedTime}</span>
      `;

      container.appendChild(row);
    });
  }
};

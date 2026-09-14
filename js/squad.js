const squad = {
  init() {
    this.setupListeners();
    this.renderSquad();
    this.renderTeams();
  },

  setupListeners() {
    // Add player form submit
    const form = document.getElementById('add-player-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.addPlayer();
      });
    }

    // Toggle all attendance switch
    const toggleAll = document.getElementById('toggle-all-attendance');
    if (toggleAll) {
      toggleAll.addEventListener('change', (e) => {
        const checked = e.target.checked;
        app.state.players.forEach(p => p.present = checked);
        app.saveState();
        this.renderSquad();
        
        // Auto-update dashboard metrics
        app.updateStats();
      });
    }

    // Generate teams button
    const generateBtn = document.getElementById('generate-teams-btn');
    if (generateBtn) {
      generateBtn.addEventListener('click', () => {
        this.generateTeams();
      });
    }

    // Watch split configurations
    const splitCount = document.getElementById('team-split-count');
    const splitMode = document.getElementById('team-split-mode');
    
    if (splitCount) {
      splitCount.value = app.state.teamSplitCount;
      splitCount.addEventListener('change', (e) => {
        app.state.teamSplitCount = parseInt(e.target.value);
        app.saveState();
      });
    }
    
    if (splitMode) {
      splitMode.value = app.state.teamSplitMode;
      splitMode.addEventListener('change', (e) => {
        app.state.teamSplitMode = e.target.value;
        app.saveState();
      });
    }
  },

  addPlayer() {
    const nameInput = document.getElementById('player-name');
    const strengthSelect = document.getElementById('player-strength');
    
    if (!nameInput || !strengthSelect) return;

    const name = nameInput.value.trim();
    const strength = parseInt(strengthSelect.value);
    
    if (!name) return;

    const newPlayer = {
      id: Date.now().toString(),
      name: name,
      strength: strength,
      birthYear: new Date().getFullYear() - 8, // Default approx 8 years old
      present: true
    };

    app.state.players.push(newPlayer);
    app.saveState();

    // Reset input
    nameInput.value = '';
    nameInput.focus();

    this.renderSquad();
    app.updateStats();
  },

  deletePlayer(id) {
    app.state.players = app.state.players.filter(p => p.id !== id);
    
    // Also clean up from any ownTeams to avoid ghosts
    app.state.ownTeams.forEach(t => {
      t.players = t.players.filter(p => p.id !== id);
    });

    app.saveState();
    this.renderSquad();
    this.renderTeams();
    app.updateStats();
  },

  toggleAttendance(id) {
    const player = app.state.players.find(p => p.id === id);
    if (player) {
      player.present = !player.present;
      app.saveState();
      
      // Update toggle-all status if appropriate
      const toggleAll = document.getElementById('toggle-all-attendance');
      if (toggleAll) {
        const allPresent = app.state.players.every(p => p.present);
        toggleAll.checked = allPresent;
      }
      
      app.updateStats();
    }
  },

  changeStrength(id, strength) {
    const player = app.state.players.find(p => p.id === id);
    if (player) {
      player.strength = strength;
      app.saveState();
      this.renderSquad();
      app.updateStats();
    }
  },

  renderSquad() {
    const container = document.getElementById('squad-list-container');
    if (!container) return;

    if (app.state.players.length === 0) {
      container.innerHTML = `<p style="color: var(--text-muted); grid-column: 1/-1; text-align: center; padding: 24px;">Noch keine Spieler im Kader. Tragen Sie oben neue Spieler ein!</p>`;
      return;
    }

    container.innerHTML = '';
    
    // Sort players: present first, then alphabetically
    const sorted = [...app.state.players].sort((a, b) => {
      if (a.present && !b.present) return -1;
      if (!a.present && b.present) return 1;
      return a.name.localeCompare(b.name);
    });

    sorted.forEach(p => {
      const card = document.createElement('div');
      card.className = `player-card-squad glass-card ${p.present ? '' : 'inactive'}`;
      if (!p.present) card.style.opacity = '0.55';

      let starsHtml = '';
      for (let i = 1; i <= 3; i++) {
        starsHtml += `<i class="fa-solid fa-star ${i <= p.strength ? 'active' : ''}" onclick="squad.changeStrength('${p.id}', ${i})" style="cursor:pointer; color: ${i <= p.strength ? 'var(--accent)' : 'var(--text-muted)'}; margin-right:2px;"></i>`;
      }

      card.innerHTML = `
        <div class="player-info-squad">
          <span class="player-name-squad">
            ${p.name}
          </span>
          <div class="player-meta-squad">
            <span class="strength-stars">${starsHtml}</span>
            <span>Jg. ${p.birthYear}</span>
          </div>
        </div>
        <div class="player-actions-squad">
          <div class="switch-container">
            <label class="switch">
              <input type="checkbox" ${p.present ? 'checked' : ''} onchange="squad.toggleAttendance('${p.id}')">
              <span class="slider"></span>
            </label>
          </div>
          <button class="btn btn-secondary btn-icon-only" onclick="squad.deletePlayer('${p.id}')" style="height:32px; width:32px; border-color:transparent; background:transparent; color:var(--danger);">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      `;
      container.appendChild(card);
    });
  },

  generateTeams() {
    const presentPlayers = app.state.players.filter(p => p.present);
    const teamCount = app.state.teamSplitCount;
    const mode = app.state.teamSplitMode;

    if (presentPlayers.length === 0) {
      alert("Es sind keine Spieler anwesend! Bitte markieren Sie mindestens einen Spieler als anwesend.");
      return;
    }

    if (presentPlayers.length < teamCount) {
      alert(`Sie haben ${presentPlayers.length} Spieler anwesend, möchten aber in ${teamCount} Teams einteilen. Das ist nicht möglich!`);
      return;
    }

    // Initialize empty teams
    const teams = [];
    const teamNames = [];
    
    if (mode === 'strength') {
      // Names by strength
      if (teamCount === 1) teamNames.push('Team Gold');
      else if (teamCount === 2) teamNames.push('Team Gold', 'Team Silber');
      else if (teamCount === 3) teamNames.push('Team Gold', 'Team Silber', 'Team Bronze');
      else {
        teamNames.push('Team Gold', 'Team Silber', 'Team Bronze', 'Team Weiß');
      }
    } else {
      // Numerical/Homogeneous names
      for (let i = 1; i <= teamCount; i++) {
        teamNames.push(`Team ${i}`);
      }
    }

    for (let i = 0; i < teamCount; i++) {
      teams.push({
        name: teamNames[i],
        players: []
      });
    }

    // Sort present players by strength descending
    const sortedPlayers = [...presentPlayers].sort((a, b) => b.strength - a.strength);

    if (mode === 'strength') {
      // Option A: Split by performance (Gold, Silver, Bronze, etc.)
      // Distribute sequentially in blocks to ensure strongest go to Gold, etc.
      // We calculate capacity per team dynamically
      const baseSize = Math.floor(sortedPlayers.length / teamCount);
      const remainder = sortedPlayers.length % teamCount;
      
      let playerIndex = 0;
      for (let t = 0; t < teamCount; t++) {
        const teamSize = baseSize + (t < remainder ? 1 : 0);
        for (let j = 0; j < teamSize; j++) {
          teams[t].players.push(sortedPlayers[playerIndex++]);
        }
      }
    } else {
      // Option B: Homogeneous split (balanced average strength)
      // We distribute players to maintain balanced sizes and average strength using a size-constrained greedy algorithm
      sortedPlayers.forEach(player => {
        // Find teams with the minimum number of players
        const minSize = Math.min(...teams.map(t => t.players.length));
        const candidateTeams = teams.filter(t => t.players.length === minSize);
        
        // Out of candidate teams (size matches), find the one with the lowest total strength
        let targetTeam = candidateTeams[0];
        let minStrength = Infinity;
        
        candidateTeams.forEach(t => {
          const totalStr = t.players.reduce((sum, p) => sum + p.strength, 0);
          if (totalStr < minStrength) {
            minStrength = totalStr;
            targetTeam = t;
          }
        });

        targetTeam.players.push(player);
      });
    }

    app.state.ownTeams = teams;
    app.saveState();
    
    this.renderTeams();
    app.updateStats();

    // Sync lineup planner teams immediately!
    if (typeof lineups !== 'undefined' && lineups.initOwnTeams) {
      lineups.initOwnTeams();
    }
  },

  renderTeams() {
    const container = document.getElementById('teams-output-container');
    if (!container) return;

    if (!app.state.ownTeams || app.state.ownTeams.length === 0) {
      container.innerHTML = `<p style="color: var(--text-muted); font-size: 14px; text-align: center; padding: 10px 0;">Noch keine Teams eingeteilt. Bitte „Teams generieren“ klicken.</p>`;
      return;
    }

    container.innerHTML = '';
    
    const grid = document.createElement('div');
    grid.className = 'team-player-list';
    grid.style.display = 'flex';
    grid.style.flexDirection = 'column';
    grid.style.gap = '12px';

    app.state.ownTeams.forEach(team => {
      const avgStrength = team.players.length > 0
        ? (team.players.reduce((sum, p) => sum + p.strength, 0) / team.players.length).toFixed(1)
        : '0.0';

      let badgeClass = 'badge-gray';
      if (team.name.includes('Gold')) badgeClass = 'badge-gold';
      else if (team.name.includes('Silber')) badgeClass = 'badge-silver';
      else if (team.name.includes('Bronze')) badgeClass = 'badge-bronze';
      else if (team.name.includes('Weiß')) badgeClass = 'badge-primary';

      const teamCard = document.createElement('div');
      teamCard.className = 'team-column-card';
      
      let playersListHtml = '';
      if (team.players.length === 0) {
        playersListHtml = `<p style="color: var(--text-muted); font-size: 13px; text-align: center;">Keine Spieler</p>`;
      } else {
        playersListHtml = team.players.map(p => {
          let stars = '⭐'.repeat(p.strength);
          return `
            <div class="team-player-item" style="margin-bottom: 6px;">
              <span class="team-player-item-name">${p.name}</span>
              <span style="font-size:12px; color:var(--accent);">${stars}</span>
            </div>
          `;
        }).join('');
      }

      teamCard.innerHTML = `
        <div class="team-column-header">
          <span class="team-column-name">
            <span class="badge ${badgeClass}">${team.name}</span>
          </span>
          <span class="team-strength-indicator">⭐ Durchschnitt: ${avgStrength}</span>
        </div>
        <div class="team-player-list">
          ${playersListHtml}
        </div>
      `;
      grid.appendChild(teamCard);
    });

    container.appendChild(grid);
  }
};

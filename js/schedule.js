const schedule = {
  // Default clubs to pre-populate so the app feels active immediately
  defaultClubs: [
    { id: 'c1', name: 'KickerCoach FC', teamsCount: 2, isOwnClub: true },
    { id: 'c2', name: 'TSV Grünwald', teamsCount: 2, isOwnClub: false },
    { id: 'c3', name: 'SV Pullach', teamsCount: 1, isOwnClub: false },
    { id: 'c4', name: 'SpVgg Haching', teamsCount: 1, isOwnClub: false }
  ],

  init() {
    this.setupListeners();
    this.ensureDefaultClubs();
    this.renderClubs();
    this.renderSchedule();
  },

  ensureDefaultClubs() {
    if (!app.state.tournamentClubs) {
      app.state.tournamentClubs = JSON.parse(JSON.stringify(this.defaultClubs));
      app.saveState();
    }
  },

  setupListeners() {
    // Add Club button
    const addClubBtn = document.getElementById('add-club-btn');
    if (addClubBtn) {
      addClubBtn.addEventListener('click', () => this.addClub());
    }

    // Generate Schedule button
    const generateBtn = document.getElementById('generate-schedule-btn');
    if (generateBtn) {
      generateBtn.addEventListener('click', () => this.generateTournament());
    }

    // Kaiser Next Round button
    const nextKaiserRoundBtn = document.getElementById('kaiser-next-round-btn');
    if (nextKaiserRoundBtn) {
      nextKaiserRoundBtn.addEventListener('click', () => this.advanceKaiserRound());
    }

    // Round Navigator Buttons
    const prevRoundBtn = document.getElementById('prev-round-btn');
    const nextRoundBtnNav = document.getElementById('next-round-btn-nav');

    if (prevRoundBtn) {
      prevRoundBtn.addEventListener('click', () => this.navigateRound(-1));
    }
    if (nextRoundBtnNav) {
      nextRoundBtnNav.addEventListener('click', () => this.navigateRound(1));
    }

    // Sync own club team count with actual divided teams in squad
    this.syncOwnClubTeamsCount();
  },

  syncOwnClubTeamsCount() {
    if (app.state.ownTeams && app.state.ownTeams.length > 0 && app.state.tournamentClubs) {
      const ownClub = app.state.tournamentClubs.find(c => c.isOwnClub);
      if (ownClub && ownClub.teamsCount !== app.state.ownTeams.length) {
        ownClub.teamsCount = app.state.ownTeams.length;
        app.saveState();
      }
    }
  },

  addClub() {
    const nameInput = document.getElementById('new-club-name');
    const teamsInput = document.getElementById('new-club-teams');
    
    if (!nameInput || !teamsInput) return;

    const name = nameInput.value.trim();
    const teamsCount = parseInt(teamsInput.value);

    if (!name || isNaN(teamsCount) || teamsCount < 1) {
      alert("Bitte einen gültigen Vereinsnamen und mindestens 1 Team eingeben.");
      return;
    }

    const newClub = {
      id: 'c_' + Date.now(),
      name: name,
      teamsCount: teamsCount,
      isOwnClub: false
    };

    if (!app.state.tournamentClubs) app.state.tournamentClubs = [];
    app.state.tournamentClubs.push(newClub);
    app.saveState();

    // Reset inputs
    nameInput.value = '';
    teamsInput.value = '1';
    nameInput.focus();

    this.renderClubs();
  },

  deleteClub(id) {
    if (!app.state.tournamentClubs) return;
    const club = app.state.tournamentClubs.find(c => c.id === id);
    if (club && club.isOwnClub) {
      alert("Der eigene Verein kann nicht gelöscht werden. Bitte passen Sie die Teamanzahl im Kader-Tab an!");
      return;
    }

    app.state.tournamentClubs = app.state.tournamentClubs.filter(c => c.id !== id);
    app.saveState();
    this.renderClubs();
  },

  renderClubs() {
    const container = document.getElementById('clubs-list-container');
    if (!container) return;

    this.syncOwnClubTeamsCount();

    if (!app.state.tournamentClubs || app.state.tournamentClubs.length === 0) {
      container.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 12px;">Keine Vereine eingetragen.</p>`;
      return;
    }

    container.innerHTML = '';
    app.state.tournamentClubs.forEach(c => {
      const item = document.createElement('div');
      item.className = 'club-list-item';
      
      const badgeText = c.teamsCount === 1 ? '1 Team' : `${c.teamsCount} Teams`;
      const isOwnBadge = c.isOwnClub ? `<span class="badge badge-primary" style="margin-left: 8px;">Eigener Verein</span>` : '';

      item.innerHTML = `
        <div class="club-list-details">
          <span class="club-list-name">${c.name}</span>
          ${isOwnBadge}
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          <span class="club-list-badge">${badgeText}</span>
          ${c.isOwnClub ? '' : `
            <button class="btn btn-secondary btn-icon-only" onclick="schedule.deleteClub('${c.id}')" style="height:28px; width:28px; border:none; background:transparent; color:var(--danger);">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          `}
        </div>
      `;
      container.appendChild(item);
    });
  },

  generateTournament() {
    this.syncOwnClubTeamsCount();
    
    const clubs = app.state.tournamentClubs || [];
    const mode = document.getElementById('tournament-mode').value;
    const rounds = parseInt(document.getElementById('tournament-rounds').value) || 5;
    const funinoFields = parseInt(document.getElementById('funino-fields').value) || 0;
    const fourPlusOneFields = parseInt(document.getElementById('four-plus-one-fields').value) || 0;
    
    const totalFields = funinoFields + fourPlusOneFields;

    if (clubs.length === 0) {
      alert("Bitte fügen Sie mindestens einen Verein hinzu!");
      return;
    }

    if (totalFields < 1) {
      alert("Bitte legen Sie mindestens 1 Spielfeld (Funino oder 4+1) fest!");
      return;
    }

    // Flatten all teams in the tournament
    let teams = [];
    clubs.forEach(c => {
      for (let i = 1; i <= c.teamsCount; i++) {
        let teamName = '';
        if (c.isOwnClub && app.state.ownTeams && app.state.ownTeams[i-1]) {
          // Use divided team names if they exist (Gold, Silver...)
          teamName = app.state.ownTeams[i-1].name;
        } else {
          teamName = c.teamsCount === 1 ? c.name : `${c.name} ${i}`;
        }
        
        teams.push({
          id: `${c.id}_t${i}`,
          name: teamName,
          clubName: c.name,
          isOwnClub: c.isOwnClub
        });
      }
    });

    if (teams.length < 2) {
      alert("Es müssen mindestens 2 Teams insgesamt teilnehmen, um einen Spielplan zu erstellen!");
      return;
    }

    // Initialize tournament state
    const tournament = {
      mode: mode,
      totalRounds: rounds,
      currentRound: 1,
      funinoFields: funinoFields,
      fourPlusOneFields: fourPlusOneFields,
      teams: teams,
      matches: [],
      standings: []
    };

    // Generate matches based on mode
    if (mode === 'roundrobin') {
      this.generateRoundRobin(tournament, teams, totalFields, rounds);
    } else {
      this.generateKaiserFirstRound(tournament, teams, totalFields);
    }

    // Initialize standings
    this.calculateStandings(tournament);

    app.state.tournament = tournament;
    app.saveState();

    this.renderSchedule();
    app.updateStats();

    // Scroll down to schedule
    document.getElementById('schedule-results-panel').scrollIntoView({ behavior: 'smooth' });
  },

  // Generates round robin scheduling
  generateRoundRobin(tournament, teams, totalFields, requestedRounds) {
    let tList = [...teams];
    
    // If odd number of teams, add a dummy team for PAUSE (byes)
    const isOdd = tList.length % 2 !== 0;
    if (isOdd) {
      tList.push({ id: 'pause_dummy', name: 'PAUSE', clubName: '', isDummy: true });
    }

    const n = tList.length;
    const roundsList = [];
    
    // We can generate up to n-1 unique rounds for round robin
    const uniqueRoundsCount = n - 1;
    
    // Generate pairings using Circle Method
    for (let r = 0; r < requestedRounds; r++) {
      const roundMatches = [];
      const roundIndex = r % uniqueRoundsCount; // Loop over if requested rounds exceeds unique rounds
      
      for (let i = 0; i < n / 2; i++) {
        const homeIdx = (roundIndex + i) % (n - 1);
        let awayIdx = (roundIndex + n - 1 - i) % (n - 1);
        
        // The last element stays fixed at position 0 in circle method
        if (i === 0) {
          awayIdx = n - 1;
        }

        const home = tList[homeIdx];
        const away = tList[awayIdx];

        // Skip matches involving dummy (Pause)
        if (home.isDummy || away.isDummy) {
          continue;
        }

        roundMatches.push({
          home: home,
          away: away,
          scoreHome: null,
          scoreAway: null
        });
      }
      roundsList.push(roundMatches);
    }

    // Now, schedule these matches onto courts.
    // If totalFields is smaller than the matches in a round, some teams will pause.
    // We will pack matches into consecutive 'slots' / rounds.
    let matchIdCounter = 1;
    
    for (let r = 0; r < requestedRounds; r++) {
      const availableMatches = roundsList[r] || [];
      
      // Let's allocate courts
      let funinoFieldsLeft = tournament.funinoFields;
      let fourPlusOneFieldsLeft = tournament.fourPlusOneFields;
      let currentFieldIndex = 1;

      availableMatches.forEach(match => {
        // Decide field type
        let fieldType = 'funino';
        if (funinoFieldsLeft > 0) {
          funinoFieldsLeft--;
        } else if (fourPlusOneFieldsLeft > 0) {
          fieldType = '4plus1';
          fourPlusOneFieldsLeft--;
        } else {
          // If out of fields, we can't play it this timeslot in parallel.
          // In Kinderfussball SPA, we will just create a "Field overflow" or keep it on an overflow court.
          // To keep it simple: we assign it to an "overflow" field, or let's dynamically scale fields!
          // Better: we just label it as "Platz " + currentFieldIndex
          fieldType = 'funino';
        }

        tournament.matches.push({
          id: `m_${matchIdCounter++}`,
          round: r + 1,
          courtNumber: currentFieldIndex++,
          courtType: fieldType,
          home: match.home,
          away: match.away,
          scoreHome: null,
          scoreAway: null,
          completed: false
        });
      });
    }
  },

  // Generates only round 1 for Kaiserturnier
  generateKaiserFirstRound(tournament, teams, totalFields) {
    // In Kaiserturnier, teams are assigned to fields in pairs.
    // Field 1, Field 2, ..., Field F.
    // We shuffle or just place teams in order.
    let tList = [...teams];
    
    // Shuffle teams for initial placements
    tList.sort(() => Math.random() - 0.5);

    let matchIdCounter = 1;
    let funinoFieldsCount = tournament.funinoFields;
    let fourPlusOneFieldsCount = tournament.fourPlusOneFields;
    let currentField = 1;

    for (let f = 0; f < totalFields; f++) {
      // We need at least 2 teams per field
      if (tList.length < 2) break;

      const home = tList.shift();
      const away = tList.shift();

      let courtType = 'funino';
      if (f >= funinoFieldsCount) {
        courtType = '4plus1';
      }

      tournament.matches.push({
        id: `m_${matchIdCounter++}`,
        round: 1,
        courtNumber: currentField++,
        courtType: courtType,
        home: home,
        away: away,
        scoreHome: null,
        scoreAway: null,
        completed: false
      });
    }

    // Any remaining teams in tList have a PAUSE in round 1
    tournament.kaiserWaitingQueue = tList; // Store the waiting queue in tournament state
  },

  // Kaiserturnier Round-to-Round Advancement
  advanceKaiserRound() {
    const t = app.state.tournament;
    if (!t || t.mode !== 'kaiser') return;

    const roundMatches = t.matches.filter(m => m.round === t.currentRound);
    
    // Verify all scores are entered
    const incomplete = roundMatches.some(m => m.scoreHome === null || m.scoreAway === null);
    if (incomplete) {
      alert("Bitte tragen Sie alle Spielergebnisse der aktuellen Runde ein, bevor Sie die nächste Runde berechnen!");
      return;
    }

    const currentRound = t.currentRound;
    const nextRound = currentRound + 1;

    if (nextRound > t.totalRounds) {
      alert(`Das Turnier ist beendet! Alle ${t.totalRounds} Runden wurden gespielt.`);
      return;
    }

    // Determine Winners and Losers for each court in the current round
    const courtResults = []; // array of { courtNumber, courtType, winner, loser }
    
    roundMatches.forEach(m => {
      let winner, loser;
      
      const sHome = parseInt(m.scoreHome);
      const sAway = parseInt(m.scoreAway);

      if (sHome > sAway) {
        winner = m.home;
        loser = m.away;
      } else if (sAway > sHome) {
        winner = m.away;
        loser = m.home;
      } else {
        // Tie-breaker: random or home team. Let's make it a coin toss!
        if (Math.random() > 0.5) {
          winner = m.home;
          loser = m.away;
        } else {
          winner = m.away;
          loser = m.home;
        }
      }

      courtResults.push({
        courtNumber: m.courtNumber,
        courtType: m.courtType,
        winner: winner,
        loser: loser
      });
    });

    // Sort by court number ascending (Court 1, Court 2...)
    courtResults.sort((a, b) => a.courtNumber - b.courtNumber);

    const totalFields = courtResults.length;
    const nextRoundMatches = [];
    let matchIdCounter = t.matches.length + 1;

    // Kaiser advancement logic:
    // - Winner of Court 1 stays on Court 1
    // - Loser of Court F stays on Court F (unless queue)
    // - Winner of Court i (i > 1) moves to Court i-1
    // - Loser of Court i (i < F) moves to Court i+1
    
    // We will place teams into slots for the next round
    const courtSlots = []; // array of size totalFields, each containing array of teams [teamA, teamB]
    for (let i = 0; i < totalFields; i++) {
      courtSlots.push([]);
    }

    // Waiting queue cycling if M > 2F
    let queue = t.kaiserWaitingQueue || [];

    for (let idx = 0; idx < totalFields; idx++) {
      const res = courtResults[idx];
      const courtNum = res.courtNumber; // 1-indexed

      // Winner moves up
      if (courtNum === 1) {
        // Winner stays on Court 1 (index 0)
        courtSlots[0].push(res.winner);
      } else {
        // Winner moves up to Court i-1 (index courtNum - 2)
        courtSlots[courtNum - 2].push(res.winner);
      }

      // Loser moves down
      if (courtNum === totalFields) {
        if (queue.length > 0) {
          // Loser of bottom court goes to the back of the waiting queue
          queue.push(res.loser);
          // Team at the front of the queue enters the bottom court
          const enteringTeam = queue.shift();
          courtSlots[totalFields - 1].push(enteringTeam);
        } else {
          // No queue: Loser stays on Court F
          courtSlots[totalFields - 1].push(res.loser);
        }
      } else {
        // Loser moves down to Court i+1 (index courtNum)
        courtSlots[courtNum].push(res.loser);
      }
    }

    // Build the new matches for the next round
    for (let i = 0; i < totalFields; i++) {
      const teamsOnCourt = courtSlots[i];
      const home = teamsOnCourt[0] || { name: 'Spielfrei' };
      const away = teamsOnCourt[1] || { name: 'Spielfrei' };
      
      const courtType = courtResults[i].courtType;

      t.matches.push({
        id: `m_${matchIdCounter++}`,
        round: nextRound,
        courtNumber: i + 1,
        courtType: courtType,
        home: home,
        away: away,
        scoreHome: null,
        scoreAway: null,
        completed: false
      });
    }

    t.kaiserWaitingQueue = queue;
    t.currentRound = nextRound;
    
    app.saveState();
    this.renderSchedule();
  },

  navigateRound(dir) {
    const t = app.state.tournament;
    if (!t) return;

    const target = t.currentRound + dir;
    if (target >= 1 && target <= t.totalRounds) {
      // In Kaiserturnier, you cannot skip forward to future rounds before calculating results
      if (t.mode === 'kaiser' && dir > 0 && target > t.matches[t.matches.length - 1].round) {
        alert("Bitte berechnen Sie zuerst die nächste Runde über den Button oben!");
        return;
      }
      
      t.currentRound = target;
      app.saveState();
      this.renderSchedule();
    }
  },

  updateScore(matchId, isHome, val) {
    const t = app.state.tournament;
    if (!t) return;

    const match = t.matches.find(m => m.id === matchId);
    if (!match) return;

    const score = val.trim() === '' ? null : parseInt(val);
    
    if (isHome) {
      match.scoreHome = score;
    } else {
      match.scoreAway = score;
    }

    match.completed = (match.scoreHome !== null && match.scoreAway !== null);
    
    this.calculateStandings(t);
    app.saveState();

    // Visual updates
    const card = document.getElementById(`matchcard_${matchId}`);
    if (card) {
      if (match.completed) {
        card.classList.add('completed');
      } else {
        card.classList.remove('completed');
      }
    }

    this.renderStandingsTable();
  },

  calculateStandings(tournament) {
    if (!tournament) return;

    // Reset standings map
    const stats = {};
    tournament.teams.forEach(team => {
      stats[team.id] = {
        team: team,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        points: 0
      };
    });

    // Loop through completed matches
    tournament.matches.forEach(m => {
      if (!m.completed) return;
      if (m.home.isDummy || m.away.isDummy) return; // ignore pauses

      const homeStat = stats[m.home.id];
      const awayStat = stats[m.away.id];

      if (!homeStat || !awayStat) return; // defense

      homeStat.played++;
      awayStat.played++;

      const sHome = parseInt(m.scoreHome);
      const sAway = parseInt(m.scoreAway);

      homeStat.goalsFor += sHome;
      homeStat.goalsAgainst += sAway;
      
      awayStat.goalsFor += sAway;
      awayStat.goalsAgainst += sHome;

      if (sHome > sAway) {
        homeStat.wins++;
        homeStat.points += 3;
        awayStat.losses++;
      } else if (sAway > sHome) {
        awayStat.wins++;
        awayStat.points += 3;
        homeStat.losses++;
      } else {
        homeStat.draws++;
        homeStat.points += 1;
        awayStat.draws++;
        awayStat.points += 1;
      }
    });

    // Map to array and sort
    const standings = Object.values(stats).sort((a, b) => {
      // Points desc
      if (b.points !== a.points) {
        return b.points - a.points;
      }
      // Goal Diff desc
      const diffA = a.goalsFor - a.goalsAgainst;
      const diffB = b.goalsFor - b.goalsAgainst;
      if (diffB !== diffA) {
        return diffB - diffA;
      }
      // Goals For desc
      return b.goalsFor - a.goalsFor;
    });

    tournament.standings = standings;
  },

  renderSchedule() {
    const summaryBox = document.getElementById('tournament-status-summary');
    const resultsPanel = document.getElementById('schedule-results-panel');
    const matchesContainer = document.getElementById('round-matches-container');
    const standingsPanel = document.getElementById('standings-table-panel');
    const nextKaiserContainer = document.getElementById('kaiser-next-round-btn-container');

    const t = app.state.tournament;

    if (!t) {
      if (resultsPanel) resultsPanel.style.display = 'none';
      if (summaryBox) {
        summaryBox.innerHTML = `<p style="color: var(--text-muted);"><i class="fa-solid fa-circle-info"></i> Kein aktives Turnier vorhanden. Tragen Sie links die Vereine ein und starten Sie den Generator.</p>`;
      }
      return;
    }

    // Render tournament summary
    if (summaryBox) {
      const modeText = t.mode === 'kaiser' ? 'Kaiserturnier' : 'Jeder gegen Jeden';
      const funinoText = t.funinoFields === 1 ? '1 Funino-Feld' : `${t.funinoFields} Funino-Felder`;
      const fourOneText = t.fourPlusOneFields === 1 ? '1 „4+1“-Feld' : `${t.fourPlusOneFields} „4+1“-Felder`;
      
      let queueText = '';
      if (t.mode === 'kaiser' && t.kaiserWaitingQueue && t.kaiserWaitingQueue.length > 0) {
        queueText = `<br><strong>Wartende Teams:</strong> ${t.kaiserWaitingQueue.map(q => q.name).join(', ')}`;
      }

      summaryBox.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:8px;">
          <div><strong>Modus:</strong> <span class="badge badge-primary">${modeText}</span></div>
          <div><strong>Teams gesamt:</strong> ${t.teams.length}</div>
          <div><strong>Spielfelder:</strong> ${funinoText} & ${fourOneText}</div>
          <div><strong>Spielrunden:</strong> ${t.totalRounds}</div>
          <div><strong>Aktuelle Runde:</strong> Runde ${t.currentRound} von ${t.totalRounds}</div>
          ${queueText}
        </div>
      `;
    }

    // Show results panel
    if (resultsPanel) resultsPanel.style.display = 'block';

    // Kaiser button visibility
    if (nextKaiserContainer) {
      nextKaiserContainer.style.display = (t.mode === 'kaiser' && t.currentRound < t.totalRounds) ? 'block' : 'none';
    }

    // Standings panel visibility
    if (standingsPanel) {
      standingsPanel.style.display = t.mode === 'roundrobin' ? 'block' : 'none';
    }

    // Render current round navigator text
    const displayRound = document.getElementById('current-round-display');
    if (displayRound) {
      displayRound.textContent = `Runde ${t.currentRound}`;
    }

    // Render matches for current round
    if (matchesContainer) {
      const roundMatches = t.matches.filter(m => m.round === t.currentRound);
      matchesContainer.innerHTML = '';

      if (roundMatches.length === 0) {
        matchesContainer.innerHTML = `<p style="color: var(--text-muted); grid-column: 1/-1; text-align: center; padding: 20px;">Keine Partien in dieser Runde.</p>`;
        return;
      }

      roundMatches.forEach(m => {
        const isCompleted = m.completed;
        
        const card = document.createElement('div');
        card.id = `matchcard_${m.id}`;
        card.className = `match-card glass-card ${isCompleted ? 'completed' : ''}`;

        const fieldTypeLabel = m.courtType === 'funino' ? 'Funino 3v3' : '4+1 Feld';
        const fieldBadgeClass = m.courtType === 'funino' ? 'match-field-funino' : 'match-field-4plus1';

        card.innerHTML = `
          <div class="match-header">
            <span class="match-field-badge ${fieldBadgeClass}">
              <i class="fa-solid fa-layer-group"></i> Platz ${m.courtNumber} (${fieldTypeLabel})
            </span>
            <span>Runde ${m.round}</span>
          </div>
          
          <div class="match-teams-container">
            <!-- Home Team -->
            <div class="match-team match-team-left">
              <span class="match-team-name" title="${m.home.name}">${m.home.name}</span>
              <span class="match-team-club">${m.home.clubName}</span>
            </div>

            <!-- Score inputs -->
            <div class="match-score-row">
              <input type="number" class="score-input" value="${m.scoreHome !== null ? m.scoreHome : ''}" min="0" placeholder="-" oninput="schedule.updateScore('${m.id}', true, this.value)">
              <span class="score-divider">:</span>
              <input type="number" class="score-input" value="${m.scoreAway !== null ? m.scoreAway : ''}" min="0" placeholder="-" oninput="schedule.updateScore('${m.id}', false, this.value)">
            </div>

            <!-- Away Team -->
            <div class="match-team match-team-right">
              <span class="match-team-name" title="${m.away.name}">${m.away.name}</span>
              <span class="match-team-club">${m.away.clubName}</span>
            </div>
          </div>
        `;
        matchesContainer.appendChild(card);
      });
    }

    this.renderStandingsTable();
  },

  renderStandingsTable() {
    const tableBody = document.getElementById('standings-table-body');
    const t = app.state.tournament;

    if (!tableBody || !t || t.mode !== 'roundrobin') return;

    tableBody.innerHTML = '';
    
    t.standings.forEach((s, idx) => {
      const tr = document.createElement('tr');
      const rank = idx + 1;
      
      let rankClass = `table-rank-${rank}`;
      if (rank > 3) rankClass = '';

      const diff = s.goalsFor - s.goalsAgainst;
      const formattedDiff = diff > 0 ? `+${diff}` : diff;

      tr.innerHTML = `
        <td class="table-rank ${rankClass}">#${rank}</td>
        <td>
          <span class="table-team-name">${s.team.name}</span>
          <div style="font-size:11px; color:var(--text-muted);">${s.team.clubName}</div>
        </td>
        <td class="table-stats-col">${s.played}</td>
        <td class="table-stats-col" style="color: ${diff > 0 ? 'var(--primary)' : diff < 0 ? 'var(--danger)' : 'var(--text-muted)'}; font-weight:600;">
          ${formattedDiff}
        </td>
        <td class="table-stats-col" style="font-weight: 800; color:var(--text-primary);">${s.points}</td>
      `;
      tableBody.appendChild(tr);
    });
  }
};

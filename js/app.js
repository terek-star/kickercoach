const app = {
  // Global State
  state: {
    theme: 'dark', // 'dark' or 'light'
    players: [
      // Pre-populated squad so it works immediately out of the box!
      { id: '1', name: 'Leon', strength: 3, birthYear: 2018, present: true },
      { id: '2', name: 'Mia', strength: 2, birthYear: 2018, present: true },
      { id: '3', name: 'Ben', strength: 3, birthYear: 2017, present: true },
      { id: '4', name: 'Emma', strength: 1, birthYear: 2018, present: true },
      { id: '5', name: 'Jonas', strength: 2, birthYear: 2017, present: true },
      { id: '6', name: 'Lina', strength: 2, birthYear: 2018, present: true },
      { id: '7', name: 'Noah', strength: 3, birthYear: 2018, present: true },
      { id: '8', name: 'Sofia', strength: 1, birthYear: 2019, present: true },
      { id: '9', name: 'Nico', strength: 2, birthYear: 2017, present: true },
      { id: '10', name: 'Paul', strength: 1, birthYear: 2018, present: false }
    ],
    // Own club divided teams
    ownTeams: [], // array of { name: 'Team Gold', players: [...] }
    teamSplitMode: 'homogeneous',
    teamSplitCount: 2,
    
    // Tournament settings & match scheduler state
    tournament: null
  },

  init() {
    // 1. Load from localStorage if present
    this.loadState();
    
    // 2. Setup theme
    this.setupTheme();

    // 3. Setup tabs navigation
    this.setupTabs();

    // 4. Initialize child modules
    squad.init();
    schedule.init();
    lineups.init();
    if (typeof training !== 'undefined') {
      training.init();
    }
    this.setupGeminiModal();
    this.setupFeedbackModal();

    // 5. Update overall stats
    this.updateStats();
  },

  // State Persistence
  saveState() {
    localStorage.setItem('kickercoach_state', JSON.stringify(this.state));
    this.updateStats();
  },

  loadState() {
    const saved = localStorage.getItem('kickercoach_state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Only override if structure looks ok
        if (parsed.players && Array.isArray(parsed.players)) {
          this.state = parsed;
        }
      } catch (e) {
        console.error("Failed to parse state from localStorage:", e);
      }
    }
  },

  // Stats updating
  updateStats() {
    const totalPlayers = this.state.players.length;
    const presentPlayers = this.state.players.filter(p => p.present).length;
    
    document.getElementById('stat-present-players').textContent = `${presentPlayers} / ${totalPlayers}`;
    document.getElementById('stat-teams-count').textContent = this.state.ownTeams.length;
    
    const modeDisplay = document.getElementById('stat-active-tournament');
    if (this.state.tournament) {
      modeDisplay.textContent = this.state.tournament.mode === 'kaiser' ? 'Kaiserturnier' : 'Jeder-g-Jeden';
    } else {
      modeDisplay.textContent = 'Keines';
    }

    // Training units stat
    const trainingStat = document.getElementById('stat-training-units');
    if (trainingStat) {
      if (typeof training !== 'undefined' && training.activePlan) {
        trainingStat.textContent = `${training.activePlan.units?.length || 8} Einheiten`;
      } else {
        trainingStat.textContent = '8 Einheiten';
      }
    }

    // Populate dashboard own teams list
    const ownTeamsList = document.getElementById('dashboard-teams-list');
    if (this.state.ownTeams && this.state.ownTeams.length > 0) {
      ownTeamsList.innerHTML = '';
      this.state.ownTeams.forEach(team => {
        const avgStrength = team.players.length > 0
          ? (team.players.reduce((sum, p) => sum + p.strength, 0) / team.players.length).toFixed(1)
          : '0.0';
        
        let badgeClass = 'badge-gray';
        if (team.name.includes('Gold')) badgeClass = 'badge-gold';
        else if (team.name.includes('Silber')) badgeClass = 'badge-silver';
        else if (team.name.includes('Bronze')) badgeClass = 'badge-bronze';

        const teamEl = document.createElement('div');
        teamEl.className = 'team-column-card';
        teamEl.style.marginBottom = '12px';
        teamEl.style.padding = '12px';
        teamEl.innerHTML = `
          <div class="team-column-header" style="margin-bottom: 8px; padding-bottom: 4px; display: flex; justify-content: space-between; align-items: center;">
            <span class="team-column-name"><span class="badge ${badgeClass}">${team.name}</span></span>
            <span class="team-strength-indicator" style="font-size:12px; color:var(--text-secondary);">⭐ ${avgStrength}</span>
          </div>
          <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.4;">
            ${team.players.map(p => p.name).join(', ') || 'Keine Spieler zugewiesen'}
          </div>
        `;
        ownTeamsList.appendChild(teamEl);
      });
    } else {
      ownTeamsList.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 20px;">Noch keine eigenen Teams eingeteilt.<br>Gehen Sie zum Kader-Tab, um Teams zu erstellen.</p>`;
    }
  },

  // Tabs management
  setupTabs() {
    const navLinks = document.querySelectorAll('.nav-link, .mobile-nav-link');
    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        const tabId = link.getAttribute('data-tab');
        this.navigateToTab(tabId);
      });
    });
  },

  navigateToTab(tabId) {
    // Update active tab buttons
    document.querySelectorAll('.nav-link, .mobile-nav-link').forEach(btn => {
      if (btn.getAttribute('data-tab') === tabId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update active panels
    document.querySelectorAll('.tab-panel').forEach(panel => {
      if (panel.id === tabId) {
        panel.classList.add('active');
      } else {
        panel.classList.remove('active');
      }
    });

    // Trigger tab-specific initialization or rendering
    if (tabId === 'training-tab') {
      if (typeof training !== 'undefined') {
        training.renderActiveView();
      }
    } else if (tabId === 'aufstellung-tab') {
      lineups.onTabFocus();
    } else if (tabId === 'kader-tab') {
      squad.renderSquad();
      squad.renderTeams();
    } else if (tabId === 'spielplan-tab') {
      schedule.renderClubs();
      schedule.renderSchedule();
    } else if (tabId === 'dashboard-tab') {
      this.updateStats();
    }
  },

  // Gemini API Settings Modal Controller
  setupGeminiModal() {
    const dialog = document.getElementById('gemini-settings-dialog');
    if (!dialog) return;

    const openBtns = [
      document.getElementById('gemini-settings-btn'),
      document.getElementById('mobile-gemini-btn')
    ].filter(Boolean);

    openBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const keyInput = document.getElementById('gemini-api-key-input');
        const modelSelect = document.getElementById('gemini-model-select');
        const testResult = document.getElementById('gemini-test-result');
        
        if (keyInput) keyInput.value = aiService.getApiKey();
        if (modelSelect) modelSelect.value = aiService.getModel();
        if (testResult) testResult.style.display = 'none';

        dialog.showModal();
      });
    });

    // Toggle key visibility
    const toggleVisBtn = document.getElementById('toggle-key-visibility-btn');
    const keyInput = document.getElementById('gemini-api-key-input');
    if (toggleVisBtn && keyInput) {
      toggleVisBtn.addEventListener('click', () => {
        if (keyInput.type === 'password') {
          keyInput.type = 'text';
          toggleVisBtn.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
        } else {
          keyInput.type = 'password';
          toggleVisBtn.innerHTML = '<i class="fa-solid fa-eye"></i>';
        }
      });
    }

    // Test connection button
    const testBtn = document.getElementById('test-gemini-connection-btn');
    const testResult = document.getElementById('gemini-test-result');
    if (testBtn && testResult) {
      testBtn.addEventListener('click', async () => {
        const testKey = keyInput ? keyInput.value.trim() : '';
        if (!testKey) {
          testResult.style.display = 'block';
          testResult.className = 'error-msg';
          testResult.textContent = 'Bitte zuerst einen Key eingeben.';
          return;
        }

        testBtn.disabled = true;
        testBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Prüfe...';
        testResult.style.display = 'block';
        testResult.className = 'loading-state';
        testResult.textContent = 'Verbindung zu Google Gemini wird getestet...';

        const result = await aiService.testConnection(testKey);
        testBtn.disabled = false;
        testBtn.innerHTML = '<i class="fa-solid fa-plug"></i> Verbindung testen';

        if (result.success) {
          testResult.className = 'success-msg';
          testResult.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${result.message}`;
          
          // Dynamisch alle tatsächlich verfügbaren Modelle in das Select-Dropdown einfügen
          if (result.models && result.models.length > 0 && modelSelect) {
            modelSelect.innerHTML = '';
            result.models.forEach(m => {
              const opt = document.createElement('option');
              opt.value = m.id;
              opt.textContent = `${m.displayName || m.id} (${m.apiVersion})`;
              if (m.id === result.activeModel) {
                opt.selected = true;
              }
              modelSelect.appendChild(opt);
            });
          }
        } else {
          testResult.className = 'error-msg';
          testResult.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${result.message}`;
        }
      });
    }

    // Save settings
    const saveBtn = document.getElementById('save-gemini-settings-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const key = keyInput ? keyInput.value.trim() : '';
        const modelSelect = document.getElementById('gemini-model-select');
        const model = modelSelect ? modelSelect.value : aiService.getModel();

        aiService.setApiKey(key, model);
        if (typeof training !== 'undefined') {
          training.updateApiKeyIndicator();
        }
        dialog.close();
        alert(key ? `Google Gemini API-Key erfolgreich gespeichert! (Modell: ${model})` : 'API-Key entfernt.');
      });
    }
  },

  // Feedback Modal Management
  setupFeedbackModal() {
    const dialog = document.getElementById('feedback-dialog');
    if (!dialog) return;

    const openTriggers = [
      document.getElementById('feedback-open-btn'),
      document.getElementById('dash-feedback-btn'),
      document.getElementById('mobile-feedback-btn')
    ];

    openTriggers.forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => {
          dialog.showModal();
        });
      }
    });

    // Rating star handler (1 to 5 balls)
    let currentRating = 5;
    const ratingLabels = {
      1: 'Bewertung: 1 / 5 (Ausbaufähig)',
      2: 'Bewertung: 2 / 5 (Ganz okay)',
      3: 'Bewertung: 3 / 5 (Gut)',
      4: 'Bewertung: 4 / 5 (Sehr gut)',
      5: 'Bewertung: 5 / 5 (Überragend!)'
    };
    const starContainer = document.getElementById('feedback-rating-container');
    const labelElem = document.getElementById('feedback-rating-label');

    if (starContainer) {
      const stars = starContainer.querySelectorAll('.rating-star');
      stars.forEach(star => {
        star.addEventListener('click', () => {
          const val = parseInt(star.getAttribute('data-val') || '5', 10);
          currentRating = val;
          stars.forEach(s => {
            const sVal = parseInt(s.getAttribute('data-val') || '1', 10);
            if (sVal <= val) {
              s.classList.add('active');
            } else {
              s.classList.remove('active');
            }
          });
          if (labelElem && ratingLabels[val]) {
            labelElem.textContent = ratingLabels[val];
          }
        });
      });
    }

    // Helper: Build structured feedback payload
    const getFeedbackPayload = () => {
      const category = document.getElementById('feedback-category-select')?.value || 'Allgemein';
      const name = document.getElementById('feedback-trainer-name')?.value.trim() || '';
      const text = document.getElementById('feedback-text')?.value.trim() || '';
      return { rating: currentRating, category, name, text, date: new Date().toISOString() };
    };

    const saveFeedbackLocally = (payload) => {
      try {
        const history = JSON.parse(localStorage.getItem('kickercoach_feedback_history') || '[]');
        history.push(payload);
        localStorage.setItem('kickercoach_feedback_history', JSON.stringify(history));
      } catch (e) {
        console.warn('Could not save feedback to localStorage', e);
      }
    };

    // 1. Email Sender
    const emailBtn = document.getElementById('feedback-email-btn');
    if (emailBtn) {
      emailBtn.addEventListener('click', () => {
        const payload = getFeedbackPayload();
        if (!payload.text) {
          alert('Bitte gib kurz eine Anmerkung oder einen Wunsch im Textfeld ein.');
          document.getElementById('feedback-text')?.focus();
          return;
        }
        saveFeedbackLocally(payload);
        const subject = `[KickerCoach Feedback] ${payload.category}`;
        const body = `Hallo Rob,\n\nhier ist mein Trainer-Feedback zu KickerCoach:\n\n• Thema: ${payload.category}\n• Bewertung: ${payload.rating} von 5 Bällen\n• Von: ${payload.name || 'Trainerkollege (anonym)'}\n\nFeedback & Anmerkung:\n${payload.text}\n\n---\nKickerCoach Web-App v3`;
        
        window.location.href = `mailto:terek@gmx.de?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        dialog.close();
      });
    }

    // 2. WhatsApp Sender
    const waBtn = document.getElementById('feedback-whatsapp-btn');
    if (waBtn) {
      waBtn.addEventListener('click', () => {
        const payload = getFeedbackPayload();
        if (!payload.text) {
          alert('Bitte gib kurz eine Anmerkung oder einen Wunsch im Textfeld ein.');
          document.getElementById('feedback-text')?.focus();
          return;
        }
        saveFeedbackLocally(payload);
        const balls = '⚽'.repeat(payload.rating);
        const text = `⚽ *KickerCoach Trainer-Feedback*\n\n• *Thema:* ${payload.category}\n• *Bewertung:* ${balls} (${payload.rating}/5)\n• *Von:* ${payload.name || 'Trainerkollege'}\n\n*Anmerkung / Wunsch:*\n${payload.text}`;
        
        window.open(`https://api.whatsapp.com/send?phone=4917622350283&text=${encodeURIComponent(text)}`, '_blank');
      });
    }

    // 3. Copy to Clipboard
    const copyBtn = document.getElementById('feedback-copy-btn');
    const toast = document.getElementById('feedback-toast');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const payload = getFeedbackPayload();
        const balls = '⚽'.repeat(payload.rating);
        const text = `⚽ KickerCoach Trainer-Feedback\nThema: ${payload.category}\nBewertung: ${balls} (${payload.rating}/5)\nVon: ${payload.name || 'Trainerkollege'}\n\nFeedback:\n${payload.text || '(Kein Text eingetragen)'}`;
        
        navigator.clipboard.writeText(text).then(() => {
          saveFeedbackLocally(payload);
          if (toast) {
            toast.style.display = 'block';
            setTimeout(() => {
              toast.style.display = 'none';
            }, 3000);
          }
        });
      });
    }
  },

  // Theme Management (Light/Dark Mode toggle)
  setupTheme() {
    const toggleBtns = [
      document.getElementById('theme-toggle'),
      document.getElementById('mobile-theme-toggle')
    ].filter(Boolean);
    if (toggleBtns.length === 0) return;
    const root = document.documentElement;

    const applyTheme = (theme) => {
      if (theme === 'light') {
        root.setAttribute('data-theme', 'light');
        toggleBtns.forEach(btn => {
          const span = btn.querySelector('span');
          if (span) span.textContent = 'Hellmodus';
          const icon = btn.querySelector('i');
          if (icon) icon.className = 'fa-solid fa-sun';
        });
      } else {
        root.removeAttribute('data-theme');
        toggleBtns.forEach(btn => {
          const span = btn.querySelector('span');
          if (span) span.textContent = 'Dunkelmodus';
          const icon = btn.querySelector('i');
          if (icon) icon.className = 'fa-solid fa-moon';
        });
      }
    };

    applyTheme(this.state.theme);

    toggleBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.state.theme = this.state.theme === 'dark' ? 'light' : 'dark';
        applyTheme(this.state.theme);
        this.saveState();
      });
    });
  }
};

// Kick off when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  app.init();
});

// Register Service Worker for PWA (Offline & Mobile Installation)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then(reg => console.log('[Service Worker] Registrierung erfolgreich!', reg))
      .catch(err => console.error('[Service Worker] Registrierung fehlgeschlagen:', err));
  });
}

/* Blackout al Faro — regia digitale single-device */
(function () {
  "use strict";

  const Engine = window.BlackoutEngine;
  if (!Engine) {
    throw new Error("BlackoutEngine non caricato. Verifica l'ordine degli script.");
  }

  const STORAGE_KEY = "blackout-al-faro:partita:v2";
  const STATE_VERSION = 2;
  const HOLD_DURATION = 720;
  const HANDOFF_DURATION = 2800;

  const ROLE_COPY = {
    custode: {
      name: "Custode",
      category: "Base",
      faction: "custodi",
      asset: "custode.png",
      power: "Non hai poteri notturni. Osserva, discuti e individua i Sabotatori.",
      uses: 0
    },
    sabotatore: {
      name: "Sabotatore",
      category: "Base",
      faction: "sabotatori",
      asset: "sabotatore.png",
      power: "Ogni notte concorda con gli altri Sabotatori un unico bersaglio.",
      uses: null
    },
    sentinella: {
      name: "Sentinella",
      category: "Indagine",
      faction: "custodi",
      asset: "sentinella.png",
      power: "Una volta per partita scopri l'allineamento di un altro giocatore vivo.",
      uses: 1
    },
    tecnico: {
      name: "Tecnico",
      category: "Protezione",
      faction: "custodi",
      asset: "tecnico.png",
      power: "Una volta per partita, dopo la scelta dei Sabotatori, puoi annullare il sabotaggio.",
      uses: 1
    },
    portavoce: {
      name: "Portavoce",
      category: "Influenza",
      faction: "custodi",
      asset: "portavoce.png",
      power: "Quando vieni eliminato lasci un messaggio di massimo dieci parole e assegni un voto doppio.",
      uses: 0
    },
    naufrago: {
      name: "Naufrago",
      category: "Neutrale",
      faction: "neutrale",
      asset: "naufrago.png",
      power: "Non hai poteri. Vinci con la fazione vincitrice soltanto se sei ancora vivo.",
      uses: 0
    },
    vedetta: {
      name: "Vedetta",
      category: "Indagine",
      faction: "custodi",
      asset: "vedetta.png",
      power: "Due volte per partita scopri se un altro giocatore ha compiuto un'azione notturna.",
      uses: 2
    },
    cartografa: {
      name: "Cartografa della Baia",
      category: "Indagine",
      faction: "custodi",
      asset: "cartografa-della-baia.png",
      power: "Due volte per partita confronti due giocatori vivi e scopri se appartengono alla stessa fazione.",
      uses: 2
    },
    guastatore: {
      name: "Guastatore",
      category: "Guasto",
      faction: "sabotatori",
      asset: "guastatore.png",
      power: "Una volta per partita disattivi i poteri notturni attivi dei Custodi.",
      uses: 1
    }
  };

  const SPECIAL_IDS = [
    "sentinella",
    "vedetta",
    "cartografa",
    "tecnico",
    "portavoce",
    "naufrago",
    "guastatore"
  ];

  const CATEGORY_CODES = {
    sentinella: "I",
    vedetta: "I",
    cartografa: "I",
    tecnico: "P",
    portavoce: "V",
    naufrago: "N",
    guastatore: "G"
  };

  const FACTION_LABELS = {
    custodi: "Fazione dei Custodi",
    sabotatori: "Fazione dei Sabotatori",
    neutrale: "Neutrale"
  };

  const AUDIO_LABELS = {
    muted: "Muto",
    voice: "Voce",
    "voice-ambience": "Voce e atmosfera"
  };

  const app = document.getElementById("app");
  const announcer = document.getElementById("public-announcer");
  const privacyCover = document.getElementById("privacy-cover");

  let savedGame = readSavedGame();
  let state = createInitialState();
  let privacyIsCovered = false;
  let holdTimer = null;
  let holdButton = null;
  let lastNarrationKey = "";
  let privacyReturnFocus = null;
  let handoffTimer = null;
  let narrationInterrupted = false;

  class AudioDirector {
    constructor() {
      this.mode = "voice-ambience";
      this.context = null;
      this.ambienceGain = null;
      this.noiseSource = null;
      this.lastText = "";
      this.voiceEnabled = true;
      this.ambienceEnabled = true;
      this.started = false;
      this.activeSpeech = null;
    }

    setMode(mode) {
      this.mode = AUDIO_LABELS[mode] ? mode : "muted";
      this.voiceEnabled = this.mode !== "muted";
      this.ambienceEnabled = this.mode === "voice-ambience";
      if (this.ambienceGain && this.context) {
        const target = this.ambienceEnabled ? 0.035 : 0;
        this.ambienceGain.gain.cancelScheduledValues(this.context.currentTime);
        this.ambienceGain.gain.linearRampToValueAtTime(target, this.context.currentTime + 0.35);
      }
      if (!this.voiceEnabled) this.cancelSpeech();
      syncAudioControls();
    }

    async enable() {
      this.started = true;
      if (!this.ambienceEnabled) return;
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        if (!this.context) this.createAmbience(AudioContext);
        if (this.context.state === "suspended") await this.context.resume();
      } catch (_error) {
        // Il gioco resta completamente utilizzabile senza Web Audio.
      }
    }

    createAmbience(AudioContext) {
      this.context = new AudioContext();
      const length = this.context.sampleRate * 3;
      const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
      const channel = buffer.getChannelData(0);
      let previous = 0;
      for (let i = 0; i < length; i += 1) {
        const white = Math.random() * 2 - 1;
        previous = previous * 0.985 + white * 0.015;
        channel[i] = previous * 2.4;
      }

      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const filter = this.context.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 680;
      const gain = this.context.createGain();
      gain.gain.value = this.ambienceEnabled ? 0.035 : 0;
      source.connect(filter).connect(gain).connect(this.context.destination);
      source.start();
      this.noiseSource = source;
      this.ambienceGain = gain;
    }

    bell() {
      if (!this.context || !this.ambienceEnabled) return;
      const now = this.context.currentTime;
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(330, now);
      oscillator.frequency.exponentialRampToValueAtTime(260, now + 1.5);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.045, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);
      oscillator.connect(gain).connect(this.context.destination);
      oscillator.start(now);
      oscillator.stop(now + 1.9);
    }

    speak(text, remember = true, onComplete = null) {
      const complete = typeof onComplete === "function" ? onComplete : () => {};
      if (!text) {
        complete();
        return false;
      }
      if (remember) this.lastText = text;
      if (!this.voiceEnabled || !("speechSynthesis" in window)) {
        complete();
        return false;
      }
      this.cancelSpeech();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "it-IT";
      utterance.rate = 0.94;
      utterance.pitch = 0.92;
      const voices = window.speechSynthesis.getVoices();
      const italian = voices.find((voice) => voice.lang && voice.lang.toLowerCase().startsWith("it"));
      if (italian) utterance.voice = italian;
      this.duck(true);
      let completed = false;
      const speech = { utterance, cancelled: false };
      this.activeSpeech = speech;
      const finish = () => {
        if (completed) return;
        completed = true;
        if (this.activeSpeech === speech) this.activeSpeech = null;
        this.duck(false);
        if (!speech.cancelled) complete();
      };
      utterance.onend = finish;
      utterance.onerror = finish;
      try {
        window.speechSynthesis.speak(utterance);
        return true;
      } catch (_error) {
        finish();
        return false;
      }
    }

    repeat(onComplete = null) {
      if (!this.lastText) return false;
      return this.speak(this.lastText, false, onComplete);
    }

    duck(active) {
      if (!this.ambienceGain || !this.context) return;
      const target = !this.ambienceEnabled ? 0 : active ? 0.009 : 0.035;
      this.ambienceGain.gain.cancelScheduledValues(this.context.currentTime);
      this.ambienceGain.gain.linearRampToValueAtTime(target, this.context.currentTime + 0.18);
    }

    stop() {
      this.cancelSpeech();
      if (this.context) {
        this.context.close().catch(() => {});
      }
      this.context = null;
      this.ambienceGain = null;
      this.noiseSource = null;
      this.started = false;
    }

    cancelSpeech() {
      const speech = this.activeSpeech;
      if (speech) {
        speech.cancelled = true;
        this.activeSpeech = null;
      }
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      this.duck(false);
      return Boolean(speech);
    }
  }

  const audio = new AudioDirector();

  function createInitialState() {
    const count = 8;
    return {
      version: STATE_VERSION,
      screen: "welcome",
      setup: {
        playerCount: count,
        names: makeNames(count),
        specialRoles: defaultSpecials(count),
        audioMode: "voice-ambience"
      },
      players: [],
      assignmentIndex: 0,
      assignmentRevealed: false,
      day: 1,
      phase: "setup",
      doubleVote: null,
      night: null,
      lastElimination: null,
      lastDawn: null,
      pendingPortavoce: null,
      afterPortavoce: null,
      winner: null,
      correctionSnapshot: null,
      audioWasForced: false
    };
  }

  function makeNames(count, previous = []) {
    return Array.from({ length: count }, (_unused, index) =>
      previous[index] || `Giocatore ${index + 1}`
    );
  }

  function defaultSpecials(count) {
    if (count <= 6) return ["sentinella"];
    if (count === 7) return ["sentinella", "tecnico"];
    if (count === 8) return ["sentinella", "guastatore"];
    if (count <= 11) return ["sentinella", "tecnico", "naufrago"];
    return ["guastatore", "sentinella", "cartografa", "naufrago"];
  }

  function clone(value) {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function saveGame() {
    if (state.screen === "welcome" || state.screen === "setup" || !state.players.length) return;
    const safeState = clone(state);
    safeState.assignmentRevealed = false;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(safeState));
      savedGame = safeState;
    } catch (_error) {
      // Storage può essere disabilitato: la sessione corrente continua.
    }
  }

  function readSavedGame() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      const hydrated = hydrateSavedGame(parsed);
      if (hydrated) return hydrated;
      localStorage.removeItem(STORAGE_KEY);
    } catch (_error) {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (_storageError) {
        // Storage non disponibile.
      }
    }
    return null;
  }

  function hydrateSavedGame(parsed) {
    if (
      !parsed ||
      parsed.version !== STATE_VERSION ||
      !Array.isArray(parsed.players) ||
      parsed.players.length < 5 ||
      parsed.players.length > 15
    ) {
      return null;
    }

    const ids = new Set();
    for (const player of parsed.players) {
      const role = player && Engine.ROLES[player.roleId];
      if (
        !player ||
        typeof player.id !== "string" ||
        !player.id ||
        ids.has(player.id) ||
        typeof player.name !== "string" ||
        !player.name.trim() ||
        !role ||
        typeof player.alive !== "boolean" ||
        !Number.isInteger(player.usesRemaining) ||
        player.usesRemaining < 0 ||
        player.usesRemaining > role.maxUses
      ) {
        return null;
      }
      ids.add(player.id);
    }

    const allowedScreens = new Set([
      "assignment",
      "ready",
      "day",
      "day-elimination",
      "elimination",
      "night",
      "dawn",
      "portavoce",
      "winner",
      "rules"
    ]);
    if (!allowedScreens.has(parsed.screen)) return null;

    const selected = Array.isArray(parsed.setup?.specialRoles)
      ? parsed.setup.specialRoles
      : [];
    if (!Engine.validateSpecialSelection(parsed.players.length, selected).valid) {
      return null;
    }
    const actualRoles = parsed.players.map((player) => player.roleId).sort();
    const expectedRoles = Engine.buildRoleDeck(parsed.players.length, selected).sort();
    if (JSON.stringify(actualRoles) !== JSON.stringify(expectedRoles)) {
      return null;
    }

    const base = createInitialState();
    const audioMode = AUDIO_LABELS[parsed.setup?.audioMode]
      ? parsed.setup.audioMode
      : base.setup.audioMode;
    const hydrated = {
      ...base,
      ...parsed,
      setup: {
        ...base.setup,
        ...parsed.setup,
        playerCount: parsed.players.length,
        names: parsed.players.map((player) => player.name),
        specialRoles: selected.slice(),
        audioMode
      },
      players: parsed.players.map((player) => ({
        ...player,
        faction: Engine.ROLES[player.roleId].faction
      })),
      day: Number.isInteger(parsed.day) && parsed.day > 0 ? parsed.day : 1,
      assignmentRevealed: false,
      audioWasForced: parsed.audioWasForced === true
    };
    if (hydrated.screen === "night" && hydrated.setup.audioMode === "muted") {
      hydrated.audioWasForced = true;
    }

    if (
      hydrated.screen === "night" &&
      (!hydrated.night ||
        !Array.isArray(hydrated.night.steps) ||
        !Number.isInteger(hydrated.night.stepIndex) ||
        hydrated.night.stepIndex < 0 ||
        hydrated.night.stepIndex >= hydrated.night.steps.length ||
        !hydrated.night.actions ||
        JSON.stringify(hydrated.night.steps) !==
          JSON.stringify(buildNightStepsFor(hydrated.players)))
    ) {
      return null;
    }
    if (
      hydrated.screen === "assignment" &&
      (!Number.isInteger(hydrated.assignmentIndex) ||
        hydrated.assignmentIndex < 0 ||
        hydrated.assignmentIndex > hydrated.players.length)
    ) {
      return null;
    }
    if (
      hydrated.screen === "elimination" &&
      !ids.has(hydrated.lastElimination?.playerId)
    ) {
      return null;
    }
    if (
      hydrated.screen === "dawn" &&
      (!hydrated.lastDawn ||
        (hydrated.lastDawn.victimId !== null &&
          !ids.has(hydrated.lastDawn.victimId)))
    ) {
      return null;
    }
    if (
      hydrated.screen === "portavoce" &&
      (!ids.has(hydrated.pendingPortavoce?.playerId) ||
        playerFrom(hydrated.players, hydrated.pendingPortavoce.playerId)?.roleId !==
          "portavoce")
    ) {
      return null;
    }
    if (hydrated.screen === "winner" && !normalizeWin(hydrated.winner).ended) {
      return null;
    }
    if (hydrated.doubleVote) {
      const source = playerFrom(
        hydrated.players,
        hydrated.doubleVote.sourcePlayerId
      );
      const designated = playerFrom(
        hydrated.players,
        hydrated.doubleVote.designatedPlayerId
      );
      if (
        !source ||
        source.roleId !== "portavoce" ||
        !designated ||
        !Number.isInteger(hydrated.doubleVote.createdOnDay)
      ) {
        hydrated.doubleVote = null;
      }
    }
    return hydrated;
  }

  function playerFrom(players, id) {
    return players.find((player) => player.id === id) || null;
  }

  function clearSavedGame() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (_error) {
      // Nessuna azione necessaria.
    }
    savedGame = null;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function roleMeta(roleId) {
    return ROLE_COPY[roleId] || {
      name: roleId,
      category: "Ruolo",
      faction: "custodi",
      asset: "custode.png",
      power: "",
      uses: 0
    };
  }

  function roleAsset(roleId) {
    return `art/cards/minimal/labelled/${roleMeta(roleId).asset}`;
  }

  function playerById(id) {
    return state.players.find((player) => player.id === id) || null;
  }

  function alivePlayers() {
    return state.players.filter((player) => player.alive);
  }

  function rolePlayer(roleId, aliveOnly = true) {
    return state.players.find((player) => player.roleId === roleId && (!aliveOnly || player.alive)) || null;
  }

  function factionOf(player) {
    if (!player) return "";
    if (player.faction) return player.faction;
    return roleMeta(player.roleId).faction;
  }

  function compositionValidation() {
    try {
      return Engine.validateSpecialSelection(
        Number(state.setup.playerCount),
        state.setup.specialRoles
      );
    } catch (error) {
      return { valid: false, errors: [{ message: error.message }] };
    }
  }

  function setupIssues() {
    const validation = compositionValidation();
    const issues = (validation.errors || []).map(formatRuleError);
    const names = state.setup.names.map((name) => name.trim()).filter(Boolean);
    if (names.length !== state.setup.playerCount) {
      issues.push("Ogni giocatore deve avere un nome.");
    }
    const unique = new Set(names.map((name) => name.toLocaleLowerCase("it")));
    if (unique.size !== names.length) {
      issues.push("Usa nomi diversi per riconoscere sempre il bersaglio corretto.");
    }
    return issues;
  }

  function formatRuleError(error) {
    if (typeof error === "string") return error;
    if (error && error.message) return error.message;
    const messages = {
      wrong_special_count: "Seleziona esattamente il numero di speciali indicato.",
      category_limit: "È stato superato il limite di una categoria.",
      guastatore_requires_two_saboteurs: "Il Guastatore richiede almeno due Sabotatori.",
      naufrago_guastatore_conflict: "Tra 8 e 11 giocatori Naufrago e Guastatore non possono convivere.",
      double_investigation_requires_guastatore: "Due investigatori richiedono almeno 12 giocatori e il Guastatore."
    };
    return messages[error && error.code] || "La combinazione scelta non rispetta i limiti.";
  }

  function getCompositionRule() {
    try {
      return Engine.getCompositionRule(state.setup.playerCount);
    } catch (_error) {
      const count = state.setup.playerCount;
      return { specialCount: count <= 6 ? 1 : count <= 8 ? 2 : count <= 11 ? 3 : 4 };
    }
  }

  function render() {
    if (handoffTimer) {
      window.clearTimeout(handoffTimer);
      handoffTimer = null;
    }
    document.body.dataset.theme = sceneForState() === "night" ? "night" : "public";
    audio.setMode(effectiveAudioMode());
    let html = "";
    switch (state.screen) {
      case "welcome":
        html = renderWelcome();
        break;
      case "setup":
        html = renderSetup();
        break;
      case "assignment":
        html = renderAssignment();
        break;
      case "ready":
        html = renderReady();
        break;
      case "day":
        html = renderDay();
        break;
      case "day-elimination":
        html = renderDayElimination();
        break;
      case "elimination":
        html = renderElimination();
        break;
      case "night":
        html = renderNight();
        break;
      case "dawn":
        html = renderDawn();
        break;
      case "portavoce":
        html = renderPortavoce();
        break;
      case "winner":
        html = renderWinner();
        break;
      case "rules":
        html = renderRules();
        break;
      default:
        state.screen = "welcome";
        html = renderWelcome();
    }
    app.innerHTML = html;
    app.querySelector("h1, h2, [data-focus]")?.focus({ preventScroll: true });
    announcePublic();
    startScreenNarration();
    syncAudioControls();
    if (document.hidden && isSecretState()) showPrivacyCover();
  }

  function sceneForState() {
    if (state.screen === "night" || (state.screen === "assignment" && state.assignmentRevealed)) return "night";
    if (state.screen === "winner") return "dawn";
    return "public";
  }

  function effectiveAudioMode() {
    return state.audioWasForced ? "voice" : state.setup.audioMode;
  }

  function shell({ eyebrow = "Blackout al Faro", title, intro = "", body = "", actions = "", compact = false }) {
    return `
      <section class="screen ${sceneForState() === "night" ? "screen--night" : ""} ${isSecretState() ? "screen--secret" : ""} ${compact ? "screen--compact" : ""}">
        <header class="screen__header">
          <p class="eyebrow">${escapeHtml(eyebrow)}</p>
          <h1 tabindex="-1">${escapeHtml(title)}</h1>
          ${intro ? `<p class="lead">${escapeHtml(intro)}</p>` : ""}
        </header>
        <div class="screen__body">${body}</div>
        ${actions ? `<div class="action-bar">${actions}</div>` : ""}
      </section>
    `;
  }

  function renderWelcome() {
    const resume = savedGame
      ? `<button class="button button--secondary button--block" data-action="continue-game">
           Continua la partita
           <span class="button__meta">${escapeHtml(resumeLabel(savedGame))}</span>
         </button>`
      : "";
    return shell({
      eyebrow: "Port Leon presenta",
      title: "Blackout al Faro",
      intro: "Deduzione sociale guidata da un solo dispositivo. Nessun narratore esterno necessario.",
      body: `
        <div class="hero-mark" aria-hidden="true">
          <img src="art/cards/minimal/card-back-lighthouse.png" alt="" />
        </div>
        <div class="stack">
          <button class="button button--primary button--block" data-action="new-game">Nuova partita</button>
          ${resume}
          <button class="button button--ghost button--block" data-action="rules">Regole rapide</button>
        </div>
        <p class="privacy-note">I ruoli restano su questo dispositivo e vengono cancellati quando chiudi la partita.</p>
      `
    });
  }

  function resumeLabel(saved) {
    if (saved.winner) return "Partita conclusa";
    if (saved.screen === "assignment") return "Assegnazione in corso";
    return `Giorno ${saved.day || 1}`;
  }

  function renderSetup() {
    const rule = getCompositionRule();
    const validation = compositionValidation();
    const issues = setupIssues();
    const required = rule.specialSlots ?? rule.specialCount ?? rule.totalSpecials ?? 0;
    const saboteurSlots = Engine.getSaboteurCount(state.setup.playerCount);
    const ordinarySaboteurs = saboteurSlots - (state.setup.specialRoles.includes("guastatore") ? 1 : 0);
    const baseCustodians = state.setup.playerCount - state.setup.specialRoles.length - ordinarySaboteurs;
    const categoryCounts = state.setup.specialRoles.reduce((counts, roleId) => {
      const code = CATEGORY_CODES[roleId];
      counts[code] = (counts[code] || 0) + 1;
      return counts;
    }, {});

    const specialCards = SPECIAL_IDS.map((roleId) => {
      const meta = roleMeta(roleId);
      const checked = state.setup.specialRoles.includes(roleId);
      const disabled = roleId === "guastatore" && Engine.getSaboteurCount(state.setup.playerCount) < 2;
      return `
        <label class="role-choice ${checked ? "is-selected" : ""} ${disabled ? "is-disabled" : ""}">
          <input type="checkbox" data-field="setup-special" value="${roleId}" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""} />
          <img src="${roleAsset(roleId)}" alt="" />
          <span class="role-choice__copy">
            <strong>${escapeHtml(meta.name)}</strong>
            <small><span class="category-chip">${CATEGORY_CODES[roleId]}</span> ${escapeHtml(meta.category)} · ${escapeHtml(FACTION_LABELS[meta.faction])}</small>
          </span>
          <span class="check-mark" aria-hidden="true">✓</span>
        </label>
      `;
    }).join("");

    const nameFields = state.setup.names.map((name, index) => `
      <label class="field">
        <span>Giocatore ${index + 1}</span>
        <input type="text" maxlength="24" autocomplete="off" data-field="setup-name" data-index="${index}" value="${escapeHtml(name)}" />
      </label>
    `).join("");

    const errors = issues.length
      ? `<div class="alert alert--warning" role="status" data-setup-validation><strong>Configurazione da completare</strong><ul>${issues.map((issue) => `<li>${escapeHtml(issue)}</li>`).join("")}</ul></div>`
      : `<div class="alert alert--success" role="status" data-setup-validation>Configurazione valida: pronta per l'assegnazione.</div>`;

    return shell({
      eyebrow: "Nuova partita",
      title: "Prepara l'equipaggio",
      intro: "La composizione è pubblica; soltanto l'assegnazione dei ruoli resterà segreta.",
      body: `
        <div class="panel">
          <label class="field field--large">
            <span>Numero di giocatori</span>
            <select data-field="setup-player-count">
              ${Array.from({ length: 11 }, (_unused, index) => index + 5)
                .map((count) => `<option value="${count}" ${count === state.setup.playerCount ? "selected" : ""}>${count}</option>`)
                .join("")}
            </select>
          </label>
          <div class="composition-strip">
            <span><strong>${saboteurSlots}</strong> Sabotatori totali</span>
            <span><strong>${required}</strong> Speciali</span>
            <span><strong>${baseCustodians}</strong> Custodi base</span>
          </div>
        </div>

        <section class="section-block">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Scelta pubblica</p>
              <h2>Personaggi speciali</h2>
            </div>
            <span class="counter ${state.setup.specialRoles.length === required ? "is-complete" : ""}">
              ${state.setup.specialRoles.length}/${required}
            </span>
          </div>
          <p class="helper">Categorie scelte: ${Object.entries(categoryCounts).map(([code, count]) => `${code}×${count}`).join(" · ") || "nessuna"}</p>
          <div class="role-grid">${specialCards}</div>
        </section>

        <section class="section-block">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Sul dispositivo</p>
              <h2>Nomi dei giocatori</h2>
            </div>
          </div>
          <div class="name-grid">${nameFields}</div>
        </section>

        <section class="section-block">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Narratore</p>
              <h2>Audio iniziale</h2>
            </div>
          </div>
          <div class="segmented">
            ${Object.entries(AUDIO_LABELS).map(([value, label]) => `
              <label>
                <input type="radio" name="setup-audio" data-field="setup-audio" value="${value}" ${state.setup.audioMode === value ? "checked" : ""} />
                <span>${escapeHtml(label)}</span>
              </label>
            `).join("")}
          </div>
          <p class="helper">La voce narrante non legge le informazioni segrete. Con un lettore di schermo usa cuffie; su mobile attiva “Non disturbare”.</p>
        </section>
        ${errors}
      `,
      actions: `
        <button class="button button--ghost" data-action="back-welcome">Indietro</button>
        <button class="button button--primary" data-action="start-assignment" ${validation.valid && !issues.length ? "" : "disabled"}>Distribuisci i ruoli</button>
      `
    });
  }

  function renderAssignment() {
    const player = state.players[state.assignmentIndex];
    if (!player) {
      state.screen = "ready";
      return renderReady();
    }
    const progress = `${state.assignmentIndex + 1} di ${state.players.length}`;
    if (!state.assignmentRevealed) {
      return shell({
        eyebrow: `Assegnazione · ${progress}`,
        title: `Passa il dispositivo a ${player.name}`,
        intro: "Gli altri distolgano lo sguardo. Tieni premuto per vedere il ruolo.",
        body: `
          <div class="card-viewer card-viewer--back">
            <img src="art/cards/minimal/card-back-lighthouse.png" alt="Dorso della carta con il faro" />
          </div>
          <button class="hold-button" data-action="hold-reveal" aria-label="Tieni premuto per rivelare il ruolo">
            <span class="hold-button__progress" aria-hidden="true"></span>
            <span>Tieni premuto per rivelare</span>
          </button>
        `,
        actions: `<button class="button button--ghost" data-action="abort-assignment">Annulla assegnazione</button>`
      });
    }

    const meta = roleMeta(player.roleId);
    return shell({
      eyebrow: `${player.name} · Informazione segreta`,
      title: `Sei ${meta.name}`,
      intro: meta.power,
      body: `
        <div class="secret-banner">Solo ${escapeHtml(player.name)} deve guardare lo schermo</div>
        <div class="card-viewer card-viewer--front">
          <img src="${roleAsset(player.roleId)}" alt="Carta ${escapeHtml(meta.name)}" />
        </div>
        <div class="role-facts">
          <span class="pill">${escapeHtml(FACTION_LABELS[factionOf(player)])}</span>
          ${meta.uses ? `<span class="pill pill--amber">${meta.uses} ${meta.uses === 1 ? "uso" : "usi"} per partita</span>` : ""}
        </div>
      `,
      actions: `<button class="button button--primary button--block" data-action="hide-role">Nascondi e passa</button>`
    });
  }

  function renderReady() {
    const selected = state.setup.specialRoles.map((id) => roleMeta(id).name).join(", ");
    return shell({
      eyebrow: "Assegnazione completata",
      title: "Il faro è pronto",
      intro: "Posate il dispositivo al centro. La partita inizierà di giorno.",
      body: `
        <div class="lighthouse-divider" aria-hidden="true"><span></span></div>
        <div class="panel">
          <dl class="summary-list">
            <div><dt>Giocatori</dt><dd>${state.players.length}</dd></div>
            <div><dt>Sabotatori totali</dt><dd>${Engine.getSaboteurCount(state.players.length)}</dd></div>
            <div><dt>Speciali presenti</dt><dd>${escapeHtml(selected)}</dd></div>
            <div><dt>Audio</dt><dd>${escapeHtml(AUDIO_LABELS[state.setup.audioMode])}</dd></div>
          </dl>
        </div>
        <div class="alert alert--info">Da ora gli eliminati rivelano il ruolo e non parlano, non votano e non fanno gesti. Il Portavoce applica la propria eccezione.</div>
      `,
      actions: `
        <button class="button button--ghost" data-action="abort-assignment">Ricomincia</button>
        <button class="button button--primary" data-action="start-day">Attiva audio e inizia il Giorno 1</button>
      `
    });
  }

  function renderDay() {
    const alive = alivePlayers();
    const dead = state.players.filter((player) => !player.alive);
    const bonus = activeDoubleVote();
    return shell({
      eyebrow: `Giorno ${state.day}`,
      title: "Confrontatevi nella luce",
      intro: "L'app non raccoglie i voti: discutete e risolvete la scelta insieme.",
      body: `
        ${bonus ? `
          <div class="alert alert--accent">
            <strong>Voto doppio attivo</strong>
            Il voto di ${escapeHtml(playerById(bonus.designatedPlayerId)?.name || "—")} vale due in questa votazione.
          </div>
        ` : ""}
        <section class="section-block">
          <div class="section-heading"><h2>Ancora nel faro</h2><span class="counter">${alive.length}</span></div>
          <div class="player-list">
            ${alive.map((player) => playerRow(player)).join("")}
          </div>
        </section>
        ${dead.length ? `
          <section class="section-block">
            <div class="section-heading"><h2>Ruoli rivelati</h2><span class="counter">${dead.length}</span></div>
            <div class="player-list player-list--dead">
              ${dead.map((player) => playerRow(player, true)).join("")}
            </div>
          </section>
        ` : ""}
        <div class="alert alert--info">Ogni giornata deve concludersi con un solo eliminato. In caso di parità continuate il confronto finché il gruppo non indica un unico nome.</div>
      `,
      actions: `
        <button class="button button--ghost" data-action="audio-repeat">Ripeti istruzione</button>
        <button class="button button--primary" data-action="day-elimination">Registra l'eliminato</button>
      `
    });
  }

  function playerRow(player, revealRole = false) {
    const meta = roleMeta(player.roleId);
    return `
      <div class="player-row ${player.alive ? "" : "is-dead"}">
        <span class="player-token">${escapeHtml(initials(player.name))}</span>
        <span class="player-row__name">${escapeHtml(player.name)}</span>
        ${revealRole ? `<span class="pill">${escapeHtml(meta.name)}</span>` : `<span class="status-dot">Vivo</span>`}
      </div>
    `;
  }

  function initials(name) {
    return name.split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase();
  }

  function renderDayElimination() {
    const confirmingId = state.uiDayTarget || null;
    const confirming = playerById(confirmingId);
    if (confirming) {
      return shell({
        eyebrow: `Giorno ${state.day} · Esito del voto`,
        title: `Eliminare ${confirming.name}?`,
        intro: "Questa scelta rivelerà il ruolo. Controllate che il nome concordato sia corretto.",
        body: `
          <div class="confirmation-mark" aria-hidden="true">?</div>
          <div class="alert alert--warning">Una volta confermato, ${escapeHtml(confirming.name)} sarà considerato eliminato.</div>
        `,
        actions: `
          <button class="button button--ghost" data-action="day-target-back">Cambia nome</button>
          <button class="button button--danger" data-action="day-target-confirm" data-player-id="${escapeHtml(confirming.id)}">Conferma eliminazione</button>
        `
      });
    }

    return shell({
      eyebrow: `Giorno ${state.day} · Esito del voto`,
      title: "Chi è stato eliminato?",
      intro: "Indica soltanto il risultato finale della votazione svolta fuori dall'app.",
      body: `
        <fieldset class="target-list">
          <legend class="sr-only">Scegli il giocatore eliminato</legend>
          ${alivePlayers().map((player) => `
            <label class="target-option">
              <input type="radio" name="day-target" value="${escapeHtml(player.id)}" />
              <span class="player-token">${escapeHtml(initials(player.name))}</span>
              <span>${escapeHtml(player.name)}</span>
              <span class="target-option__mark" aria-hidden="true">✓</span>
            </label>
          `).join("")}
        </fieldset>
      `,
      actions: `
        <button class="button button--ghost" data-action="day-target-cancel">Torna al confronto</button>
        <button class="button button--primary" data-action="day-target-review">Continua</button>
      `
    });
  }

  function renderElimination() {
    const player = playerById(state.lastElimination?.playerId);
    if (!player) return "";
    const meta = roleMeta(player.roleId);
    return shell({
      eyebrow: `Giorno ${state.day} · Ruolo rivelato`,
      title: `${player.name} era ${meta.name}`,
      intro: "La carta resta scoperta. Il giocatore eliminato non può più parlare, votare o fare gesti.",
      body: `
        <div class="card-viewer card-viewer--reveal">
          <img src="${roleAsset(player.roleId)}" alt="Carta ${escapeHtml(meta.name)}" />
        </div>
        ${player.roleId === "portavoce" ? `<div class="alert alert--accent">Il potere del Portavoce si attiva prima del controllo della vittoria.</div>` : ""}
      `,
      actions: `
        <button class="button button--ghost" data-action="undo-day-elimination">Correggi il nome</button>
        <button class="button button--primary" data-action="elimination-continue">Continua</button>
      `
    });
  }

  function renderNight() {
    const step = currentNightStep();
    if (!step) return "";
    if (step.type === "close") return renderNightClose();
    if (step.type === "saboteurs") return renderSaboteurStep();
    if (step.type === "guastatore") return renderBinaryPowerStep("guastatore");
    if (step.type === "saboteurs-sleep") return renderSaboteursSleep();
    if (step.type === "role-sleep") return renderRoleSleep(step.roleId);
    if (step.type === "tecnico") return renderBinaryPowerStep("tecnico");
    if (["sentinella", "cartografa", "vedetta"].includes(step.type)) return renderInvestigatorStep(step.type);
    return renderNightResolve();
  }

  function renderNightClose() {
    return shell({
      eyebrow: `Notte ${state.day}`,
      title: "La luce si spegne",
      intro: "Posate il dispositivo al centro. Tutti chiudano gli occhi e restino in silenzio.",
      body: `
        <div class="night-symbol" aria-hidden="true"><span></span></div>
        <div class="alert alert--night">Solo il ruolo chiamato dalla voce può aprire gli occhi e toccare lo schermo.</div>
        ${state.audioWasForced ? `<div class="alert alert--warning">La voce è stata attivata automaticamente: senza una chiamata udibile la regia notturna non può funzionare.</div>` : ""}
      `,
      actions: `
        <button class="button button--ghost button--night" data-action="audio-repeat">Ripeti</button>
        <button class="button button--light" data-action="night-next">Tutti hanno chiuso gli occhi</button>
      `
    });
  }

  function renderSaboteurStep() {
    const reviewId = state.night.reviewTargetId;
    const reviewPlayer = playerById(reviewId);
    if (reviewPlayer) {
      return secretShell({
        roleId: "sabotatore",
        title: `Bersaglio: ${reviewPlayer.name}`,
        intro: "La scelta è unica e condivisa. Tutti i Sabotatori devono essere d'accordo.",
        body: `<div class="confirmation-mark confirmation-mark--night" aria-hidden="true">✓</div>`,
        actions: `
          <button class="button button--ghost button--night" data-action="sab-target-back">Cambia</button>
          <button class="button button--light" data-action="sab-target-confirm" data-player-id="${escapeHtml(reviewId)}">Conferma insieme</button>
        `
      });
    }

    const targets = alivePlayers().filter((player) => factionOf(player) !== "sabotatori");
    return secretShell({
      roleId: "sabotatore",
      title: "Scegliete un solo bersaglio",
      intro: "Non state votando separatamente: concordate prima, poi toccate lo stesso nome.",
      body: targetFieldset(targets, "night-sabotage-target"),
      actions: `<button class="button button--light button--block" data-action="sab-target-review">Rivedi il bersaglio</button>`
    });
  }

  function renderBinaryPowerStep(roleId) {
    const player = rolePlayer(roleId);
    const meta = roleMeta(roleId);
    const remaining = player?.usesRemaining ?? meta.uses;
    if (!remaining) {
      return secretShell({
        roleId,
        title: "Potere già utilizzato",
        intro: "Non hai più utilizzi disponibili. Chiudi gli occhi senza compiere azioni.",
        body: usesDisplay(0, meta.uses),
        actions: `<button class="button button--light button--block" data-action="night-next">Chiudi gli occhi</button>`
      });
    }
    const explanation = roleId === "tecnico"
      ? "Non conosci il bersaglio. Se intervieni, proverai ad annullare il sabotaggio di questa notte."
      : "Se provochi l'interferenza, i poteri attivi dei Custodi saranno bloccati questa notte.";
    return secretShell({
      roleId,
      title: "Vuoi usare il potere?",
      intro: explanation,
      body: usesDisplay(remaining, meta.uses),
      actions: `
        <button class="button button--ghost button--night" data-action="binary-power" data-role="${roleId}" data-use="false">Non ora</button>
        <button class="button button--light" data-action="binary-power" data-role="${roleId}" data-use="true">Usalo questa notte</button>
      `
    });
  }

  function renderSaboteursSleep() {
    return shell({
      eyebrow: `Notte ${state.day}`,
      title: "Sabotatori, chiudete gli occhi",
      intro: "Il bersaglio è definitivo. La regia continuerà automaticamente tra pochi istanti.",
      body: `
        <div class="night-symbol night-symbol--closed" aria-hidden="true"><span></span></div>
        <div class="handoff-timer" aria-label="Attendi mentre i Sabotatori chiudono gli occhi">
          <span aria-hidden="true"></span>
          <strong>Attendi e chiudi gli occhi</strong>
        </div>
      `
    });
  }

  function renderRoleSleep(roleId) {
    const name = roleMeta(roleId).name;
    return shell({
      eyebrow: `Notte ${state.day}`,
      title: `${name}, chiudi gli occhi`,
      intro: "Allontana la mano dal dispositivo. La regia chiamerà automaticamente il prossimo ruolo tra pochi istanti.",
      body: `
        <div class="night-symbol night-symbol--closed" aria-hidden="true"><span></span></div>
        <div class="handoff-timer" aria-label="Attendi mentre il ruolo chiude gli occhi">
          <span aria-hidden="true"></span>
          <strong>Attendi e chiudi gli occhi</strong>
        </div>
      `
    });
  }

  function scheduleNightHandoff() {
    const stepType = currentNightStep()?.type;
    if (
      handoffTimer ||
      state.screen !== "night" ||
      !["role-sleep", "saboteurs-sleep"].includes(stepType) ||
      document.hidden
    ) {
      return;
    }
    const expectedDay = state.day;
    const expectedIndex = state.night.stepIndex;
    const expectedType = stepType;
    app.querySelector(".handoff-timer")?.classList.add("is-counting");
    handoffTimer = window.setTimeout(() => {
      handoffTimer = null;
      if (
        state.screen === "night" &&
        state.day === expectedDay &&
        state.night?.stepIndex === expectedIndex &&
        currentNightStep()?.type === expectedType
      ) {
        advanceNight();
      }
    }, HANDOFF_DURATION);
  }

  function clearNightHandoff() {
    if (!handoffTimer) return false;
    window.clearTimeout(handoffTimer);
    handoffTimer = null;
    app.querySelector(".handoff-timer")?.classList.remove("is-counting");
    return true;
  }

  function renderInvestigatorStep(roleId) {
    const player = rolePlayer(roleId);
    const meta = roleMeta(roleId);
    const remaining = player?.usesRemaining ?? meta.uses;
    const result = state.night.privateResult;
    if (result && result.roleId === roleId) {
      return secretShell({
        roleId,
        title: result.title,
        intro: result.text,
        body: `
          <div class="private-result ${result.blocked ? "is-blocked" : ""}">
            <span aria-hidden="true">${result.blocked ? "≈" : result.positive ? "=" : "≠"}</span>
            <strong>${escapeHtml(result.detail)}</strong>
          </div>
          <p class="privacy-note">Memorizza il risultato. Non verrà letto ad alta voce.</p>
        `,
        actions: `<button class="button button--light button--block" data-action="private-result-close">Ho memorizzato, chiudo gli occhi</button>`
      });
    }

    if (!remaining) {
      return secretShell({
        roleId,
        title: "Potere esaurito",
        intro: "Non hai più utilizzi. Chiudi gli occhi senza selezionare nessuno.",
        body: usesDisplay(0, meta.uses),
        actions: `<button class="button button--light button--block" data-action="night-next">Chiudi gli occhi</button>`
      });
    }

    const targets = alivePlayers().filter((candidate) => candidate.id !== player.id);
    let chooser = targetFieldset(targets, `${roleId}-target`);
    if (roleId === "cartografa") {
      chooser = `
        <p class="helper helper--night">Scegli esattamente due persone diverse.</p>
        ${targetFieldset(targets, "cartografa-target", true)}
      `;
    }
    return secretShell({
      roleId,
      title: roleId === "cartografa" ? "Confronta due persone" : "Scegli chi osservare",
      intro: meta.power,
      body: `${usesDisplay(remaining, meta.uses)}${chooser}`,
      actions: `
        <button class="button button--ghost button--night" data-action="investigator-skip" data-role="${roleId}">Non usare</button>
        <button class="button button--light" data-action="investigator-submit" data-role="${roleId}">Usa il potere</button>
      `
    });
  }

  function secretShell({ roleId, title, intro, body, actions }) {
    return shell({
      eyebrow: `Notte ${state.day} · ${roleMeta(roleId).name}`,
      title,
      intro,
      body: `
        <div class="secret-banner secret-banner--night">Solo ${escapeHtml(roleMeta(roleId).name)} deve avere gli occhi aperti</div>
        ${body}
      `,
      actions
    });
  }

  function targetFieldset(players, name, multiple = false) {
    return `
      <fieldset class="target-list target-list--night">
        <legend class="sr-only">Scegli ${multiple ? "due giocatori" : "un giocatore"}</legend>
        ${players.map((player) => `
          <label class="target-option target-option--night">
            <input type="${multiple ? "checkbox" : "radio"}" name="${name}" value="${escapeHtml(player.id)}" />
            <span class="player-token">${escapeHtml(initials(player.name))}</span>
            <span>${escapeHtml(player.name)}</span>
            <span class="target-option__mark" aria-hidden="true">✓</span>
          </label>
        `).join("")}
      </fieldset>
    `;
  }

  function usesDisplay(remaining, maximum) {
    return `
      <div class="uses" aria-label="${remaining} utilizzi rimasti su ${maximum}">
        ${Array.from({ length: maximum }, (_unused, index) => `<span class="${index < remaining ? "is-lit" : ""}" aria-hidden="true">◈</span>`).join("")}
        <strong>${remaining}/${maximum} utilizzi rimasti</strong>
      </div>
    `;
  }

  function renderNightResolve() {
    return shell({
      eyebrow: `Notte ${state.day} · Risoluzione`,
      title: "Tutti tengano gli occhi chiusi",
      intro: "Le scelte sono state registrate. L'app calcolerà sabotaggio, protezione e interferenza.",
      body: `<div class="night-symbol night-symbol--resolve" aria-hidden="true"><span></span></div>`,
      actions: `
        <button class="button button--ghost button--night" data-action="audio-repeat">Ripeti</button>
        <button class="button button--light" data-action="resolve-night">Fate sorgere l'alba</button>
      `
    });
  }

  function renderDawn() {
    const dawn = state.lastDawn;
    const victim = playerById(dawn?.victimId);
    const nextDay = state.day + 1;
    const outcome = victim
      ? `${victim.name} è stato eliminato. Era ${roleMeta(victim.roleId).name}.`
      : "Nessuno è stato eliminato questa notte.";
    return shell({
      eyebrow: `Alba del Giorno ${nextDay}`,
      title: victim ? `${victim.name} non risponde all'appello` : "L'equipaggio è ancora al completo",
      intro: outcome,
      body: `
        ${dawn?.interference ? `<div class="alert alert--warning"><strong>Interferenza rilevata.</strong> I poteri attivi dei Custodi sono stati bloccati e non hanno consumato utilizzi.</div>` : ""}
        ${dawn?.sabotagePrevented ? `<div class="alert alert--success"><strong>Sabotaggio annullato.</strong> Il Tecnico ha protetto il faro.</div>` : ""}
        ${victim ? `
          <div class="card-viewer card-viewer--reveal">
            <img src="${roleAsset(victim.roleId)}" alt="Carta ${escapeHtml(roleMeta(victim.roleId).name)}" />
          </div>
        ` : `<div class="dawn-mark" aria-hidden="true"></div>`}
      `,
      actions: `
        <button class="button button--ghost" data-action="audio-repeat">Ripeti annuncio</button>
        <button class="button button--primary" data-action="dawn-continue">Continua</button>
      `
    });
  }

  function renderPortavoce() {
    const eliminated = playerById(state.pendingPortavoce?.playerId);
    const targets = alivePlayers();
    return shell({
      eyebrow: "Potere del Portavoce",
      title: `${eliminated?.name || "Il Portavoce"} ha l'ultima parola`,
      intro: "Può pronunciare ora un solo messaggio di massimo dieci parole, poi deve indicare un giocatore vivo.",
      body: `
        <div class="message-limit"><strong>10</strong><span>parole al massimo<br />pronunciate ad alta voce</span></div>
        ${targets.length ? `
          <fieldset class="target-list">
            <legend>Chi avrà il voto doppio nella prossima votazione?</legend>
            ${targets.map((player) => `
              <label class="target-option">
                <input type="radio" name="portavoce-target" value="${escapeHtml(player.id)}" />
                <span class="player-token">${escapeHtml(initials(player.name))}</span>
                <span>${escapeHtml(player.name)}</span>
                <span class="target-option__mark" aria-hidden="true">✓</span>
              </label>
            `).join("")}
          </fieldset>
        ` : `<div class="alert alert--info">Non ci sono giocatori vivi da designare.</div>`}
      `,
      actions: targets.length
        ? `<button class="button button--primary button--block" data-action="portavoce-designate">Conferma il voto doppio</button>`
        : `<button class="button button--primary button--block" data-action="portavoce-skip">Continua</button>`
    });
  }

  function renderWinner() {
    const winner = state.winner || {};
    const factionName = winner.faction === "sabotatori" ? "I Sabotatori vincono" : "I Custodi vincono";
    const survivingNaufrago = state.players.find((player) => player.roleId === "naufrago" && player.alive);
    return shell({
      eyebrow: "Partita conclusa",
      title: factionName,
      intro: survivingNaufrago
        ? `${survivingNaufrago.name}, il Naufrago, sopravvive e vince insieme a loro.`
        : "Il destino del faro è deciso.",
      body: `
        <div class="winner-mark" aria-hidden="true"><span></span></div>
        <section class="section-block">
          <div class="section-heading"><h2>Tutti i ruoli</h2></div>
          <div class="player-list">
            ${state.players.map((player) => `
              <div class="player-row ${player.alive ? "" : "is-dead"}">
                <span class="player-token">${escapeHtml(initials(player.name))}</span>
                <span class="player-row__name">${escapeHtml(player.name)}</span>
                <span class="pill">${escapeHtml(roleMeta(player.roleId).name)}</span>
              </div>
            `).join("")}
          </div>
        </section>
      `,
      actions: `
        <button class="button button--ghost" data-action="replay-setup">Nuova partita</button>
        <button class="button button--danger" data-action="end-game-reset">Chiudi e cancella i ruoli</button>
      `
    });
  }

  function renderRules() {
    const previous = state.rulesReturn || "welcome";
    return shell({
      eyebrow: "Regole rapide",
      title: "Come si gioca",
      body: `
        <ol class="rules-list">
          <li><strong>Si parte di giorno.</strong> I vivi discutono e devono concordare, tramite voto esterno all'app, un solo eliminato.</li>
          <li><strong>Il ruolo viene rivelato.</strong> L'eliminato non parla, non vota e non gesticola; il Portavoce applica prima il proprio potere.</li>
          <li><strong>Di notte tutti chiudono gli occhi.</strong> La voce chiama un ruolo alla volta e soltanto quel ruolo usa lo schermo.</li>
          <li><strong>I Sabotatori scelgono insieme.</strong> Indicano un unico bersaglio e non possono scegliere un compagno.</li>
          <li><strong>Vittoria.</strong> I Custodi vincono eliminando tutti i Sabotatori; i Sabotatori vincono raggiungendo la parità con la fazione dei Custodi.</li>
        </ol>
        <div class="alert alert--info">Il Naufrago non conta per la parità e vince con la fazione vincitrice soltanto se sopravvive.</div>
      `,
      actions: `<button class="button button--primary button--block" data-action="rules-back" data-return="${escapeHtml(previous)}">Ho capito</button>`
    });
  }

  function currentNightStep() {
    return state.night?.steps?.[state.night.stepIndex] || null;
  }

  function buildNightSteps() {
    return buildNightStepsFor(state.players);
  }

  function buildNightStepsFor(players) {
    const hasAliveRole = (roleId) =>
      players.some((player) => player.alive && player.roleId === roleId);
    const steps = [{ type: "close" }, { type: "saboteurs" }];
    if (hasAliveRole("guastatore")) steps.push({ type: "guastatore" });
    steps.push({ type: "saboteurs-sleep" });
    ["tecnico", "sentinella", "cartografa", "vedetta"].forEach((roleId) => {
      if (hasAliveRole(roleId)) {
        steps.push({ type: roleId });
        steps.push({ type: "role-sleep", roleId });
      }
    });
    steps.push({ type: "resolve" });
    return steps;
  }

  function emptyNightActions() {
    return {
      sabotageTargetId: null,
      guastatore: { use: false },
      tecnico: { use: false },
      sentinella: { use: false, targetId: null },
      cartografa: { use: false, targetIds: [] },
      vedetta: { use: false, targetId: null }
    };
  }

  function goToNight() {
    if (state.setup.audioMode === "muted") {
      state.audioWasForced = true;
      audio.setMode("voice");
      audio.enable();
    } else {
      state.audioWasForced = false;
    }
    state.phase = "night";
    state.screen = "night";
    state.night = {
      number: state.day,
      stepIndex: 0,
      steps: buildNightSteps(),
      actions: emptyNightActions(),
      reviewTargetId: null,
      privateResult: null
    };
    lastNarrationKey = "";
    saveAndRender();
  }

  function advanceNight() {
    state.night.privateResult = null;
    state.night.reviewTargetId = null;
    state.night.stepIndex += 1;
    saveAndRender();
  }

  function previewInvestigation(roleId, action) {
    if (state.night.actions.guastatore.use) {
      return {
        roleId,
        title: "Segnale disturbato",
        text: "Il tuo potere non produce alcun risultato e non verrà consumato.",
        detail: "Nessun risultato",
        blocked: true,
        positive: false
      };
    }
    if (roleId === "sentinella") {
      const target = playerById(action.targetId);
      const alignment = factionOf(target) === "sabotatori"
        ? "Sabotatori"
        : factionOf(target) === "neutrale"
          ? "Neutrale"
          : "Custodi";
      return {
        roleId,
        title: `${target.name}: ${alignment}`,
        text: "Questo è l'allineamento rilevato dalla Sentinella.",
        detail: alignment,
        positive: alignment === "Custodi"
      };
    }
    if (roleId === "cartografa") {
      const [firstId, secondId] = action.targetIds;
      const first = playerById(firstId);
      const second = playerById(secondId);
      const same = comparisonFaction(first) === comparisonFaction(second);
      return {
        roleId,
        title: same ? "Stessa fazione" : "Fazioni differenti",
        text: `${first.name} e ${second.name} ${same ? "appartengono alla stessa fazione" : "non appartengono alla stessa fazione"}.`,
        detail: same ? "Stessa fazione" : "Fazioni differenti",
        positive: same
      };
    }
    const target = playerById(action.targetId);
    const acted = actedPlayerIds().has(target.id);
    return {
      roleId,
      title: acted ? "Ha agito" : "Non ha agito",
      text: `${target.name} ${acted ? "ha compiuto" : "non ha compiuto"} un'azione questa notte.`,
      detail: acted ? "Azione rilevata" : "Nessuna azione rilevata",
      positive: acted
    };
  }

  function comparisonFaction(player) {
    if (player?.roleId === "naufrago") return `neutrale:${player.id}`;
    return factionOf(player);
  }

  function actedPlayerIds() {
    const acted = new Set();
    state.players
      .filter((player) => player.alive && factionOf(player) === "sabotatori")
      .forEach((player) => acted.add(player.id));
    ["tecnico", "sentinella", "cartografa", "vedetta"].forEach((roleId) => {
      if (state.night.actions[roleId]?.use) {
        const player = rolePlayer(roleId);
        if (player) acted.add(player.id);
      }
    });
    return acted;
  }

  function resolveNight() {
    try {
      const result = Engine.resolveNight({
        players: state.players,
        actions: clone(state.night.actions)
      });
      state.players = result.players || state.players;
      state.lastDawn = {
        victimId: result.victimId || null,
        interference: Boolean(result.interference),
        sabotagePrevented: Boolean(result.sabotagePrevented)
      };
      if (
        state.doubleVote &&
        Engine.getPortavoceBonusStatus(state.doubleVote, state.players) === "lost"
      ) {
        state.doubleVote = null;
      }
      state.screen = "dawn";
      state.phase = "dawn";
      lastNarrationKey = "";
      saveAndRender();
    } catch (error) {
      showInlineError(error.message || "Non è stato possibile risolvere la notte.");
    }
  }

  function activeDoubleVote() {
    if (!state.doubleVote) return null;
    const scheduledDay = (state.doubleVote.createdOnDay || 0) + 1;
    if (
      Engine.getPortavoceBonusStatus(state.doubleVote, state.players) !== "active" ||
      scheduledDay !== state.day
    ) {
      return null;
    }
    return state.doubleVote;
  }

  function consumeCurrentDoubleVote() {
    if (!state.doubleVote) return;
    const scheduledDay = (state.doubleVote.createdOnDay || 0) + 1;
    if (scheduledDay <= state.day) {
      Engine.consumePortavoceBonus(state.doubleVote, state.players);
      state.doubleVote = null;
    }
  }

  function beginPortavoce(playerId, source) {
    state.pendingPortavoce = { playerId, source };
    state.afterPortavoce = source === "day" ? "night" : "day";
    state.screen = "portavoce";
    lastNarrationKey = "";
    saveAndRender();
  }

  function finishAfterElimination(source) {
    const win = normalizeWin(Engine.checkWin(state.players));
    if (win.ended) {
      state.winner = win;
      state.screen = "winner";
      state.phase = "ended";
      lastNarrationKey = "";
      saveAndRender();
      return;
    }
    if (source === "day") {
      goToNight();
    } else {
      state.day += 1;
      state.audioWasForced = false;
      state.phase = "day";
      state.screen = "day";
      state.night = null;
      state.lastDawn = null;
      state.correctionSnapshot = null;
      lastNarrationKey = "";
      saveAndRender();
    }
  }

  function normalizeWin(result) {
    if (!result) return { ended: false, faction: null };
    if (typeof result === "string") return { ended: true, faction: result };
    const faction = result.faction || result.winner || result.winningFaction || null;
    const ended = result.ended ?? result.gameOver ?? Boolean(faction);
    return { ...result, ended: Boolean(ended), faction };
  }

  function saveAndRender() {
    saveGame();
    render();
  }

  function selectValue(name) {
    return document.querySelector(`input[name="${name}"]:checked`)?.value || null;
  }

  function selectedValues(name) {
    return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map((input) => input.value);
  }

  function handleClick(event) {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const action = target.dataset.action;

    if (action === "new-game") {
      if (savedGame && !window.confirm("La partita salvata verrà sostituita. Vuoi continuare?")) return;
      clearSavedGame();
      state = createInitialState();
      state.screen = "setup";
      render();
      return;
    }
    if (action === "continue-game") {
      if (!savedGame) return;
      state = clone(savedGame);
      state.assignmentRevealed = false;
      audio.setMode(effectiveAudioMode());
      render();
      if (isSecretState()) showPrivacyCover();
      return;
    }
    if (action === "rules") {
      state.rulesReturn = state.screen;
      state.screen = "rules";
      render();
      return;
    }
    if (action === "rules-back") {
      state.screen = target.dataset.return || state.rulesReturn || "welcome";
      render();
      return;
    }
    if (action === "back-welcome") {
      state.screen = "welcome";
      render();
      return;
    }
    if (action === "start-assignment") {
      startAssignment();
      return;
    }
    if (action === "abort-assignment") {
      if (!window.confirm("Vuoi cancellare questa assegnazione e tornare alla configurazione?")) return;
      clearSavedGame();
      const setup = clone(state.setup);
      state = createInitialState();
      state.setup = setup;
      state.screen = "setup";
      render();
      return;
    }
    if (action === "hide-role") {
      state.assignmentRevealed = false;
      state.assignmentIndex += 1;
      if (state.assignmentIndex >= state.players.length) state.screen = "ready";
      saveAndRender();
      return;
    }
    if (action === "start-day") {
      audio.enable();
      audio.bell();
      state.screen = "day";
      state.phase = "day";
      state.day = 1;
      lastNarrationKey = "";
      saveAndRender();
      return;
    }
    if (action === "audio-repeat") {
      audio.enable();
      repeatScreenNarration();
      return;
    }
    if (action === "day-elimination") {
      state.screen = "day-elimination";
      state.uiDayTarget = null;
      saveAndRender();
      return;
    }
    if (action === "day-target-cancel") {
      state.screen = "day";
      state.uiDayTarget = null;
      saveAndRender();
      return;
    }
    if (action === "day-target-review") {
      const id = selectValue("day-target");
      if (!id) return showInlineError("Scegli il giocatore eliminato.");
      state.uiDayTarget = id;
      render();
      return;
    }
    if (action === "day-target-back") {
      state.uiDayTarget = null;
      render();
      return;
    }
    if (action === "day-target-confirm") {
      confirmDayElimination(target.dataset.playerId);
      return;
    }
    if (action === "undo-day-elimination") {
      undoDayElimination();
      return;
    }
    if (action === "elimination-continue") {
      const eliminated = playerById(state.lastElimination?.playerId);
      if (eliminated?.roleId === "portavoce") beginPortavoce(eliminated.id, "day");
      else finishAfterElimination("day");
      return;
    }
    if (action === "night-next") {
      advanceNight();
      return;
    }
    if (action === "sab-target-review") {
      const id = selectValue("night-sabotage-target");
      if (!id) return showInlineError("I Sabotatori devono concordare un bersaglio.");
      state.night.reviewTargetId = id;
      render();
      return;
    }
    if (action === "sab-target-back") {
      state.night.reviewTargetId = null;
      render();
      return;
    }
    if (action === "sab-target-confirm") {
      state.night.actions.sabotageTargetId = target.dataset.playerId;
      advanceNight();
      return;
    }
    if (action === "binary-power") {
      const roleId = target.dataset.role;
      state.night.actions[roleId] = { use: target.dataset.use === "true" };
      advanceNight();
      return;
    }
    if (action === "investigator-skip") {
      const roleId = target.dataset.role;
      state.night.actions[roleId] = roleId === "cartografa"
        ? { use: false, targetIds: [] }
        : { use: false, targetId: null };
      advanceNight();
      return;
    }
    if (action === "investigator-submit") {
      submitInvestigator(target.dataset.role);
      return;
    }
    if (action === "private-result-close") {
      advanceNight();
      return;
    }
    if (action === "resolve-night") {
      resolveNight();
      return;
    }
    if (action === "dawn-continue") {
      const victim = playerById(state.lastDawn?.victimId);
      if (victim?.roleId === "portavoce") beginPortavoce(victim.id, "night");
      else finishAfterElimination("night");
      return;
    }
    if (action === "portavoce-designate") {
      const id = selectValue("portavoce-target");
      if (!id) return showInlineError("Il Portavoce deve designare un giocatore vivo.");
      const validation = Engine.validatePortavoceDesignation(
        state.players,
        state.pendingPortavoce.playerId,
        id
      );
      if (!validation.valid) {
        return showInlineError(validation.errors[0]?.message || "Designazione non valida.");
      }
      state.doubleVote = Engine.createPortavoceBonus({
        sourcePlayerId: state.pendingPortavoce.playerId,
        designatedPlayerId: id,
        createdOnDay: state.day,
        createdAfterPhase: state.pendingPortavoce.source
      });
      const source = state.pendingPortavoce.source;
      state.pendingPortavoce = null;
      state.afterPortavoce = null;
      finishAfterElimination(source);
      return;
    }
    if (action === "portavoce-skip") {
      const source = state.pendingPortavoce.source;
      state.pendingPortavoce = null;
      state.afterPortavoce = null;
      finishAfterElimination(source);
      return;
    }
    if (action === "replay-setup") {
      clearNightHandoff();
      audio.cancelSpeech();
      narrationInterrupted = false;
      lastNarrationKey = "";
      clearSavedGame();
      const previousSetup = clone(state.setup);
      state = createInitialState();
      state.setup = previousSetup;
      state.screen = "setup";
      render();
      return;
    }
    if (action === "end-game-reset") {
      if (!window.confirm("Cancellare definitivamente ruoli e partita da questo dispositivo?")) return;
      audio.stop();
      clearSavedGame();
      state = createInitialState();
      render();
      return;
    }
    if (action === "resume-private" || action === "resume-private-screen") {
      hidePrivacyCover();
    }
  }

  function handleChange(event) {
    const field = event.target.dataset.field;
    if (field === "setup-player-count") {
      const count = Number(event.target.value);
      state.setup.playerCount = count;
      state.setup.names = makeNames(count, state.setup.names);
      state.setup.specialRoles = defaultSpecials(count);
      render();
      return;
    }
    if (field === "setup-special") {
      const roleId = event.target.value;
      if (event.target.checked) {
        if (!state.setup.specialRoles.includes(roleId)) state.setup.specialRoles.push(roleId);
      } else {
        state.setup.specialRoles = state.setup.specialRoles.filter((id) => id !== roleId);
      }
      render();
      return;
    }
    if (field === "setup-audio") {
      state.setup.audioMode = event.target.value;
      state.audioWasForced = false;
      audio.setMode(effectiveAudioMode());
      render();
    }
  }

  function handleInput(event) {
    if (event.target.dataset.field !== "setup-name") return;
    const index = Number(event.target.dataset.index);
    state.setup.names[index] = event.target.value;
    refreshSetupValidity();
  }

  function refreshSetupValidity() {
    if (state.screen !== "setup") return;
    const issues = setupIssues();
    const validationBox = app.querySelector("[data-setup-validation]");
    const startButton = app.querySelector('[data-action="start-assignment"]');
    if (startButton) startButton.disabled = issues.length > 0;
    if (!validationBox) return;
    if (issues.length) {
      validationBox.className = "alert alert--warning";
      validationBox.innerHTML = `<strong>Configurazione da completare</strong><ul>${issues
        .map((issue) => `<li>${escapeHtml(issue)}</li>`)
        .join("")}</ul>`;
    } else {
      validationBox.className = "alert alert--success";
      validationBox.textContent = "Configurazione valida: pronta per l'assegnazione.";
    }
  }

  function startAssignment() {
    const issues = setupIssues();
    if (issues.length) {
      showInlineError(issues[0]);
      return;
    }
    try {
      const created = Engine.createGame({
        players: state.setup.names.map((name, index) => ({ id: `p${index + 1}`, name: name.trim() })),
        specialRoles: state.setup.specialRoles
      });
      state.players = clone(created.players || created);
      state.players.forEach((player) => {
        if (typeof player.usesRemaining !== "number") {
          player.usesRemaining = roleMeta(player.roleId).uses || 0;
        }
      });
      state.assignmentIndex = 0;
      state.assignmentRevealed = false;
      state.screen = "assignment";
      state.phase = "assignment";
      state.day = 1;
      state.doubleVote = null;
      state.winner = null;
      saveAndRender();
    } catch (error) {
      showInlineError(error.message || "Configurazione non valida.");
    }
  }

  function confirmDayElimination(playerId) {
    const target = playerById(playerId);
    if (!target?.alive) {
      showInlineError("Il giocatore scelto non è più disponibile.");
      return;
    }
    state.correctionSnapshot = {
      players: clone(state.players),
      doubleVote: clone(state.doubleVote),
      day: state.day
    };
    consumeCurrentDoubleVote();
    try {
      const result = Engine.resolveDayElimination({ players: state.players, targetId: playerId });
      state.players = result.players || state.players.map((player) =>
        player.id === playerId ? { ...player, alive: false } : player
      );
      state.lastElimination = { playerId, source: "day", day: state.day };
      state.uiDayTarget = null;
      state.screen = "elimination";
      lastNarrationKey = "";
      saveAndRender();
    } catch (error) {
      showInlineError(error.message || "Eliminazione non valida.");
    }
  }

  function undoDayElimination() {
    const snapshot = state.correctionSnapshot;
    if (!snapshot) return;
    state.players = clone(snapshot.players);
    state.doubleVote = clone(snapshot.doubleVote);
    state.day = snapshot.day;
    state.lastElimination = null;
    state.correctionSnapshot = null;
    state.uiDayTarget = null;
    state.screen = "day-elimination";
    saveAndRender();
  }

  function submitInvestigator(roleId) {
    let action;
    if (roleId === "cartografa") {
      const ids = selectedValues("cartografa-target");
      if (ids.length !== 2) return showInlineError("La Cartografa deve scegliere esattamente due persone.");
      action = { use: true, targetIds: ids };
    } else {
      const id = selectValue(`${roleId}-target`);
      if (!id) return showInlineError("Scegli una persona da osservare.");
      action = { use: true, targetId: id };
    }
    state.night.actions[roleId] = action;
    state.night.privateResult = previewInvestigation(roleId, action);
    saveAndRender();
  }

  function showInlineError(message) {
    let alert = app.querySelector(".inline-error");
    if (!alert) {
      alert = document.createElement("div");
      alert.className = "inline-error";
      alert.setAttribute("role", "alert");
      const actionBar = app.querySelector(".action-bar");
      (actionBar || app).before(alert);
    }
    alert.textContent = message;
    alert.focus?.();
  }

  function startHold(event) {
    const button = event.target.closest('[data-action="hold-reveal"]');
    if (!button || state.assignmentRevealed) return;
    event.preventDefault();
    cancelHold();
    holdButton = button;
    button.classList.add("is-holding");
    button.setPointerCapture?.(event.pointerId);
    holdTimer = window.setTimeout(() => {
      holdTimer = null;
      button.classList.remove("is-holding");
      state.assignmentRevealed = true;
      saveAndRender();
    }, HOLD_DURATION);
  }

  function cancelHold() {
    if (holdTimer) window.clearTimeout(holdTimer);
    holdTimer = null;
    holdButton?.classList.remove("is-holding");
    holdButton = null;
  }

  function isSecretState() {
    if (state.screen === "assignment" && state.assignmentRevealed) return true;
    if (state.screen !== "night") return false;
    const type = currentNightStep()?.type;
    return !["close", "saboteurs-sleep", "role-sleep", "resolve"].includes(type);
  }

  function showPrivacyCover() {
    if (!privacyCover || privacyIsCovered) return;
    privacyIsCovered = true;
    privacyReturnFocus = document.activeElement;
    const shellElement = document.querySelector(".app-shell");
    if (shellElement) {
      shellElement.inert = true;
      shellElement.setAttribute("aria-hidden", "true");
    }
    document.body.classList.add("modal-open");
    privacyCover.hidden = false;
    privacyCover.classList.add("is-visible");
    privacyCover.setAttribute("aria-hidden", "false");
    privacyCover.querySelector("button")?.focus();
  }

  function hidePrivacyCover() {
    if (!privacyCover) return;
    privacyIsCovered = false;
    const shellElement = document.querySelector(".app-shell");
    if (shellElement) {
      shellElement.inert = false;
      shellElement.removeAttribute("aria-hidden");
    }
    document.body.classList.remove("modal-open");
    privacyCover.classList.remove("is-visible");
    privacyCover.setAttribute("aria-hidden", "true");
    privacyCover.hidden = true;
    if (privacyReturnFocus?.isConnected) privacyReturnFocus.focus();
    else app.querySelector("h1")?.focus();
    privacyReturnFocus = null;
    narrationInterrupted = false;
    lastNarrationKey = "";
    startScreenNarration();
  }

  function protectSecrets() {
    if (!isSecretState() || privacyIsCovered) return;
    if (state.screen === "assignment" && state.assignmentRevealed) {
      state.assignmentRevealed = false;
      saveGame();
      render();
    }
    showPrivacyCover();
  }

  function currentNarration() {
    if (state.screen === "day") {
      return {
        key: `day-${state.day}`,
        text: `È il giorno ${state.day}. Aprite gli occhi. Confrontatevi e scegliete un solo giocatore da eliminare.`
      };
    }
    if (state.screen === "elimination") {
      const player = playerById(state.lastElimination?.playerId);
      return player ? {
        key: `eliminated-day-${state.day}-${player.id}`,
        text: `${player.name} è stato eliminato. Il suo ruolo viene rivelato.`
      } : null;
    }
    if (state.screen === "portavoce") {
      return {
        key: `portavoce-${state.pendingPortavoce?.playerId}-${state.day}`,
        text: "Il Portavoce può pronunciare un ultimo messaggio di massimo dieci parole e designare chi avrà il voto doppio."
      };
    }
    if (state.screen === "dawn") {
      const dawn = state.lastDawn;
      const victim = playerById(dawn?.victimId);
      let text = `Sorge il giorno ${state.day + 1}. `;
      if (dawn?.interference) text += "Durante la notte si è verificata un'interferenza. ";
      text += victim
        ? `${victim.name} è stato eliminato. Il suo ruolo viene rivelato.`
        : "Nessuno è stato eliminato questa notte.";
      return { key: `dawn-${state.day}`, text };
    }
    if (state.screen === "winner") {
      return {
        key: `winner-${state.day}-${state.winner?.faction}`,
        text: state.winner?.faction === "sabotatori"
          ? "La partita è conclusa. Vincono i Sabotatori."
          : "La partita è conclusa. Vincono i Custodi."
      };
    }
    if (state.screen !== "night") return null;
    const step = currentNightStep();
    if (!step) return null;
    const texts = {
      close: "La luce si spegne su Port Leon. Tutti chiudano gli occhi.",
      sabotatori: "",
      saboteurs: "Sabotatori, aprite gli occhi. Concordate un unico bersaglio e confermatelo sullo schermo.",
      guastatore: "Guastatore, decidi se provocare un'interferenza questa notte.",
      "saboteurs-sleep": "Sabotatori, chiudete gli occhi. Il bersaglio è definitivo.",
      tecnico: "Tecnico, apri gli occhi. Senza conoscere il bersaglio, decidi se intervenire.",
      sentinella: "Sentinella, apri gli occhi. Puoi usare il tuo potere oppure attendere.",
      cartografa: "Cartografa della Baia, apri gli occhi. Puoi usare il tuo potere oppure attendere.",
      vedetta: "Vedetta, apri gli occhi. Puoi usare il tuo potere oppure attendere.",
      "role-sleep": `${roleMeta(step.roleId).name}, chiudi gli occhi.`,
      resolve: "Tutti tengano gli occhi chiusi. La notte sta per finire."
    };
    return {
      key: `night-${state.day}-${state.night.stepIndex}`,
      text: texts[step.type] || ""
    };
  }

  function narrateCurrentScreen(onComplete = null) {
    const narration = currentNarration();
    if (!narration?.text || narration.key === lastNarrationKey) return false;
    lastNarrationKey = narration.key;
    audio.speak(narration.text, true, onComplete);
    return true;
  }

  function isNightHandoffScreen() {
    return (
      state.screen === "night" &&
      ["role-sleep", "saboteurs-sleep"].includes(currentNightStep()?.type)
    );
  }

  function narrationCompletion() {
    const handoffScreen = isNightHandoffScreen();
    const releaseWinnerAudio =
      state.screen === "winner" && state.audioWasForced;
    return {
      handoffScreen,
      releaseWinnerAudio,
      complete() {
        if (handoffScreen) scheduleNightHandoff();
        if (releaseWinnerAudio) releaseForcedWinnerAudio();
      }
    };
  }

  function startScreenNarration() {
    const effects = narrationCompletion();
    const narrationStarted = narrateCurrentScreen(effects.complete);
    if (!narrationStarted) effects.complete();
    return narrationStarted;
  }

  function repeatScreenNarration() {
    const effects = narrationCompletion();
    if (effects.handoffScreen) clearNightHandoff();
    const narrationStarted = audio.repeat(effects.complete);
    if (!narrationStarted) effects.complete();
  }

  function pauseScreenNarration() {
    const timerPaused = clearNightHandoff();
    const speechPaused = audio.cancelSpeech();
    if (timerPaused || speechPaused) narrationInterrupted = true;
  }

  function resumeScreenNarration() {
    if (
      !narrationInterrupted ||
      document.hidden ||
      privacyIsCovered
    ) {
      return;
    }
    narrationInterrupted = false;
    lastNarrationKey = "";
    startScreenNarration();
  }

  function releaseForcedWinnerAudio() {
    if (state.screen !== "winner" || !state.audioWasForced) return;
    state.audioWasForced = false;
    audio.setMode(state.setup.audioMode);
    syncAudioControls();
    saveGame();
  }

  function announcePublic() {
    if (!announcer || isSecretState()) return;
    const heading = app.querySelector("h1")?.textContent || "";
    announcer.textContent = heading;
  }

  function syncAudioControls() {
    const activeMode = effectiveAudioMode();
    const mode = document.getElementById("audio-mode");
    if (mode && mode.value !== activeMode) mode.value = activeMode;
    const toggle = document.getElementById("audio-toggle");
    if (toggle) {
      const label = activeMode === "muted" ? "Attiva l'audio" : "Disattiva l'audio";
      toggle.setAttribute("aria-label", label);
      toggle.setAttribute("title", label);
      toggle.setAttribute("aria-pressed", activeMode !== "muted" ? "true" : "false");
    }
  }

  function wireGlobalControls() {
    document.getElementById("audio-mode")?.addEventListener("change", (event) => {
      const previousMode = effectiveAudioMode();
      if (state.screen === "night" && event.target.value === "muted") {
        event.target.value = effectiveAudioMode();
        showInlineError("Durante la notte la voce deve restare attiva per chiamare i ruoli.");
        return;
      }
      state.setup.audioMode = event.target.value;
      state.audioWasForced = false;
      audio.setMode(effectiveAudioMode());
      audio.enable();
      if (previousMode === "muted" && effectiveAudioMode() !== "muted") {
        lastNarrationKey = "";
        narrateCurrentScreen();
      }
      saveGame();
    });
    document.getElementById("audio-toggle")?.addEventListener("click", () => {
      const previousMode = effectiveAudioMode();
      if (state.screen === "night") {
        showInlineError("Durante la notte la voce deve restare attiva per chiamare i ruoli.");
        return;
      }
      state.audioWasForced = false;
      state.setup.audioMode = previousMode === "muted" ? "voice-ambience" : "muted";
      audio.setMode(effectiveAudioMode());
      audio.enable();
      if (previousMode === "muted" && effectiveAudioMode() !== "muted") {
        lastNarrationKey = "";
        narrateCurrentScreen();
      }
      saveGame();
    });
    document.getElementById("audio-repeat")?.addEventListener("click", () => {
      audio.enable();
      repeatScreenNarration();
    });
    privacyCover?.querySelector("button")?.addEventListener("click", hidePrivacyCover);
  }

  document.addEventListener("click", handleClick);
  document.addEventListener("change", handleChange);
  document.addEventListener("input", handleInput);
  document.addEventListener("pointerdown", startHold);
  document.addEventListener("pointerup", cancelHold);
  document.addEventListener("pointercancel", cancelHold);
  document.addEventListener("pointerleave", (event) => {
    if (event.target === holdButton) cancelHold();
  });
  document.addEventListener("keydown", (event) => {
    if (privacyIsCovered) {
      if (event.key === "Tab") {
        event.preventDefault();
        privacyCover?.querySelector("button")?.focus();
      }
      return;
    }
    if (
      state.screen === "assignment" &&
      !state.assignmentRevealed &&
      document.activeElement?.matches('[data-action="hold-reveal"]') &&
      (event.key === "Enter" || event.key === " ")
    ) {
      event.preventDefault();
      state.assignmentRevealed = true;
      saveAndRender();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      pauseScreenNarration();
      protectSecrets();
    } else resumeScreenNarration();
  });
  window.addEventListener("blur", () => {
    pauseScreenNarration();
    protectSecrets();
  });
  window.addEventListener("focus", resumeScreenNarration);

  wireGlobalControls();
  render();
})();

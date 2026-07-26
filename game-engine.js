(function (root, factory) {
  "use strict";

  var engine = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = engine;
  }

  if (root) {
    root.BlackoutEngine = engine;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var FACTIONS = Object.freeze({
    CUSTODI: "custodi",
    SABOTATORI: "sabotatori",
    NEUTRALE: "neutrale",
  });

  var CATEGORIES = Object.freeze({
    INVESTIGATION: "I",
    PROTECTION: "P",
    INFLUENCE: "V",
    NEUTRAL: "N",
    SABOTAGE: "G",
  });

  var ROLE_DATA = {
    custode: {
      id: "custode",
      label: "Custode",
      faction: FACTIONS.CUSTODI,
      category: null,
      isSpecial: false,
      maxUses: 0,
      asset: "art/cards/minimal/labelled/custode.png",
    },
    sabotatore: {
      id: "sabotatore",
      label: "Sabotatore",
      faction: FACTIONS.SABOTATORI,
      category: null,
      isSpecial: false,
      maxUses: 0,
      asset: "art/cards/minimal/labelled/sabotatore.png",
    },
    sentinella: {
      id: "sentinella",
      label: "Sentinella",
      faction: FACTIONS.CUSTODI,
      category: CATEGORIES.INVESTIGATION,
      isSpecial: true,
      maxUses: 1,
      asset: "art/cards/minimal/labelled/sentinella.png",
    },
    tecnico: {
      id: "tecnico",
      label: "Tecnico",
      faction: FACTIONS.CUSTODI,
      category: CATEGORIES.PROTECTION,
      isSpecial: true,
      maxUses: 1,
      asset: "art/cards/minimal/labelled/tecnico.png",
    },
    portavoce: {
      id: "portavoce",
      label: "Portavoce",
      faction: FACTIONS.CUSTODI,
      category: CATEGORIES.INFLUENCE,
      isSpecial: true,
      maxUses: 0,
      asset: "art/cards/minimal/labelled/portavoce.png",
    },
    naufrago: {
      id: "naufrago",
      label: "Naufrago",
      faction: FACTIONS.NEUTRALE,
      category: CATEGORIES.NEUTRAL,
      isSpecial: true,
      maxUses: 0,
      asset: "art/cards/minimal/labelled/naufrago.png",
    },
    vedetta: {
      id: "vedetta",
      label: "Vedetta",
      faction: FACTIONS.CUSTODI,
      category: CATEGORIES.INVESTIGATION,
      isSpecial: true,
      maxUses: 2,
      asset: "art/cards/minimal/labelled/vedetta.png",
    },
    cartografa: {
      id: "cartografa",
      label: "Cartografa della Baia",
      faction: FACTIONS.CUSTODI,
      category: CATEGORIES.INVESTIGATION,
      isSpecial: true,
      maxUses: 2,
      asset: "art/cards/minimal/labelled/cartografa-della-baia.png",
    },
    guastatore: {
      id: "guastatore",
      label: "Guastatore",
      faction: FACTIONS.SABOTATORI,
      category: CATEGORIES.SABOTAGE,
      isSpecial: true,
      maxUses: 1,
      asset: "art/cards/minimal/labelled/guastatore.png",
    },
  };

  var ROLES = Object.freeze(
    Object.keys(ROLE_DATA).reduce(function (roles, roleId) {
      roles[roleId] = Object.freeze(ROLE_DATA[roleId]);
      return roles;
    }, {})
  );

  var SPECIAL_ROLE_IDS = Object.freeze(
    Object.keys(ROLES).filter(function (roleId) {
      return ROLES[roleId].isSpecial;
    })
  );

  function RuleError(code, message, details) {
    this.name = "RuleError";
    this.code = code;
    this.message = message;
    this.details = details || {};

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RuleError);
    } else {
      this.stack = new Error(message).stack;
    }
  }

  RuleError.prototype = Object.create(Error.prototype);
  RuleError.prototype.constructor = RuleError;

  function makeError(code, message, details) {
    return {
      code: code,
      message: message,
      details: details || {},
    };
  }

  function throwValidationError(error, allErrors) {
    throw new RuleError(error.code, error.message, {
      error: error,
      errors: allErrors || [error],
    });
  }

  function assertPlayerCount(playerCount) {
    if (
      !Number.isInteger(playerCount) ||
      playerCount < 5 ||
      playerCount > 15
    ) {
      throw new RuleError(
        "PLAYER_COUNT_OUT_OF_RANGE",
        "Il numero di giocatori deve essere compreso tra 5 e 15.",
        { playerCount: playerCount, min: 5, max: 15 }
      );
    }
  }

  function getSaboteurCount(playerCount) {
    assertPlayerCount(playerCount);

    if (playerCount <= 7) {
      return 1;
    }

    if (playerCount <= 11) {
      return 2;
    }

    return 3;
  }

  function getCompositionRule(playerCount) {
    assertPlayerCount(playerCount);

    var specialSlots;
    var investigationLimit;
    var sabotageLimit;

    if (playerCount <= 6) {
      specialSlots = 1;
      investigationLimit = 1;
      sabotageLimit = 0;
    } else if (playerCount === 7) {
      specialSlots = 2;
      investigationLimit = 1;
      sabotageLimit = 0;
    } else if (playerCount === 8) {
      specialSlots = 2;
      investigationLimit = 1;
      sabotageLimit = 1;
    } else if (playerCount <= 11) {
      specialSlots = 3;
      investigationLimit = 1;
      sabotageLimit = 1;
    } else {
      specialSlots = 4;
      investigationLimit = 2;
      sabotageLimit = 1;
    }

    return {
      playerCount: playerCount,
      saboteurSlots: getSaboteurCount(playerCount),
      specialSlots: specialSlots,
      categoryMax: {
        I: investigationLimit,
        P: 1,
        V: 1,
        N: 1,
        G: sabotageLimit,
      },
    };
  }

  function normalizeRoleSelection(selectedRoles) {
    return Array.isArray(selectedRoles) ? selectedRoles.slice() : [];
  }

  function countSelectedCategories(roleIds) {
    var counts = { I: 0, P: 0, V: 0, N: 0, G: 0 };

    roleIds.forEach(function (roleId) {
      var role = ROLES[roleId];
      if (role && role.category) {
        counts[role.category] += 1;
      }
    });

    return counts;
  }

  function validateSpecialSelection(playerCount, selectedRoles) {
    var errors = [];
    var rule;

    try {
      rule = getCompositionRule(playerCount);
    } catch (error) {
      if (error instanceof RuleError) {
        errors.push(makeError(error.code, error.message, error.details));
        return {
          valid: false,
          errors: errors,
          rule: null,
          counts: null,
          selectedRoles: [],
        };
      }
      throw error;
    }

    if (!Array.isArray(selectedRoles)) {
      errors.push(
        makeError(
          "SPECIAL_SELECTION_NOT_ARRAY",
          "La selezione degli speciali deve essere un elenco di ruoli."
        )
      );
    }

    var roles = normalizeRoleSelection(selectedRoles);
    var seen = {};
    var knownUniqueRoles = [];

    roles.forEach(function (roleId) {
      var role = ROLES[roleId];

      if (!role) {
        errors.push(
          makeError("UNKNOWN_ROLE", "La selezione contiene un ruolo sconosciuto.", {
            roleId: roleId,
          })
        );
        return;
      }

      if (!role.isSpecial) {
        errors.push(
          makeError(
            "BASE_ROLE_SELECTED",
            "Custode e Sabotatore vengono aggiunti automaticamente.",
            { roleId: roleId }
          )
        );
        return;
      }

      if (seen[roleId]) {
        errors.push(
          makeError(
            "DUPLICATE_SPECIAL_ROLE",
            "Ogni personaggio speciale può essere scelto una sola volta.",
            { roleId: roleId }
          )
        );
        return;
      }

      seen[roleId] = true;
      knownUniqueRoles.push(roleId);
    });

    var counts = countSelectedCategories(knownUniqueRoles);

    if (roles.length !== rule.specialSlots) {
      errors.push(
        makeError(
          "SPECIAL_COUNT_MISMATCH",
          "La composizione deve usare esattamente " +
            rule.specialSlots +
            (rule.specialSlots === 1 ? " speciale." : " speciali."),
          { expected: rule.specialSlots, actual: roles.length }
        )
      );
    }

    Object.keys(rule.categoryMax).forEach(function (category) {
      if (counts[category] > rule.categoryMax[category]) {
        errors.push(
          makeError(
            "CATEGORY_LIMIT_EXCEEDED",
            "Sono stati scelti troppi ruoli della categoria " + category + ".",
            {
              category: category,
              max: rule.categoryMax[category],
              actual: counts[category],
            }
          )
        );
      }
    });

    if (counts.G > 0 && rule.saboteurSlots < 2) {
      errors.push(
        makeError(
          "GUASTATORE_REQUIRES_TWO_SABOTEURS",
          "Il Guastatore è disponibile solo con almeno due posti Sabotatore.",
          { saboteurSlots: rule.saboteurSlots }
        )
      );
    }

    if (
      playerCount >= 8 &&
      playerCount <= 11 &&
      counts.N > 0 &&
      counts.G > 0
    ) {
      errors.push(
        makeError(
          "NAUFRAGO_GUASTATORE_CONFLICT",
          "Tra 8 e 11 giocatori Naufrago e Guastatore non possono convivere."
        )
      );
    }

    if (counts.I > 1 && (playerCount < 12 || counts.G === 0)) {
      errors.push(
        makeError(
          "DOUBLE_INVESTIGATION_REQUIRES_GUASTATORE",
          "Due ruoli di Indagine richiedono almeno 12 giocatori e il Guastatore.",
          { playerCount: playerCount, investigationRoles: counts.I }
        )
      );
    }

    var custodianSpecials = counts.I + counts.P + counts.V;
    if (playerCount >= 12 && custodianSpecials < 2) {
      errors.push(
        makeError(
          "MIN_CUSTODIAN_SPECIALS",
          "Da 12 giocatori servono almeno due speciali schierati con i Custodi.",
          { minimum: 2, actual: custodianSpecials }
        )
      );
    }

    if (playerCount >= 12 && counts.N + counts.G === 0) {
      errors.push(
        makeError(
          "NAUFRAGO_OR_GUASTATORE_REQUIRED",
          "Da 12 giocatori deve essere presente almeno uno tra Naufrago e Guastatore."
        )
      );
    }

    return {
      valid: errors.length === 0,
      errors: errors,
      rule: rule,
      counts: {
        categories: counts,
        specials: roles.length,
        custodianSpecials: custodianSpecials,
      },
      selectedRoles: knownUniqueRoles,
    };
  }

  function buildRoleDeck(playerCount, selectedRoles) {
    var validation = validateSpecialSelection(playerCount, selectedRoles);

    if (!validation.valid) {
      throwValidationError(validation.errors[0], validation.errors);
    }

    var deck = validation.selectedRoles.slice();
    var guastatoreCount = validation.counts.categories.G;
    var ordinarySaboteurs =
      validation.rule.saboteurSlots - guastatoreCount;
    var index;

    for (index = 0; index < ordinarySaboteurs; index += 1) {
      deck.push("sabotatore");
    }

    while (deck.length < playerCount) {
      deck.push("custode");
    }

    return deck;
  }

  function getCryptoProvider() {
    if (
      typeof globalThis !== "undefined" &&
      globalThis.crypto &&
      typeof globalThis.crypto.getRandomValues === "function"
    ) {
      return globalThis.crypto;
    }

    if (typeof require === "function") {
      try {
        var nodeCrypto = require("node:crypto");
        if (
          nodeCrypto.webcrypto &&
          typeof nodeCrypto.webcrypto.getRandomValues === "function"
        ) {
          return nodeCrypto.webcrypto;
        }
      } catch (error) {
        return null;
      }
    }

    return null;
  }

  function secureRandomInt(maxExclusive, cryptoProvider) {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new RuleError(
        "INVALID_RANDOM_RANGE",
        "Il limite casuale deve essere un intero positivo.",
        { maxExclusive: maxExclusive }
      );
    }

    if (maxExclusive > 0x100000000) {
      throw new RuleError(
        "RANDOM_RANGE_TOO_LARGE",
        "Il generatore supporta al massimo 2^32 risultati.",
        { maxExclusive: maxExclusive }
      );
    }

    var provider = cryptoProvider || getCryptoProvider();
    if (!provider) {
      throw new RuleError(
        "SECURE_RANDOM_UNAVAILABLE",
        "Il browser non offre un generatore casuale crittografico. Fornire randomInt per i test."
      );
    }

    var range = 0x100000000;
    var acceptanceLimit = Math.floor(range / maxExclusive) * maxExclusive;
    var buffer = new Uint32Array(1);
    var value;

    do {
      provider.getRandomValues(buffer);
      value = buffer[0];
    } while (value >= acceptanceLimit);

    return value % maxExclusive;
  }

  function shuffle(items, options) {
    if (!Array.isArray(items)) {
      throw new RuleError(
        "SHUFFLE_INPUT_NOT_ARRAY",
        "È possibile mescolare soltanto un elenco."
      );
    }

    var randomInt;
    if (typeof options === "function") {
      randomInt = options;
    } else if (options && typeof options.randomInt === "function") {
      randomInt = options.randomInt;
    } else {
      randomInt = secureRandomInt;
    }

    var shuffled = items.slice();
    for (var index = shuffled.length - 1; index > 0; index -= 1) {
      var swapIndex = randomInt(index + 1);

      if (
        !Number.isInteger(swapIndex) ||
        swapIndex < 0 ||
        swapIndex > index
      ) {
        throw new RuleError(
          "INVALID_RANDOM_RESULT",
          "randomInt ha restituito un valore fuori intervallo.",
          { value: swapIndex, maxExclusive: index + 1 }
        );
      }

      var temporary = shuffled[index];
      shuffled[index] = shuffled[swapIndex];
      shuffled[swapIndex] = temporary;
    }

    return shuffled;
  }

  function normalizePlayersInput(players) {
    if (!Array.isArray(players)) {
      throw new RuleError(
        "PLAYERS_NOT_ARRAY",
        "I giocatori devono essere forniti come elenco."
      );
    }

    assertPlayerCount(players.length);

    var seenIds = {};

    return players.map(function (player, index) {
      var fallbackId = "p" + (index + 1);
      var id;
      var name;

      if (typeof player === "string") {
        id = fallbackId;
        name = player.trim() || "Giocatore " + (index + 1);
      } else if (player && typeof player === "object") {
        id =
          typeof player.id === "string" && player.id.trim()
            ? player.id.trim()
            : fallbackId;
        name =
          typeof player.name === "string" && player.name.trim()
            ? player.name.trim()
            : "Giocatore " + (index + 1);
      } else {
        id = fallbackId;
        name = "Giocatore " + (index + 1);
      }

      if (seenIds[id]) {
        throw new RuleError(
          "DUPLICATE_PLAYER_ID",
          "Ogni giocatore deve avere un identificativo unico.",
          { playerId: id }
        );
      }

      seenIds[id] = true;
      return { id: id, name: name };
    });
  }

  function createGame(config) {
    config = config || {};
    var playerEntries = normalizePlayersInput(config.players);
    var specialRoles = config.specialRoles || [];
    var deck = buildRoleDeck(playerEntries.length, specialRoles);
    var shuffledRoles = shuffle(deck, { randomInt: config.randomInt });

    return {
      version: 1,
      day: 1,
      phase: "day",
      players: playerEntries.map(function (player, index) {
        var role = ROLES[shuffledRoles[index]];
        return {
          id: player.id,
          name: player.name,
          roleId: role.id,
          faction: role.faction,
          alive: true,
          usesRemaining: role.maxUses,
        };
      }),
      selectedSpecialRoles: specialRoles.slice(),
      activeDoubleVote: null,
      winner: null,
    };
  }

  function getRole(roleOrPlayer) {
    var roleId =
      typeof roleOrPlayer === "string"
        ? roleOrPlayer
        : roleOrPlayer && roleOrPlayer.roleId;
    var role = ROLES[roleId];

    if (!role) {
      throw new RuleError("UNKNOWN_ROLE", "Ruolo sconosciuto.", {
        roleId: roleId,
      });
    }

    return role;
  }

  function getFaction(roleOrPlayer) {
    return getRole(roleOrPlayer).faction;
  }

  function getSentinelAlignment(roleOrPlayer) {
    return getFaction(roleOrPlayer);
  }

  function areSameFaction(firstRoleOrPlayer, secondRoleOrPlayer) {
    var firstFaction = getFaction(firstRoleOrPlayer);
    var secondFaction = getFaction(secondRoleOrPlayer);

    if (
      firstFaction === FACTIONS.NEUTRALE ||
      secondFaction === FACTIONS.NEUTRALE
    ) {
      return false;
    }

    return firstFaction === secondFaction;
  }

  function normalizeGamePlayers(players) {
    if (!Array.isArray(players)) {
      throw new RuleError(
        "PLAYERS_NOT_ARRAY",
        "I giocatori devono essere forniti come elenco."
      );
    }

    var seenIds = {};

    return players.map(function (player) {
      if (!player || typeof player !== "object") {
        throw new RuleError(
          "INVALID_PLAYER",
          "Ogni giocatore deve essere un oggetto."
        );
      }

      if (typeof player.id !== "string" || !player.id) {
        throw new RuleError(
          "PLAYER_ID_REQUIRED",
          "Ogni giocatore deve avere un identificativo."
        );
      }

      if (seenIds[player.id]) {
        throw new RuleError(
          "DUPLICATE_PLAYER_ID",
          "Ogni giocatore deve avere un identificativo unico.",
          { playerId: player.id }
        );
      }

      seenIds[player.id] = true;
      var role = getRole(player);
      var uses;
      if (player.usesRemaining === undefined) {
        uses = role.maxUses;
      } else if (
        !Number.isInteger(player.usesRemaining) ||
        player.usesRemaining < 0 ||
        player.usesRemaining > role.maxUses
      ) {
        throw new RuleError(
          "INVALID_POWER_USES",
          "Gli utilizzi rimasti devono essere compresi tra zero e il massimo del ruolo.",
          {
            playerId: player.id,
            roleId: role.id,
            usesRemaining: player.usesRemaining,
            maxUses: role.maxUses,
          }
        );
      } else {
        uses = player.usesRemaining;
      }

      return Object.assign({}, player, {
        faction: role.faction,
        alive: player.alive !== false,
        usesRemaining: uses,
      });
    });
  }

  function countAliveByFaction(players) {
    var normalized = normalizeGamePlayers(players);
    var counts = {
      custodi: 0,
      sabotatori: 0,
      neutrali: 0,
      total: 0,
    };

    normalized.forEach(function (player) {
      if (!player.alive) {
        return;
      }

      counts.total += 1;
      if (player.faction === FACTIONS.CUSTODI) {
        counts.custodi += 1;
      } else if (player.faction === FACTIONS.SABOTATORI) {
        counts.sabotatori += 1;
      } else {
        counts.neutrali += 1;
      }
    });

    return counts;
  }

  function checkWin(players) {
    var normalized = normalizeGamePlayers(players);
    var counts = countAliveByFaction(normalized);
    var winningFaction = null;
    var reason = null;

    if (counts.sabotatori === 0) {
      winningFaction = FACTIONS.CUSTODI;
      reason = "allSaboteursEliminated";
    } else if (counts.sabotatori >= counts.custodi) {
      winningFaction = FACTIONS.SABOTATORI;
      reason = "saboteurParity";
    }

    if (!winningFaction) {
      return null;
    }

    var winnerPlayerIds = normalized
      .filter(function (player) {
        return (
          player.faction === winningFaction ||
          (player.faction === FACTIONS.NEUTRALE && player.alive)
        );
      })
      .map(function (player) {
        return player.id;
      });

    var neutralWinnerIds = normalized
      .filter(function (player) {
        return player.faction === FACTIONS.NEUTRALE && player.alive;
      })
      .map(function (player) {
        return player.id;
      });

    return {
      winningFaction: winningFaction,
      reason: reason,
      counts: counts,
      winnerPlayerIds: winnerPlayerIds,
      neutralWinnerIds: neutralWinnerIds,
      naufragoCoWinner: neutralWinnerIds.length > 0,
    };
  }

  function findPlayer(players, playerId) {
    return players.find(function (player) {
      return player.id === playerId;
    });
  }

  function validateDayElimination(players, targetId) {
    var errors = [];
    var normalized;

    try {
      normalized = normalizeGamePlayers(players);
    } catch (error) {
      if (error instanceof RuleError) {
        return {
          valid: false,
          errors: [makeError(error.code, error.message, error.details)],
          target: null,
        };
      }
      throw error;
    }

    if (typeof targetId !== "string" || !targetId) {
      errors.push(
        makeError(
          "DAY_ELIMINATION_REQUIRED",
          "Ogni giorno deve concludersi con un giocatore eliminato."
        )
      );
    }

    var target = findPlayer(normalized, targetId);
    if (targetId && !target) {
      errors.push(
        makeError("TARGET_NOT_FOUND", "Il giocatore scelto non esiste.", {
          targetId: targetId,
        })
      );
    } else if (target && !target.alive) {
      errors.push(
        makeError(
          "TARGET_NOT_ALIVE",
          "Il giocatore scelto è già stato eliminato.",
          { targetId: targetId }
        )
      );
    }

    return {
      valid: errors.length === 0,
      errors: errors,
      target: target || null,
    };
  }

  function eliminatePlayer(players, targetId) {
    return normalizeGamePlayers(players).map(function (player) {
      if (player.id !== targetId) {
        return player;
      }

      return Object.assign({}, player, { alive: false });
    });
  }

  function resolveDayElimination(input) {
    input = input || {};
    var validation = validateDayElimination(input.players, input.targetId);

    if (!validation.valid) {
      throwValidationError(validation.errors[0], validation.errors);
    }

    var updatedPlayers = eliminatePlayer(input.players, input.targetId);
    var eliminatedPlayer = findPlayer(updatedPlayers, input.targetId);
    var portavoceTriggered = eliminatedPlayer.roleId === "portavoce";

    return {
      players: updatedPlayers,
      eliminatedPlayer: eliminatedPlayer,
      eliminatedPlayerId: eliminatedPlayer.id,
      portavoceTriggered: portavoceTriggered,
      winCheckDeferred: portavoceTriggered,
    };
  }

  function countWords(message) {
    if (typeof message !== "string") {
      return 0;
    }

    var trimmed = message.trim();
    return trimmed ? trimmed.split(/\s+/u).length : 0;
  }

  function validateLastMessage(message, maxWords) {
    var limit =
      Number.isInteger(maxWords) && maxWords >= 0 ? maxWords : 10;
    var words = countWords(message);

    return {
      valid: words <= limit,
      wordCount: words,
      maxWords: limit,
      remainingWords: Math.max(0, limit - words),
    };
  }

  function createPortavoceBonus(sourceOrConfig, designatedPlayerId) {
    var config =
      sourceOrConfig && typeof sourceOrConfig === "object"
        ? sourceOrConfig
        : {
            sourcePlayerId: sourceOrConfig,
            designatedPlayerId: designatedPlayerId,
          };

    if (
      typeof config.sourcePlayerId !== "string" ||
      !config.sourcePlayerId
    ) {
      throw new RuleError(
        "PORTAVOCE_SOURCE_REQUIRED",
        "Manca il Portavoce che ha attivato il potere."
      );
    }

    if (
      typeof config.designatedPlayerId !== "string" ||
      !config.designatedPlayerId
    ) {
      throw new RuleError(
        "PORTAVOCE_DESIGNATION_REQUIRED",
        "Il Portavoce deve designare un giocatore vivo."
      );
    }

    return {
      sourcePlayerId: config.sourcePlayerId,
      designatedPlayerId: config.designatedPlayerId,
      status: "active",
      createdOnDay:
        Number.isInteger(config.createdOnDay) && config.createdOnDay >= 0
          ? config.createdOnDay
          : null,
      createdAfterPhase: config.createdAfterPhase || null,
    };
  }

  function validatePortavoceDesignation(
    players,
    sourcePlayerId,
    designatedPlayerId
  ) {
    var errors = [];
    var normalized;

    try {
      normalized = normalizeGamePlayers(players);
    } catch (error) {
      if (error instanceof RuleError) {
        return {
          valid: false,
          errors: [makeError(error.code, error.message, error.details)],
          source: null,
          designated: null,
        };
      }
      throw error;
    }

    var source = findPlayer(normalized, sourcePlayerId);
    var designated = findPlayer(normalized, designatedPlayerId);

    if (!source || source.roleId !== "portavoce") {
      errors.push(
        makeError(
          "PORTAVOCE_SOURCE_INVALID",
          "Il potere può essere attivato soltanto dal Portavoce eliminato.",
          { sourcePlayerId: sourcePlayerId }
        )
      );
    } else if (source.alive) {
      errors.push(
        makeError(
          "PORTAVOCE_NOT_ELIMINATED",
          "Il Portavoce può designare un giocatore solo dopo l'eliminazione.",
          { sourcePlayerId: sourcePlayerId }
        )
      );
    }

    if (!designatedPlayerId) {
      errors.push(
        makeError(
          "PORTAVOCE_DESIGNATION_REQUIRED",
          "Il Portavoce deve designare un giocatore vivo."
        )
      );
    } else if (!designated) {
      errors.push(
        makeError(
          "TARGET_NOT_FOUND",
          "Il giocatore designato non esiste.",
          { designatedPlayerId: designatedPlayerId }
        )
      );
    } else if (!designated.alive) {
      errors.push(
        makeError(
          "TARGET_NOT_ALIVE",
          "Il Portavoce deve designare un giocatore ancora vivo.",
          { designatedPlayerId: designatedPlayerId }
        )
      );
    }

    return {
      valid: errors.length === 0,
      errors: errors,
      source: source || null,
      designated: designated || null,
    };
  }

  function getPortavoceBonusStatus(bonus, players) {
    if (!bonus) {
      return "none";
    }

    if (bonus.status && bonus.status !== "active") {
      return bonus.status;
    }

    var normalized = normalizeGamePlayers(players);
    var designated = findPlayer(normalized, bonus.designatedPlayerId);
    return designated && designated.alive ? "active" : "lost";
  }

  function consumePortavoceBonus(bonus, players) {
    if (!bonus) {
      return null;
    }

    var status = players
      ? getPortavoceBonusStatus(bonus, players)
      : bonus.status || "active";

    return Object.assign({}, bonus, {
      status: status === "lost" ? "lost" : "used",
    });
  }

  function findAliveRole(players, roleId) {
    return players.find(function (player) {
      return player.alive && player.roleId === roleId;
    });
  }

  function requestedAction(actions, roleId) {
    var action = actions[roleId];
    if (!action || action.use !== true) {
      return { use: false };
    }
    return action;
  }

  function pushRoleAvailabilityErrors(errors, player, roleId, action) {
    if (!action.use) {
      return;
    }

    if (!player) {
      errors.push(
        makeError(
          "ROLE_UNAVAILABLE",
          "Il ruolo " + ROLES[roleId].label + " non può agire questa notte.",
          { roleId: roleId }
        )
      );
      return;
    }

    if (player.usesRemaining <= 0) {
      errors.push(
        makeError(
          "POWER_EXHAUSTED",
          "Il ruolo " + ROLES[roleId].label + " non ha utilizzi rimasti.",
          { roleId: roleId, playerId: player.id }
        )
      );
    }
  }

  function validateSingleTargetAction(
    errors,
    players,
    actor,
    roleId,
    action
  ) {
    if (!action.use || !actor || actor.usesRemaining <= 0) {
      return;
    }

    var target = findPlayer(players, action.targetId);
    if (!action.targetId) {
      errors.push(
        makeError(
          "POWER_TARGET_REQUIRED",
          ROLES[roleId].label + " deve scegliere un bersaglio.",
          { roleId: roleId }
        )
      );
    } else if (!target) {
      errors.push(
        makeError("TARGET_NOT_FOUND", "Il bersaglio scelto non esiste.", {
          roleId: roleId,
          targetId: action.targetId,
        })
      );
    } else if (!target.alive) {
      errors.push(
        makeError(
          "TARGET_NOT_ALIVE",
          "Il bersaglio scelto è già stato eliminato.",
          { roleId: roleId, targetId: action.targetId }
        )
      );
    } else if (target.id === actor.id) {
      errors.push(
        makeError(
          "SELF_TARGET_FORBIDDEN",
          ROLES[roleId].label + " non può scegliere se stesso.",
          { roleId: roleId, playerId: actor.id }
        )
      );
    }
  }

  function validateCartographerAction(errors, players, actor, action) {
    if (!action.use || !actor || actor.usesRemaining <= 0) {
      return;
    }

    var targetIds = Array.isArray(action.targetIds)
      ? action.targetIds
      : [];

    if (targetIds.length !== 2) {
      errors.push(
        makeError(
          "CARTOGRAPHER_REQUIRES_TWO_TARGETS",
          "La Cartografa deve scegliere esattamente due giocatori.",
          { targetIds: targetIds }
        )
      );
      return;
    }

    if (targetIds[0] === targetIds[1]) {
      errors.push(
        makeError(
          "CARTOGRAPHER_TARGETS_MUST_DIFFER",
          "La Cartografa deve scegliere due giocatori differenti.",
          { targetIds: targetIds }
        )
      );
    }

    targetIds.forEach(function (targetId) {
      var target = findPlayer(players, targetId);
      if (!target) {
        errors.push(
          makeError("TARGET_NOT_FOUND", "Il bersaglio scelto non esiste.", {
            roleId: "cartografa",
            targetId: targetId,
          })
        );
      } else if (!target.alive) {
        errors.push(
          makeError(
            "TARGET_NOT_ALIVE",
            "Il bersaglio scelto è già stato eliminato.",
            { roleId: "cartografa", targetId: targetId }
          )
        );
      } else if (target.id === actor.id) {
        errors.push(
          makeError(
            "SELF_TARGET_FORBIDDEN",
            "La Cartografa non può scegliere se stessa.",
            { roleId: "cartografa", playerId: actor.id }
          )
        );
      }
    });
  }

  function validateNightActions(input) {
    input = input || {};
    var actions =
      input.actions && typeof input.actions === "object" ? input.actions : {};
    var errors = [];
    var players;

    try {
      players = normalizeGamePlayers(input.players);
    } catch (error) {
      if (error instanceof RuleError) {
        return {
          valid: false,
          errors: [makeError(error.code, error.message, error.details)],
          players: [],
          actions: actions,
        };
      }
      throw error;
    }

    var livingSaboteurs = players.filter(function (player) {
      return player.alive && player.faction === FACTIONS.SABOTATORI;
    });

    if (livingSaboteurs.length === 0) {
      errors.push(
        makeError(
          "NO_LIVING_SABOTEUR",
          "La notte non può iniziare dopo l'eliminazione di tutti i Sabotatori."
        )
      );
    }

    var sabotageTarget = findPlayer(players, actions.sabotageTargetId);
    if (
      typeof actions.sabotageTargetId !== "string" ||
      !actions.sabotageTargetId
    ) {
      errors.push(
        makeError(
          "SABOTAGE_TARGET_REQUIRED",
          "I Sabotatori devono concordare un unico bersaglio."
        )
      );
    } else if (!sabotageTarget) {
      errors.push(
        makeError(
          "TARGET_NOT_FOUND",
          "Il bersaglio del sabotaggio non esiste.",
          { targetId: actions.sabotageTargetId }
        )
      );
    } else if (!sabotageTarget.alive) {
      errors.push(
        makeError(
          "TARGET_NOT_ALIVE",
          "Il bersaglio del sabotaggio è già stato eliminato.",
          { targetId: actions.sabotageTargetId }
        )
      );
    } else if (sabotageTarget.faction === FACTIONS.SABOTATORI) {
      errors.push(
        makeError(
          "SABOTEUR_FRIENDLY_FIRE_FORBIDDEN",
          "I Sabotatori non possono scegliere un compagno di fazione.",
          { targetId: actions.sabotageTargetId }
        )
      );
    }

    var roleIds = [
      "guastatore",
      "tecnico",
      "sentinella",
      "cartografa",
      "vedetta",
    ];
    var actors = {};
    var normalizedActions = {};

    roleIds.forEach(function (roleId) {
      actors[roleId] = findAliveRole(players, roleId);
      normalizedActions[roleId] = requestedAction(actions, roleId);
      pushRoleAvailabilityErrors(
        errors,
        actors[roleId],
        roleId,
        normalizedActions[roleId]
      );
    });

    validateSingleTargetAction(
      errors,
      players,
      actors.sentinella,
      "sentinella",
      normalizedActions.sentinella
    );
    validateSingleTargetAction(
      errors,
      players,
      actors.vedetta,
      "vedetta",
      normalizedActions.vedetta
    );
    validateCartographerAction(
      errors,
      players,
      actors.cartografa,
      normalizedActions.cartografa
    );

    return {
      valid: errors.length === 0,
      errors: errors,
      players: players,
      actions: Object.assign({}, actions, normalizedActions),
      actors: actors,
      sabotageTarget: sabotageTarget || null,
      livingSaboteurs: livingSaboteurs,
    };
  }

  function decrementUse(players, playerId) {
    return players.map(function (player) {
      if (player.id !== playerId) {
        return player;
      }

      return Object.assign({}, player, {
        usesRemaining: player.usesRemaining - 1,
      });
    });
  }

  function initialRoleResult(actor, action) {
    if (!actor || actor.usesRemaining <= 0) {
      return { status: "unavailable" };
    }

    if (!action.use) {
      return { status: "skipped", playerId: actor.id };
    }

    return { status: "pending", playerId: actor.id };
  }

  function resolveNight(input) {
    var validation = validateNightActions(input);

    if (!validation.valid) {
      throwValidationError(validation.errors[0], validation.errors);
    }

    var actions = validation.actions;
    var actors = validation.actors;
    var players = validation.players.map(function (player) {
      return Object.assign({}, player);
    });
    var interference = actions.guastatore.use === true;
    var consumedUses = [];
    var acted = {};
    var results = {
      guastatore: initialRoleResult(
        actors.guastatore,
        actions.guastatore
      ),
      tecnico: initialRoleResult(actors.tecnico, actions.tecnico),
      sentinella: initialRoleResult(
        actors.sentinella,
        actions.sentinella
      ),
      cartografa: initialRoleResult(
        actors.cartografa,
        actions.cartografa
      ),
      vedetta: initialRoleResult(actors.vedetta, actions.vedetta),
    };

    validation.livingSaboteurs.forEach(function (player) {
      acted[player.id] = true;
    });

    [
      "guastatore",
      "tecnico",
      "sentinella",
      "cartografa",
      "vedetta",
    ].forEach(function (roleId) {
      if (actions[roleId].use && actors[roleId]) {
        acted[actors[roleId].id] = true;
      }
    });

    if (interference) {
      players = decrementUse(players, actors.guastatore.id);
      consumedUses.push({
        playerId: actors.guastatore.id,
        roleId: "guastatore",
        amount: 1,
      });
      results.guastatore = {
        status: "resolved",
        playerId: actors.guastatore.id,
        interference: true,
      };
    } else if (
      actors.guastatore &&
      actors.guastatore.usesRemaining > 0
    ) {
      results.guastatore = {
        status: actions.guastatore.use ? "resolved" : "skipped",
        playerId: actors.guastatore.id,
        interference: false,
      };
    }

    var sabotagePrevented = false;
    if (actions.tecnico.use) {
      if (interference) {
        results.tecnico = {
          status: "blocked",
          playerId: actors.tecnico.id,
          preventedSabotage: false,
        };
      } else {
        players = decrementUse(players, actors.tecnico.id);
        consumedUses.push({
          playerId: actors.tecnico.id,
          roleId: "tecnico",
          amount: 1,
        });
        sabotagePrevented = true;
        results.tecnico = {
          status: "resolved",
          playerId: actors.tecnico.id,
          preventedSabotage: true,
        };
      }
    }

    var investigatorIds = ["sentinella", "cartografa", "vedetta"];
    investigatorIds.forEach(function (roleId) {
      var action = actions[roleId];
      var actor = actors[roleId];

      if (!action.use) {
        return;
      }

      if (interference) {
        results[roleId] = {
          status: "blocked",
          playerId: actor.id,
        };
        return;
      }

      players = decrementUse(players, actor.id);
      consumedUses.push({
        playerId: actor.id,
        roleId: roleId,
        amount: 1,
      });

      if (roleId === "sentinella") {
        var sentinelTarget = findPlayer(players, action.targetId);
        results.sentinella = {
          status: "resolved",
          playerId: actor.id,
          targetId: sentinelTarget.id,
          alignment: getSentinelAlignment(sentinelTarget),
        };
      } else if (roleId === "cartografa") {
        var firstTarget = findPlayer(players, action.targetIds[0]);
        var secondTarget = findPlayer(players, action.targetIds[1]);
        results.cartografa = {
          status: "resolved",
          playerId: actor.id,
          targetIds: [firstTarget.id, secondTarget.id],
          sameFaction: areSameFaction(firstTarget, secondTarget),
        };
      } else {
        results.vedetta = {
          status: "resolved",
          playerId: actor.id,
          targetId: action.targetId,
          acted: acted[action.targetId] === true,
        };
      }
    });

    var victimId = sabotagePrevented
      ? null
      : validation.sabotageTarget.id;

    if (victimId) {
      players = eliminatePlayer(players, victimId);
    }

    var victim = victimId ? findPlayer(players, victimId) : null;

    return {
      players: players,
      victimId: victimId,
      victim: victim,
      interference: interference,
      sabotagePrevented: sabotagePrevented,
      results: results,
      actedPlayerIds: Object.keys(acted),
      consumedUses: consumedUses,
      portavoceTriggered: Boolean(victim && victim.roleId === "portavoce"),
      winCheckDeferred: Boolean(victim && victim.roleId === "portavoce"),
    };
  }

  return Object.freeze({
    FACTIONS: FACTIONS,
    CATEGORIES: CATEGORIES,
    ROLES: ROLES,
    SPECIAL_ROLE_IDS: SPECIAL_ROLE_IDS,
    RuleError: RuleError,
    getSaboteurCount: getSaboteurCount,
    getCompositionRule: getCompositionRule,
    validateSpecialSelection: validateSpecialSelection,
    buildRoleDeck: buildRoleDeck,
    secureRandomInt: secureRandomInt,
    shuffle: shuffle,
    createGame: createGame,
    getRole: getRole,
    getFaction: getFaction,
    getSentinelAlignment: getSentinelAlignment,
    areSameFaction: areSameFaction,
    countAliveByFaction: countAliveByFaction,
    checkWin: checkWin,
    validateDayElimination: validateDayElimination,
    resolveDayElimination: resolveDayElimination,
    countWords: countWords,
    validateLastMessage: validateLastMessage,
    validatePortavoceDesignation: validatePortavoceDesignation,
    createPortavoceBonus: createPortavoceBonus,
    getPortavoceBonusStatus: getPortavoceBonusStatus,
    consumePortavoceBonus: consumePortavoceBonus,
    validateNightActions: validateNightActions,
    resolveNight: resolveNight,
  });
});

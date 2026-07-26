"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("../game-engine.js");

function player(id, roleId, options = {}) {
  const role = Engine.ROLES[roleId];
  return {
    id,
    name: options.name || id,
    roleId,
    faction: role.faction,
    alive: options.alive !== false,
    usesRemaining:
      options.usesRemaining === undefined
        ? role.maxUses
        : options.usesRemaining,
  };
}

function actionSet(sabotageTargetId, overrides = {}) {
  return Object.assign(
    {
      sabotageTargetId,
      guastatore: { use: false },
      tecnico: { use: false },
      sentinella: { use: false },
      cartografa: { use: false },
      vedetta: { use: false },
    },
    overrides
  );
}

test("le soglie dei Sabotatori sono 1/2/3", () => {
  [5, 6, 7].forEach((count) => {
    assert.equal(Engine.getSaboteurCount(count), 1);
  });
  [8, 9, 10, 11].forEach((count) => {
    assert.equal(Engine.getSaboteurCount(count), 2);
  });
  [12, 13, 14, 15].forEach((count) => {
    assert.equal(Engine.getSaboteurCount(count), 3);
  });
});

test("il numero giocatori fuori da 5-15 viene rifiutato", () => {
  assert.throws(
    () => Engine.getCompositionRule(4),
    (error) =>
      error instanceof Engine.RuleError &&
      error.code === "PLAYER_COUNT_OUT_OF_RANGE"
  );
  assert.throws(
    () => Engine.getCompositionRule(16),
    (error) =>
      error instanceof Engine.RuleError &&
      error.code === "PLAYER_COUNT_OUT_OF_RANGE"
  );
});

test("le fasce di composizione espongono slot e limiti corretti", () => {
  assert.deepEqual(Engine.getCompositionRule(5).categoryMax, {
    I: 1,
    P: 1,
    V: 1,
    N: 1,
    G: 0,
  });
  assert.equal(Engine.getCompositionRule(5).specialSlots, 1);
  assert.equal(Engine.getCompositionRule(7).specialSlots, 2);
  assert.equal(Engine.getCompositionRule(8).specialSlots, 2);
  assert.equal(Engine.getCompositionRule(10).specialSlots, 3);
  assert.equal(Engine.getCompositionRule(12).specialSlots, 4);
  assert.equal(Engine.getCompositionRule(12).categoryMax.I, 2);
});

test("le composizioni di esempio valide vengono accettate", () => {
  const cases = [
    [5, ["sentinella"]],
    [7, ["tecnico", "portavoce"]],
    [8, ["guastatore", "sentinella"]],
    [10, ["sentinella", "tecnico", "naufrago"]],
    [10, ["guastatore", "sentinella", "portavoce"]],
    [12, ["guastatore", "sentinella", "vedetta", "naufrago"]],
  ];

  cases.forEach(([count, roles]) => {
    const validation = Engine.validateSpecialSelection(count, roles);
    assert.equal(
      validation.valid,
      true,
      `${count}: ${validation.errors.map((error) => error.code).join(", ")}`
    );
  });
});

test("la selezione richiede il numero esatto di speciali e ruoli unici", () => {
  const tooFew = Engine.validateSpecialSelection(7, ["tecnico"]);
  assert.equal(tooFew.valid, false);
  assert.ok(
    tooFew.errors.some(
      (error) => error.code === "SPECIAL_COUNT_MISMATCH"
    )
  );

  const duplicate = Engine.validateSpecialSelection(7, [
    "tecnico",
    "tecnico",
  ]);
  assert.equal(duplicate.valid, false);
  assert.ok(
    duplicate.errors.some(
      (error) => error.code === "DUPLICATE_SPECIAL_ROLE"
    )
  );
});

test("i vincoli speciali N/G e doppia Indagine vengono applicati", () => {
  const unavailableGuastatore = Engine.validateSpecialSelection(7, [
    "guastatore",
    "sentinella",
  ]);
  assert.equal(unavailableGuastatore.valid, false);
  assert.ok(
    unavailableGuastatore.errors.some(
      (error) => error.code === "CATEGORY_LIMIT_EXCEEDED"
    )
  );
  assert.ok(
    unavailableGuastatore.errors.some(
      (error) => error.code === "GUASTATORE_REQUIRES_TWO_SABOTEURS"
    )
  );

  const conflict = Engine.validateSpecialSelection(10, [
    "guastatore",
    "naufrago",
    "portavoce",
  ]);
  assert.equal(conflict.valid, false);
  assert.ok(
    conflict.errors.some(
      (error) => error.code === "NAUFRAGO_GUASTATORE_CONFLICT"
    )
  );

  const doubleInvestigationWithoutG =
    Engine.validateSpecialSelection(12, [
      "sentinella",
      "vedetta",
      "tecnico",
      "naufrago",
    ]);
  assert.equal(doubleInvestigationWithoutG.valid, false);
  assert.ok(
    doubleInvestigationWithoutG.errors.some(
      (error) =>
        error.code === "DOUBLE_INVESTIGATION_REQUIRES_GUASTATORE"
    )
  );
});

test("da 12 giocatori valgono i minimi di fazione e la presenza N/G", () => {
  const noNeutralOrGuastatore = Engine.validateSpecialSelection(12, [
    "sentinella",
    "tecnico",
    "portavoce",
    "vedetta",
  ]);
  assert.equal(noNeutralOrGuastatore.valid, false);
  assert.ok(
    noNeutralOrGuastatore.errors.some(
      (error) => error.code === "NAUFRAGO_OR_GUASTATORE_REQUIRED"
    )
  );

  const tooFewCustodianSpecials = Engine.validateSpecialSelection(12, [
    "guastatore",
    "naufrago",
    "sentinella",
    "custode",
  ]);
  assert.equal(tooFewCustodianSpecials.valid, false);
  assert.ok(
    tooFewCustodianSpecials.errors.some(
      (error) => error.code === "MIN_CUSTODIAN_SPECIALS"
    )
  );
});

test("il Guastatore sostituisce un Sabotatore senza aumentare la fazione", () => {
  const deck = Engine.buildRoleDeck(12, [
    "guastatore",
    "sentinella",
    "vedetta",
    "naufrago",
  ]);
  const counts = deck.reduce((result, roleId) => {
    result[roleId] = (result[roleId] || 0) + 1;
    return result;
  }, {});

  assert.equal(deck.length, 12);
  assert.equal(counts.guastatore, 1);
  assert.equal(counts.sabotatore, 2);
  assert.equal(
    deck.filter(
      (roleId) =>
        Engine.getFaction(roleId) === Engine.FACTIONS.SABOTATORI
    ).length,
    3
  );
});

test("shuffle è immutabile e usa il generatore iniettato", () => {
  const source = ["a", "b", "c", "d"];
  const calls = [];
  const shuffled = Engine.shuffle(source, {
    randomInt(maxExclusive) {
      calls.push(maxExclusive);
      return 0;
    },
  });

  assert.deepEqual(source, ["a", "b", "c", "d"]);
  assert.deepEqual(calls, [4, 3, 2]);
  assert.deepEqual(shuffled, ["b", "c", "d", "a"]);
});

test("secureRandomInt evita il bias con rejection sampling", () => {
  const values = [0xffffffff, 5];
  const provider = {
    getRandomValues(buffer) {
      buffer[0] = values.shift();
      return buffer;
    },
  };

  assert.equal(Engine.secureRandomInt(3, provider), 2);
  assert.equal(values.length, 0);
});

test("createGame assegna un ruolo e gli utilizzi iniziali a ogni giocatore", () => {
  const game = Engine.createGame({
    players: ["Ada", "Bruno", "Carla", "Dario", "Elena"],
    specialRoles: ["tecnico"],
    randomInt: () => 0,
  });

  assert.equal(game.day, 1);
  assert.equal(game.phase, "day");
  assert.equal(game.players.length, 5);
  assert.equal(new Set(game.players.map((entry) => entry.id)).size, 5);
  assert.equal(
    game.players.filter((entry) => entry.roleId === "sabotatore").length,
    1
  );
  const tecnico = game.players.find((entry) => entry.roleId === "tecnico");
  assert.equal(tecnico.usesRemaining, 1);
});

test("la Sentinella vede il Naufrago come neutrale e la Cartografa come diverso", () => {
  assert.equal(
    Engine.getSentinelAlignment("naufrago"),
    Engine.FACTIONS.NEUTRALE
  );
  assert.equal(Engine.areSameFaction("naufrago", "custode"), false);
  assert.equal(Engine.areSameFaction("naufrago", "sabotatore"), false);
  assert.equal(Engine.areSameFaction("custode", "sentinella"), true);
  assert.equal(Engine.areSameFaction("sabotatore", "guastatore"), true);
});

test("il Naufrago non conta per la parità e vince solo se vivo", () => {
  const parity = [
    player("s1", "sabotatore"),
    player("c1", "custode"),
    player("n1", "naufrago"),
  ];
  const result = Engine.checkWin(parity);
  assert.equal(result.winningFaction, Engine.FACTIONS.SABOTATORI);
  assert.deepEqual(result.counts, {
    custodi: 1,
    sabotatori: 1,
    neutrali: 1,
    total: 3,
  });
  assert.equal(result.naufragoCoWinner, true);
  assert.ok(result.winnerPlayerIds.includes("n1"));

  const deadNaufrago = parity.map((entry) =>
    entry.id === "n1" ? Object.assign({}, entry, { alive: false }) : entry
  );
  const secondResult = Engine.checkWin(deadNaufrago);
  assert.equal(secondResult.naufragoCoWinner, false);
  assert.ok(!secondResult.winnerPlayerIds.includes("n1"));
});

test("tutta la fazione vincente vince, anche chi è già eliminato", () => {
  const players = [
    player("s1", "sabotatore", { alive: false }),
    player("c1", "custode"),
    player("c2", "sentinella", { alive: false }),
  ];
  const result = Engine.checkWin(players);
  assert.equal(result.winningFaction, Engine.FACTIONS.CUSTODI);
  assert.ok(result.winnerPlayerIds.includes("c1"));
  assert.ok(result.winnerPlayerIds.includes("c2"));
});

test("il giorno richiede sempre un eliminato vivo", () => {
  const players = [
    player("s1", "sabotatore"),
    player("c1", "custode"),
  ];

  const missing = Engine.validateDayElimination(players, "");
  assert.equal(missing.valid, false);
  assert.equal(missing.errors[0].code, "DAY_ELIMINATION_REQUIRED");

  const first = Engine.resolveDayElimination({
    players,
    targetId: "c1",
  });
  assert.equal(first.players.find((entry) => entry.id === "c1").alive, false);
  assert.equal(players.find((entry) => entry.id === "c1").alive, true);

  assert.throws(
    () =>
      Engine.resolveDayElimination({
        players: first.players,
        targetId: "c1",
      }),
    (error) =>
      error instanceof Engine.RuleError &&
      error.code === "TARGET_NOT_ALIVE"
  );
});

test("l'eliminazione del Portavoce rinvia il controllo vittoria", () => {
  const result = Engine.resolveDayElimination({
    players: [
      player("s1", "sabotatore"),
      player("p1", "portavoce"),
      player("c1", "custode"),
    ],
    targetId: "p1",
  });

  assert.equal(result.portavoceTriggered, true);
  assert.equal(result.winCheckDeferred, true);
});

test("gli helper del Portavoce applicano limite parole e perdita del bonus", () => {
  assert.deepEqual(Engine.validateLastMessage("uno due tre"), {
    valid: true,
    wordCount: 3,
    maxWords: 10,
    remainingWords: 7,
  });
  assert.equal(
    Engine.validateLastMessage(
      "uno due tre quattro cinque sei sette otto nove dieci undici"
    ).valid,
    false
  );

  const bonus = Engine.createPortavoceBonus("p1", "c1");
  const alivePlayers = [
    player("p1", "portavoce", { alive: false }),
    player("c1", "custode"),
  ];
  assert.equal(
    Engine.validatePortavoceDesignation(alivePlayers, "p1", "c1").valid,
    true
  );
  assert.equal(
    Engine.getPortavoceBonusStatus(bonus, alivePlayers),
    "active"
  );

  const deadDesignated = alivePlayers.map((entry) =>
    entry.id === "c1" ? Object.assign({}, entry, { alive: false }) : entry
  );
  assert.equal(
    Engine.getPortavoceBonusStatus(bonus, deadDesignated),
    "lost"
  );
  assert.equal(
    Engine.validatePortavoceDesignation(
      deadDesignated,
      "p1",
      "c1"
    ).valid,
    false
  );
  assert.equal(
    Engine.consumePortavoceBonus(bonus, alivePlayers).status,
    "used"
  );
});

test("la notte richiede un solo bersaglio condiviso e vieta il fuoco amico", () => {
  const players = [
    player("s1", "sabotatore"),
    player("g1", "guastatore"),
    player("c1", "custode"),
  ];

  const missing = Engine.validateNightActions({
    players,
    actions: actionSet(""),
  });
  assert.equal(missing.valid, false);
  assert.ok(
    missing.errors.some(
      (error) => error.code === "SABOTAGE_TARGET_REQUIRED"
    )
  );

  const friendlyFire = Engine.validateNightActions({
    players,
    actions: actionSet("g1"),
  });
  assert.equal(friendlyFire.valid, false);
  assert.ok(
    friendlyFire.errors.some(
      (error) => error.code === "SABOTEUR_FRIENDLY_FIRE_FORBIDDEN"
    )
  );
});

test("un sabotaggio normale elimina il bersaglio e registra tutti i Sabotatori", () => {
  const players = [
    player("s1", "sabotatore"),
    player("g1", "guastatore"),
    player("c1", "custode"),
    player("c2", "custode"),
  ];
  const result = Engine.resolveNight({
    players,
    actions: actionSet("c1"),
  });

  assert.equal(result.victimId, "c1");
  assert.equal(result.sabotagePrevented, false);
  assert.equal(result.players.find((entry) => entry.id === "c1").alive, false);
  assert.ok(result.actedPlayerIds.includes("s1"));
  assert.ok(result.actedPlayerIds.includes("g1"));
  assert.equal(players.find((entry) => entry.id === "c1").alive, true);
});

test("il Tecnico agisce dopo la scelta e annulla il sabotaggio", () => {
  const players = [
    player("s1", "sabotatore"),
    player("t1", "tecnico"),
    player("c1", "custode"),
  ];
  const result = Engine.resolveNight({
    players,
    actions: actionSet("c1", {
      tecnico: { use: true },
    }),
  });

  assert.equal(result.victimId, null);
  assert.equal(result.sabotagePrevented, true);
  assert.equal(result.results.tecnico.status, "resolved");
  assert.equal(result.results.tecnico.preventedSabotage, true);
  assert.equal(
    result.players.find((entry) => entry.id === "t1").usesRemaining,
    0
  );
  assert.ok(result.actedPlayerIds.includes("t1"));
});

test("l'interferenza blocca Tecnico e indagini senza consumarne gli utilizzi", () => {
  const players = [
    player("s1", "sabotatore"),
    player("g1", "guastatore"),
    player("t1", "tecnico"),
    player("se1", "sentinella"),
    player("c1", "custode"),
  ];
  const result = Engine.resolveNight({
    players,
    actions: actionSet("c1", {
      guastatore: { use: true },
      tecnico: { use: true },
      sentinella: { use: true, targetId: "s1" },
    }),
  });

  assert.equal(result.interference, true);
  assert.equal(result.victimId, "c1");
  assert.equal(result.results.tecnico.status, "blocked");
  assert.equal(result.results.sentinella.status, "blocked");
  assert.equal(
    result.players.find((entry) => entry.id === "g1").usesRemaining,
    0
  );
  assert.equal(
    result.players.find((entry) => entry.id === "t1").usesRemaining,
    1
  );
  assert.equal(
    result.players.find((entry) => entry.id === "se1").usesRemaining,
    1
  );
  assert.deepEqual(
    result.consumedUses.map((entry) => entry.roleId),
    ["guastatore"]
  );
});

test("Sentinella e Cartografa ricevono i risultati attesi", () => {
  const players = [
    player("s1", "sabotatore"),
    player("se1", "sentinella"),
    player("ca1", "cartografa"),
    player("n1", "naufrago"),
    player("c1", "custode"),
    player("c2", "custode"),
  ];
  const result = Engine.resolveNight({
    players,
    actions: actionSet("c2", {
      sentinella: { use: true, targetId: "n1" },
      cartografa: { use: true, targetIds: ["n1", "c1"] },
    }),
  });

  assert.equal(result.results.sentinella.alignment, Engine.FACTIONS.NEUTRALE);
  assert.equal(result.results.cartografa.sameFaction, false);
  assert.equal(
    result.players.find((entry) => entry.id === "se1").usesRemaining,
    0
  );
  assert.equal(
    result.players.find((entry) => entry.id === "ca1").usesRemaining,
    1
  );
});

test("la Cartografa riconosce due membri della stessa fazione", () => {
  const players = [
    player("s1", "sabotatore"),
    player("ca1", "cartografa"),
    player("c1", "custode"),
    player("se1", "sentinella"),
    player("c2", "custode"),
  ];
  const result = Engine.resolveNight({
    players,
    actions: actionSet("c2", {
      cartografa: { use: true, targetIds: ["c1", "se1"] },
    }),
  });

  assert.equal(result.results.cartografa.sameFaction, true);
});

test("la Vedetta rileva chi ha davvero compiuto un'azione", () => {
  const activePlayers = [
    player("s1", "sabotatore"),
    player("se1", "sentinella"),
    player("v1", "vedetta"),
    player("c1", "custode"),
    player("c2", "custode"),
  ];
  const seesInvestigator = Engine.resolveNight({
    players: activePlayers,
    actions: actionSet("c2", {
      sentinella: { use: true, targetId: "s1" },
      vedetta: { use: true, targetId: "se1" },
    }),
  });
  assert.equal(seesInvestigator.results.vedetta.acted, true);

  const seesIdleCustodian = Engine.resolveNight({
    players: activePlayers,
    actions: actionSet("c2", {
      vedetta: { use: true, targetId: "c1" },
    }),
  });
  assert.equal(seesIdleCustodian.results.vedetta.acted, false);
});

test("durante l'interferenza la Vedetta non riceve risultati", () => {
  const players = [
    player("s1", "sabotatore"),
    player("g1", "guastatore"),
    player("v1", "vedetta"),
    player("c1", "custode"),
    player("c2", "custode"),
  ];
  const result = Engine.resolveNight({
    players,
    actions: actionSet("c2", {
      guastatore: { use: true },
      vedetta: { use: true, targetId: "s1" },
    }),
  });

  assert.deepEqual(result.results.vedetta, {
    status: "blocked",
    playerId: "v1",
  });
  assert.equal(
    result.players.find((entry) => entry.id === "v1").usesRemaining,
    2
  );
});

test("Sentinella e Vedetta non possono scegliere se stesse", () => {
  const players = [
    player("s1", "sabotatore"),
    player("se1", "sentinella"),
    player("v1", "vedetta"),
    player("c1", "custode"),
  ];

  const validation = Engine.validateNightActions({
    players,
    actions: actionSet("c1", {
      sentinella: { use: true, targetId: "se1" },
      vedetta: { use: true, targetId: "v1" },
    }),
  });

  assert.equal(validation.valid, false);
  assert.equal(
    validation.errors.filter(
      (error) => error.code === "SELF_TARGET_FORBIDDEN"
    ).length,
    2
  );
});

test("la Cartografa richiede due bersagli vivi, distinti e diversi da sé", () => {
  const players = [
    player("s1", "sabotatore"),
    player("ca1", "cartografa"),
    player("c1", "custode"),
    player("c2", "custode", { alive: false }),
  ];
  const validation = Engine.validateNightActions({
    players,
    actions: actionSet("c1", {
      cartografa: { use: true, targetIds: ["ca1", "c2"] },
    }),
  });

  assert.equal(validation.valid, false);
  assert.ok(
    validation.errors.some(
      (error) => error.code === "SELF_TARGET_FORBIDDEN"
    )
  );
  assert.ok(
    validation.errors.some((error) => error.code === "TARGET_NOT_ALIVE")
  );
});

test("il Portavoce colpito di notte attiva il proprio flusso prima della vittoria", () => {
  const result = Engine.resolveNight({
    players: [
      player("s1", "sabotatore"),
      player("p1", "portavoce"),
      player("c1", "custode"),
    ],
    actions: actionSet("p1"),
  });

  assert.equal(result.victimId, "p1");
  assert.equal(result.portavoceTriggered, true);
  assert.equal(result.winCheckDeferred, true);
});

test("gli utilizzi esauriti vengono rifiutati", () => {
  const validation = Engine.validateNightActions({
    players: [
      player("s1", "sabotatore"),
      player("t1", "tecnico", { usesRemaining: 0 }),
      player("c1", "custode"),
    ],
    actions: actionSet("c1", {
      tecnico: { use: true },
    }),
  });

  assert.equal(validation.valid, false);
  assert.ok(
    validation.errors.some((error) => error.code === "POWER_EXHAUSTED")
  );
});

test("gli utilizzi fuori dall'intervallo del ruolo vengono rifiutati", () => {
  assert.throws(
    () =>
      Engine.checkWin([
        player("s1", "sabotatore"),
        player("t1", "tecnico", { usesRemaining: 2 }),
        player("c1", "custode"),
      ]),
    (error) =>
      error instanceof Engine.RuleError &&
      error.code === "INVALID_POWER_USES"
  );

  assert.throws(
    () =>
      Engine.checkWin([
        player("s1", "sabotatore"),
        player("v1", "vedetta", { usesRemaining: -1 }),
        player("c1", "custode"),
      ]),
    (error) =>
      error instanceof Engine.RuleError &&
      error.code === "INVALID_POWER_USES"
  );
});

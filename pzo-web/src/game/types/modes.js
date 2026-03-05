"use strict";
// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — pzo-web/src/game/types/modes.ts
// Sprint 8 — Full Rebuild
//
// CHANGES FROM SPRINT 0:
//   ✦ GameMode enum extended with engine-canonical values (GO_ALONE etc.)
//     Legacy union 'EMPIRE'|'PREDATOR'|'SYNDICATE'|'PHANTOM' preserved via
//     LegacyGameMode + LEGACY_TO_CANONICAL_MODE bridge.
//   ✦ ModeCapabilityMatrix: +13 missing fields (spectatorMode, holdSystem,
//     bluffCards, extractionCooldown, rivalryPersistent, syndicateDuel,
//     dynastyChallengeStack, phaseTransitionCards, pressureJournalML,
//     caseFileML, communityHeat, sharedDeckOwnership, cardTagWeightOverrides)
//   ✦ ADD RunPhase enum (FOUNDATION | ESCALATION | SOVEREIGNTY)
//   ✦ ADD ModeDisplayConfig — single source for UI labels / icons / colors
//   ✦ ADD ViralMoment — share-worthy game events
//   ✦ ADD ModeScaleConfig — 20M concurrent player infra constants
//   ✦ Fix LEGACY_MODE_MAP / CANONICAL_TO_LEGACY — complete bidirectional bridge
//
// RULES:
//   ✦ Zero imports — this file imports nothing.
//   ✦ Zero runtime logic — pure TypeScript declarations only.
//   ✦ All consuming engines / components import GameMode from here.
//
// Density6 LLC · Confidential · All Rights Reserved
// ═══════════════════════════════════════════════════════════════════════════
Object.defineProperty(exports, "__esModule", { value: true });
exports.MODE_SCALE = exports.MODE_DISPLAY = exports.MODE_CAPABILITIES = exports.DEFAULT_PHASE_BOUNDARIES = exports.RUN_PHASE_LABELS = exports.CANONICAL_TO_LEGACY = exports.LEGACY_MODE_MAP = exports.ALIAS_TO_CANONICAL = exports.CANONICAL_TO_ALIAS = exports.CANONICAL_TO_LEGACY_MODE = exports.LEGACY_TO_CANONICAL_MODE = void 0;
/** Maps legacy RunMode → canonical GameMode. */
exports.LEGACY_TO_CANONICAL_MODE = {
    'solo': 'GO_ALONE',
    'asymmetric-pvp': 'HEAD_TO_HEAD',
    'co-op': 'TEAM_UP',
    'ghost': 'CHASE_A_LEGEND',
};
/** Maps canonical GameMode → legacy RunMode. */
exports.CANONICAL_TO_LEGACY_MODE = {
    'GO_ALONE': 'solo',
    'HEAD_TO_HEAD': 'asymmetric-pvp',
    'TEAM_UP': 'co-op',
    'CHASE_A_LEGEND': 'ghost',
};
/** Maps canonical GameMode → short-form alias (for display and design tokens). */
exports.CANONICAL_TO_ALIAS = {
    'GO_ALONE': 'EMPIRE',
    'HEAD_TO_HEAD': 'PREDATOR',
    'TEAM_UP': 'SYNDICATE',
    'CHASE_A_LEGEND': 'PHANTOM',
};
/** Maps short-form alias → canonical GameMode. */
exports.ALIAS_TO_CANONICAL = {
    'EMPIRE': 'GO_ALONE',
    'PREDATOR': 'HEAD_TO_HEAD',
    'SYNDICATE': 'TEAM_UP',
    'PHANTOM': 'CHASE_A_LEGEND',
};
// ── Legacy alias (backward compat) ────────────────────────────────────────────
/** @deprecated Use LEGACY_TO_CANONICAL_MODE */
exports.LEGACY_MODE_MAP = exports.LEGACY_TO_CANONICAL_MODE;
/** @deprecated Use CANONICAL_TO_LEGACY_MODE */
exports.CANONICAL_TO_LEGACY = exports.CANONICAL_TO_LEGACY_MODE;
exports.RUN_PHASE_LABELS = {
    FOUNDATION: 'Foundation',
    ESCALATION: 'Escalation',
    SOVEREIGNTY: 'Sovereignty',
};
/** Tick index at which each phase begins (defaults from empireConfig.ts). */
exports.DEFAULT_PHASE_BOUNDARIES = {
    FOUNDATION: 0,
    ESCALATION: 240, // ~4 min at T1 (1200ms/tick)
    SOVEREIGNTY: 480, // ~8 min at T1
};
exports.MODE_CAPABILITIES = {
    GO_ALONE: {
        mode: 'GO_ALONE', label: 'Go Alone — Isolated Sovereign',
        // Empire
        isolationTax: true, bleedMode: true, holdSystem: true,
        pressureJournalML: true, caseFileML: true, phaseTransitionCards: true,
        // Predator
        sharedDeckOwnership: false, battleBudget: false, extractionCooldown: false,
        counterplayWindow: false, bluffCards: false, psycheMeter: false,
        rivalryPersistent: false, spectatorMode: false,
        // Syndicate
        sharedTreasury: false, trustScore: false, roleAssignment: false,
        defectionSequence: false, trustAudit: false, syndicateDuel: false,
        // Phantom
        ghostReplay: false, gapIndicator: false, legendDecay: false,
        dynastyChallengeStack: false, communityHeat: false,
        // Universal
        cardTagWeightOverrides: true,
    },
    HEAD_TO_HEAD: {
        mode: 'HEAD_TO_HEAD', label: 'Head-to-Head — Tempo Warfare',
        // Empire
        isolationTax: false, bleedMode: false, holdSystem: false,
        pressureJournalML: false, caseFileML: false, phaseTransitionCards: false,
        // Predator
        sharedDeckOwnership: true, battleBudget: true, extractionCooldown: true,
        counterplayWindow: true, bluffCards: true, psycheMeter: true,
        rivalryPersistent: true, spectatorMode: true,
        // Syndicate
        sharedTreasury: false, trustScore: false, roleAssignment: false,
        defectionSequence: false, trustAudit: false, syndicateDuel: false,
        // Phantom
        ghostReplay: false, gapIndicator: false, legendDecay: false,
        dynastyChallengeStack: false, communityHeat: false,
        // Universal
        cardTagWeightOverrides: true,
    },
    TEAM_UP: {
        mode: 'TEAM_UP', label: 'Team Up — Cooperative Contracts',
        // Empire
        isolationTax: false, bleedMode: false, holdSystem: false,
        pressureJournalML: false, caseFileML: false, phaseTransitionCards: false,
        // Predator
        sharedDeckOwnership: false, battleBudget: false, extractionCooldown: false,
        counterplayWindow: false, bluffCards: false, psycheMeter: false,
        rivalryPersistent: false, spectatorMode: false,
        // Syndicate
        sharedTreasury: true, trustScore: true, roleAssignment: true,
        defectionSequence: true, trustAudit: true, syndicateDuel: true,
        // Phantom
        ghostReplay: false, gapIndicator: false, legendDecay: false,
        dynastyChallengeStack: false, communityHeat: false,
        // Universal
        cardTagWeightOverrides: true,
    },
    CHASE_A_LEGEND: {
        mode: 'CHASE_A_LEGEND', label: 'Chase a Legend — Ghost Pressure',
        // Empire
        isolationTax: false, bleedMode: false, holdSystem: false,
        pressureJournalML: false, caseFileML: false, phaseTransitionCards: false,
        // Predator
        sharedDeckOwnership: false, battleBudget: false, extractionCooldown: false,
        counterplayWindow: false, bluffCards: false, psycheMeter: false,
        rivalryPersistent: false, spectatorMode: false,
        // Syndicate
        sharedTreasury: false, trustScore: false, roleAssignment: false,
        defectionSequence: false, trustAudit: false, syndicateDuel: false,
        // Phantom
        ghostReplay: true, gapIndicator: true, legendDecay: true,
        dynastyChallengeStack: true, communityHeat: true,
        // Universal
        cardTagWeightOverrides: true,
    },
};
exports.MODE_DISPLAY = {
    GO_ALONE: {
        alias: 'EMPIRE',
        label: 'Go Alone',
        tagline: 'The Isolated Sovereign',
        icon: '🏛️',
        accentColor: '#C9A84C', // gold — 5.6:1 on #0D0D1E
        accentDim: 'rgba(201,168,76,0.10)',
        accentBorder: 'rgba(201,168,76,0.28)',
        surface: '#0D0C02',
        textSub: '#C8A870', // 5.2:1 on surface
        minPlayers: 1,
        maxPlayers: 1,
    },
    HEAD_TO_HEAD: {
        alias: 'PREDATOR',
        label: 'Head to Head',
        tagline: 'The Financial Predator',
        icon: '⚔️',
        accentColor: '#FF4D4D', // red — 5.8:1 on #0D0D1E
        accentDim: 'rgba(255,77,77,0.10)',
        accentBorder: 'rgba(255,77,77,0.28)',
        surface: '#0D0005',
        textSub: '#C89090', // 5.4:1 on surface
        minPlayers: 2,
        maxPlayers: 2,
    },
    TEAM_UP: {
        alias: 'SYNDICATE',
        label: 'Team Up',
        tagline: 'The Trust Architect',
        icon: '🤝',
        accentColor: '#00C9A7', // teal — 6.1:1 on #0D0D1E
        accentDim: 'rgba(0,201,167,0.10)',
        accentBorder: 'rgba(0,201,167,0.28)',
        surface: '#020D0A',
        textSub: '#8ECEC7', // 5.8:1 on surface
        minPlayers: 2,
        maxPlayers: 4,
    },
    CHASE_A_LEGEND: {
        alias: 'PHANTOM',
        label: 'Chase a Legend',
        tagline: 'The Ghost Hunter',
        icon: '👻',
        accentColor: '#9B7DFF', // purple — 7.1:1 on #0D0D1E
        accentDim: 'rgba(155,125,255,0.10)',
        accentBorder: 'rgba(155,125,255,0.28)',
        surface: '#06020E',
        textSub: '#AB90D0', // 5.1:1 on surface
        minPlayers: 1,
        maxPlayers: 1,
    },
};
exports.MODE_SCALE = {
    GO_ALONE: {
        mode: 'GO_ALONE',
        maxRunsPerShardGroup: 50_000,
        shardGroupSize: 50_000,
        connectionTimeoutMs: 30_000,
        tickBudget: 900, // 720 standard + 180 bleed extension
        requiresMatchmaking: false,
        maxSpectators: 0,
    },
    HEAD_TO_HEAD: {
        mode: 'HEAD_TO_HEAD',
        maxRunsPerShardGroup: 25_000, // 2 players per run
        shardGroupSize: 50_000,
        connectionTimeoutMs: 15_000, // tighter — opponent is waiting
        tickBudget: 720,
        requiresMatchmaking: true,
        maxSpectators: 50,
    },
    TEAM_UP: {
        mode: 'TEAM_UP',
        maxRunsPerShardGroup: 12_500, // 4 players per run
        shardGroupSize: 50_000,
        connectionTimeoutMs: 20_000,
        tickBudget: 720,
        requiresMatchmaking: true,
        maxSpectators: 0,
    },
    CHASE_A_LEGEND: {
        mode: 'CHASE_A_LEGEND',
        maxRunsPerShardGroup: 50_000,
        shardGroupSize: 50_000,
        connectionTimeoutMs: 30_000,
        tickBudget: 720,
        requiresMatchmaking: false,
        maxSpectators: 0,
    },
};
//# sourceMappingURL=modes.js.map
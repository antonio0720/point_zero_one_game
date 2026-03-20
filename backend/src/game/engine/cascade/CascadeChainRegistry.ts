/*
 * POINT ZERO ONE — BACKEND CASCADE REGISTRY
 * /backend/src/game/engine/cascade/CascadeChainRegistry.ts
 *
 * Doctrine:
 * - every cascade template is explicit, deterministic, and replay-safe
 * - backend owns cascade semantics, pacing, and recovery truth
 * - registry metadata must be rich enough to support current runtime behavior
 *   without forcing CascadeEngine to infer design intent from UI assumptions
 * - additive helper methods are preferred so adjacent runtime modules can grow
 *   into richer orchestration without breaking the existing authority path
 * - templates must stay aligned with shield-layer semantics, mode doctrine,
 *   pressure cadence, and the current backend effect surface
 */

import type {
  ModeCode,
  PressureTier,
  ShieldLayerId,
} from '../core/GamePrimitives';
import type {
  CascadeSeverity,
  CascadeTemplate,
  CascadeTemplateId,
} from './types';

const ALL_TEMPLATE_IDS = [
  'LIQUIDITY_SPIRAL',
  'CREDIT_FREEZE',
  'INCOME_SHOCK',
  'NETWORK_LOCKDOWN',
  'COMEBACK_SURGE',
  'MOMENTUM_ENGINE',
] as const satisfies readonly CascadeTemplateId[];

const NEGATIVE_TEMPLATE_IDS = [
  'LIQUIDITY_SPIRAL',
  'CREDIT_FREEZE',
  'INCOME_SHOCK',
  'NETWORK_LOCKDOWN',
] as const satisfies readonly CascadeTemplateId[];

const POSITIVE_TEMPLATE_IDS = [
  'COMEBACK_SURGE',
  'MOMENTUM_ENGINE',
] as const satisfies readonly CascadeTemplateId[];

const ALL_PRESSURE_TIERS = ['T0', 'T1', 'T2', 'T3', 'T4'] as const satisfies readonly PressureTier[];
const ALL_MODE_CODES = ['solo', 'pvp', 'coop', 'ghost'] as const satisfies readonly ModeCode[];
const ALL_SHIELD_LAYERS = ['L1', 'L2', 'L3', 'L4'] as const satisfies readonly ShieldLayerId[];
const ALL_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const satisfies readonly CascadeSeverity[];

type CascadeCatalog = Readonly<Record<CascadeTemplateId, CascadeTemplate>>;
type LayerTemplateMap = Readonly<Record<ShieldLayerId, CascadeTemplateId>>;
type SeverityTemplateMap = Readonly<Record<CascadeSeverity, readonly CascadeTemplateId[]>>;
type PressureTemplateMap = Readonly<Record<PressureTier, readonly CascadeTemplateId[]>>;
type ModeTemplateMap = Readonly<Record<ModeCode, readonly CascadeTemplateId[]>>;

function freezeReadonlyArray<T>(value: readonly T[]): readonly T[] {
  return Object.freeze([...value]);
}

function freezeReadonlyRecord<T extends Record<string, unknown>>(value: T): Readonly<T> {
  return Object.freeze({ ...value });
}

function freezeTemplate<T extends CascadeTemplate>(template: T): T {
  return Object.freeze({
    ...template,
    baseOffsets: freezeReadonlyArray(template.baseOffsets),
    effects: freezeReadonlyArray(
      template.effects.map((effect) =>
        Object.freeze({
          ...effect,
          injectCards: effect.injectCards ? freezeReadonlyArray(effect.injectCards) : undefined,
          exhaustCards: effect.exhaustCards ? freezeReadonlyArray(effect.exhaustCards) : undefined,
          grantBadges: effect.grantBadges ? freezeReadonlyArray(effect.grantBadges) : undefined,
        }),
      ),
    ),
    recoveryTags: freezeReadonlyArray(template.recoveryTags),
    recovery: freezeReadonlyArray(
      template.recovery.map((condition) => {
        if ('tags' in condition) {
          return Object.freeze({
            ...condition,
            tags: freezeReadonlyArray(condition.tags),
          });
        }
        return Object.freeze({ ...condition });
      }),
    ),
    modeOffsetModifier: template.modeOffsetModifier
      ? freezeReadonlyRecord(template.modeOffsetModifier)
      : undefined,
    pressureScalar: template.pressureScalar
      ? freezeReadonlyRecord(template.pressureScalar)
      : undefined,
    notes: template.notes ? freezeReadonlyArray(template.notes) : undefined,
  }) as T;
}

function definePressureScalar(
  T0: number,
  T1: number,
  T2: number,
  T3: number,
  T4: number,
): Readonly<Record<PressureTier, number>> {
  return Object.freeze({ T0, T1, T2, T3, T4 });
}

function defineModeOffsets(
  offsets: Partial<Record<ModeCode, number>>,
): Partial<Record<ModeCode, number>> {
  return Object.freeze({ ...offsets });
}

function defineLayerTemplateMap(): LayerTemplateMap {
  return Object.freeze({
    L1: 'LIQUIDITY_SPIRAL',
    L2: 'CREDIT_FREEZE',
    L3: 'INCOME_SHOCK',
    L4: 'NETWORK_LOCKDOWN',
  });
}

function buildSeverityIndex(catalog: CascadeCatalog): SeverityTemplateMap {
  const map: Record<CascadeSeverity, CascadeTemplateId[]> = {
    LOW: [],
    MEDIUM: [],
    HIGH: [],
    CRITICAL: [],
  };

  for (const templateId of ALL_TEMPLATE_IDS) {
    map[catalog[templateId].severity].push(templateId);
  }

  return Object.freeze({
    LOW: freezeReadonlyArray(map.LOW),
    MEDIUM: freezeReadonlyArray(map.MEDIUM),
    HIGH: freezeReadonlyArray(map.HIGH),
    CRITICAL: freezeReadonlyArray(map.CRITICAL),
  });
}

function buildPressureIndex(catalog: CascadeCatalog): PressureTemplateMap {
  const map: Record<PressureTier, CascadeTemplateId[]> = {
    T0: [],
    T1: [],
    T2: [],
    T3: [],
    T4: [],
  };

  for (const templateId of ALL_TEMPLATE_IDS) {
    const template = catalog[templateId];
    for (const tier of ALL_PRESSURE_TIERS) {
      if ((template.pressureScalar?.[tier] ?? 1) > 1) {
        map[tier].push(templateId);
      }
    }
  }

  return Object.freeze({
    T0: freezeReadonlyArray(map.T0),
    T1: freezeReadonlyArray(map.T1),
    T2: freezeReadonlyArray(map.T2),
    T3: freezeReadonlyArray(map.T3),
    T4: freezeReadonlyArray(map.T4),
  });
}

function buildModeIndex(catalog: CascadeCatalog): ModeTemplateMap {
  const map: Record<ModeCode, CascadeTemplateId[]> = {
    solo: [],
    pvp: [],
    coop: [],
    ghost: [],
  };

  for (const templateId of ALL_TEMPLATE_IDS) {
    const template = catalog[templateId];
    for (const mode of ALL_MODE_CODES) {
      if ((template.modeOffsetModifier?.[mode] ?? 0) !== 0) {
        map[mode].push(templateId);
      }
    }
  }

  return Object.freeze({
    solo: freezeReadonlyArray(map.solo),
    pvp: freezeReadonlyArray(map.pvp),
    coop: freezeReadonlyArray(map.coop),
    ghost: freezeReadonlyArray(map.ghost),
  });
}

function buildCatalog(): CascadeCatalog {
  const catalog = {
    LIQUIDITY_SPIRAL: freezeTemplate({
      templateId: 'LIQUIDITY_SPIRAL',
      label: 'Liquidity Spiral',
      positive: false,
      severity: 'HIGH',
      dedupeKey: 'shield:L1',
      maxConcurrent: 2,
      maxTriggersPerRun: 4,
      baseOffsets: [1, 2, 4, 6],
      effects: [
        { cashDelta: -350, heatDelta: 1, cascadeTag: 'liquidity' },
        { cashDelta: -700, heatDelta: 1, shieldDelta: -1, cascadeTag: 'liquidity' },
        { cashDelta: -1150, heatDelta: 2, timeDeltaMs: 200, cascadeTag: 'resilience' },
        {
          cashDelta: -1650,
          heatDelta: 3,
          shieldDelta: -2,
          divergenceDelta: 1,
          cascadeTag: 'liquidity',
        },
      ],
      recoveryTags: ['liquidity', 'resilience', 'aid', 'cash_reserve'],
      recovery: [
        { kind: 'CARD_TAG_ANY', tags: ['liquidity', 'resilience', 'aid'] },
        { kind: 'LAST_PLAYED_TAG_ANY', tags: ['liquidity', 'cash_reserve'] },
        { kind: 'CASH_MIN', amount: 2500 },
      ],
      modeOffsetModifier: defineModeOffsets({ ghost: 1, solo: 0, pvp: 0, coop: -1 }),
      pressureScalar: definePressureScalar(0.90, 1.00, 1.10, 1.22, 1.36),
      notes: [
        'L1-native negative chain that converts cash weakness into escalating liquidity compression.',
        'Designed to feel survivable early, then punitive if left unaddressed past the mid-run.',
        'Co-op rescue posture slightly slows the chain because syndicate recovery should matter.',
        'Ghost pressure accelerates the chain to reflect deterministic precision punishment.',
      ],
    }),

    CREDIT_FREEZE: freezeTemplate({
      templateId: 'CREDIT_FREEZE',
      label: 'Credit Freeze',
      positive: false,
      severity: 'HIGH',
      dedupeKey: 'shield:L2',
      maxConcurrent: 2,
      maxTriggersPerRun: 3,
      baseOffsets: [1, 3, 5],
      effects: [
        { shieldDelta: -3, heatDelta: 1, cascadeTag: 'credit' },
        { shieldDelta: -5, heatDelta: 1, timeDeltaMs: 250, cascadeTag: 'compliance' },
        {
          shieldDelta: -6,
          heatDelta: 2,
          trustDelta: -2,
          divergenceDelta: 1,
          cascadeTag: 'evidence',
        },
      ],
      recoveryTags: ['credit', 'compliance', 'evidence', 'counter'],
      recovery: [
        { kind: 'CARD_TAG_ANY', tags: ['credit', 'compliance', 'evidence'] },
        { kind: 'LAST_PLAYED_TAG_ANY', tags: ['counter', 'evidence'] },
        { kind: 'WEAKEST_SHIELD_RATIO_MIN', ratio: 0.55 },
      ],
      modeOffsetModifier: defineModeOffsets({ pvp: 1, ghost: 0, solo: 0, coop: -1 }),
      pressureScalar: definePressureScalar(0.92, 1.00, 1.12, 1.26, 1.40),
      notes: [
        'L2-native chain that turns shield instability into persistent credit compression.',
        'PvP accelerates because lock-and-counter tempo is one of the mode’s central identities.',
        'Trust-supported cooperative runs are allowed a modest pacing discount here.',
      ],
    }),

    INCOME_SHOCK: freezeTemplate({
      templateId: 'INCOME_SHOCK',
      label: 'Income Shock',
      positive: false,
      severity: 'CRITICAL',
      dedupeKey: 'shield:L3',
      maxConcurrent: 2,
      maxTriggersPerRun: 3,
      baseOffsets: [1, 2, 4, 6],
      effects: [
        { incomeDelta: -80, cashDelta: -250, cascadeTag: 'income' },
        { incomeDelta: -110, cashDelta: -375, heatDelta: 1, cascadeTag: 'income' },
        { incomeDelta: -145, cashDelta: -550, trustDelta: -1, cascadeTag: 'aid' },
        {
          incomeDelta: -180,
          cashDelta: -800,
          heatDelta: 1,
          divergenceDelta: 2,
          cascadeTag: 'rescue',
        },
      ],
      recoveryTags: ['income', 'aid', 'rescue', 'ipa'],
      recovery: [
        { kind: 'CARD_TAG_ANY', tags: ['income', 'aid', 'rescue'] },
        { kind: 'LAST_PLAYED_TAG_ANY', tags: ['ipa', 'income'] },
        { kind: 'CASH_MIN', amount: 3000 },
        { kind: 'PRESSURE_NOT_ABOVE', tier: 'T2' },
      ],
      modeOffsetModifier: defineModeOffsets({ solo: 0, pvp: 1, coop: -1, ghost: 1 }),
      pressureScalar: definePressureScalar(0.85, 1.00, 1.15, 1.30, 1.46),
      notes: [
        'L3-native chain that attacks cashflow stability rather than only immediate shield integrity.',
        'This is the most economy-punishing negative chain in the current authoritative catalog.',
        'Co-op gets slight relief because rescue and trust should have a real backend signature.',
        'Ghost and PvP both intensify timing punishment because deterministic execution matters more there.',
      ],
    }),

    NETWORK_LOCKDOWN: freezeTemplate({
      templateId: 'NETWORK_LOCKDOWN',
      label: 'Network Lockdown',
      positive: false,
      severity: 'CRITICAL',
      dedupeKey: 'shield:L4',
      maxConcurrent: 1,
      maxTriggersPerRun: 2,
      baseOffsets: [1, 3, 5],
      effects: [
        { shieldDelta: -4, heatDelta: 2, cascadeTag: 'network' },
        {
          shieldDelta: -6,
          heatDelta: 2,
          cashDelta: -200,
          trustDelta: -2,
          cascadeTag: 'trust',
        },
        {
          shieldDelta: -7,
          heatDelta: 3,
          timeDeltaMs: 350,
          divergenceDelta: 2,
          injectCards: ['NETWORK_AUDIT_ALERT'],
          cascadeTag: 'signal_clear',
        },
      ],
      recoveryTags: ['network', 'trust', 'signal_clear', 'discipline'],
      recovery: [
        { kind: 'CARD_TAG_ANY', tags: ['network', 'trust', 'signal_clear'] },
        { kind: 'LAST_PLAYED_TAG_ANY', tags: ['discipline', 'network'] },
        { kind: 'TRUST_ANY_MIN', score: 80 },
        { kind: 'ALL_SHIELDS_RATIO_MIN', ratio: 0.45 },
      ],
      modeOffsetModifier: defineModeOffsets({ coop: -1, ghost: 1, solo: 0, pvp: 0 }),
      pressureScalar: definePressureScalar(1.00, 1.05, 1.15, 1.32, 1.50),
      notes: [
        'L4-native systemic chain intended to feel like the run’s trust and signal backbone is compromised.',
        'The chain remains capped at one active instance because repeated L4 pressure should be terrifying but legible.',
        'Co-op trust architecture can blunt this earlier; Ghost runs should feel markedly more predatory.',
      ],
    }),

    COMEBACK_SURGE: freezeTemplate({
      templateId: 'COMEBACK_SURGE',
      label: 'Comeback Surge',
      positive: true,
      severity: 'MEDIUM',
      dedupeKey: 'positive:comeback',
      maxConcurrent: 1,
      maxTriggersPerRun: 1,
      baseOffsets: [0, 1, 2, 3],
      effects: [
        { shieldDelta: 2, cashDelta: 125, heatDelta: -1, cascadeTag: 'recovery' },
        { shieldDelta: 2, cashDelta: 175, heatDelta: -1, cascadeTag: 'recovery' },
        { shieldDelta: 3, cashDelta: 250, trustDelta: 1, cascadeTag: 'resilience' },
        { shieldDelta: 3, cashDelta: 325, divergenceDelta: -1, cascadeTag: 'recovery' },
      ],
      recoveryTags: [],
      recovery: [],
      modeOffsetModifier: defineModeOffsets({ solo: 0, pvp: 0, coop: 0, ghost: 0 }),
      pressureScalar: definePressureScalar(1.00, 1.00, 1.00, 1.10, 1.16),
      notes: [
        'Positive one-shot rebound chain unlocked from durable recovery conditions.',
        'Intended to reward stabilization under pressure rather than early-run comfort.',
        'All mode offsets remain neutral because the unlock gate already handles posture differences.',
      ],
    }),

    MOMENTUM_ENGINE: freezeTemplate({
      templateId: 'MOMENTUM_ENGINE',
      label: 'Momentum Engine',
      positive: true,
      severity: 'LOW',
      dedupeKey: 'positive:momentum',
      maxConcurrent: 1,
      maxTriggersPerRun: 1,
      baseOffsets: [0, 2, 4, 6],
      effects: [
        { incomeDelta: 50, cashDelta: 75, cascadeTag: 'momentum' },
        { incomeDelta: 65, cashDelta: 125, heatDelta: -1, cascadeTag: 'momentum' },
        { incomeDelta: 80, cashDelta: 175, trustDelta: 1, cascadeTag: 'momentum' },
        { incomeDelta: 95, cashDelta: 225, divergenceDelta: -1, cascadeTag: 'compound' },
      ],
      recoveryTags: [],
      recovery: [],
      modeOffsetModifier: defineModeOffsets({ solo: 0, pvp: 0, coop: 0, ghost: 0 }),
      pressureScalar: definePressureScalar(1.00, 1.00, 1.00, 1.00, 1.00),
      notes: [
        'Positive flywheel chain that converts clean fundamentals into a backend-owned acceleration pattern.',
        'Deliberately mild on each individual tick so the chain feels earned rather than random.',
      ],
    }),
  } satisfies Record<CascadeTemplateId, CascadeTemplate>;

  return Object.freeze(catalog);
}

export class CascadeChainRegistry {
  private readonly templates: CascadeCatalog;
  private readonly layerTemplateMap: LayerTemplateMap;
  private readonly severityIndex: SeverityTemplateMap;
  private readonly pressureAmplifiedIndex: PressureTemplateMap;
  private readonly modeShiftedIndex: ModeTemplateMap;

  public constructor() {
    this.templates = buildCatalog();
    this.layerTemplateMap = defineLayerTemplateMap();
    this.severityIndex = buildSeverityIndex(this.templates);
    this.pressureAmplifiedIndex = buildPressureIndex(this.templates);
    this.modeShiftedIndex = buildModeIndex(this.templates);

    this.validateCatalog();
  }

  public get(templateId: CascadeTemplateId | string): CascadeTemplate {
    const template = this.templates[templateId as CascadeTemplateId];
    if (!template) {
      throw new Error(`Unknown cascade template: ${templateId}`);
    }
    return template;
  }

  public tryGet(templateId: CascadeTemplateId | string): CascadeTemplate | null {
    return this.templates[templateId as CascadeTemplateId] ?? null;
  }

  public has(templateId: CascadeTemplateId | string): boolean {
    return this.tryGet(templateId) !== null;
  }

  public forLayer(layerId: ShieldLayerId): CascadeTemplateId {
    const templateId = this.layerTemplateMap[layerId];
    if (!templateId) {
      throw new Error(`Unsupported shield layer for cascade mapping: ${String(layerId)}`);
    }
    return templateId;
  }

  public isLayerBoundTemplate(templateId: CascadeTemplateId | string): boolean {
    if (!this.has(templateId)) {
      return false;
    }
    return (NEGATIVE_TEMPLATE_IDS as readonly CascadeTemplateId[]).includes(templateId as CascadeTemplateId);
  }

  public isPositiveTemplate(templateId: CascadeTemplateId | string): boolean {
    const template = this.tryGet(templateId);
    return template?.positive ?? false;
  }

  public isNegativeTemplate(templateId: CascadeTemplateId | string): boolean {
    const template = this.tryGet(templateId);
    return template ? !template.positive : false;
  }

  public listTemplateIds(): readonly CascadeTemplateId[] {
    return ALL_TEMPLATE_IDS;
  }

  public listPositiveTemplateIds(): readonly CascadeTemplateId[] {
    return POSITIVE_TEMPLATE_IDS;
  }

  public listNegativeTemplateIds(): readonly CascadeTemplateId[] {
    return NEGATIVE_TEMPLATE_IDS;
  }

  public listBySeverity(severity: CascadeSeverity): readonly CascadeTemplateId[] {
    return this.severityIndex[severity];
  }

  public listPressureAmplifiedAtTier(tier: PressureTier): readonly CascadeTemplateId[] {
    return this.pressureAmplifiedIndex[tier];
  }

  public listModeShiftedTemplates(mode: ModeCode): readonly CascadeTemplateId[] {
    return this.modeShiftedIndex[mode];
  }

  public getModeOffset(templateId: CascadeTemplateId | string, mode: ModeCode): number {
    return this.get(templateId).modeOffsetModifier?.[mode] ?? 0;
  }

  public getPressureScalar(templateId: CascadeTemplateId | string, tier: PressureTier): number {
    return this.get(templateId).pressureScalar?.[tier] ?? 1;
  }

  public getDedupeKey(templateId: CascadeTemplateId | string): string {
    return this.get(templateId).dedupeKey;
  }

  public listTemplates(): readonly CascadeTemplate[] {
    return ALL_TEMPLATE_IDS.map((templateId) => this.templates[templateId]);
  }


  public listTemplatesForModeAndPressure(
    mode: ModeCode,
    tier: PressureTier,
  ): readonly CascadeTemplateId[] {
    const modeShifted = new Set(this.modeShiftedIndex[mode]);
    const pressureAmplified = new Set(this.pressureAmplifiedIndex[tier]);
    const ordered: CascadeTemplateId[] = [];

    for (const templateId of ALL_TEMPLATE_IDS) {
      if (modeShifted.has(templateId) || pressureAmplified.has(templateId)) {
        ordered.push(templateId);
      }
    }

    return freezeReadonlyArray(ordered);
  }

  public getPositiveCatalog(): Readonly<Record<CascadeTemplateId, CascadeTemplate>> {
    const catalog = {} as Record<CascadeTemplateId, CascadeTemplate>;
    for (const templateId of POSITIVE_TEMPLATE_IDS) {
      catalog[templateId] = this.templates[templateId];
    }
    return Object.freeze(catalog);
  }

  public getNegativeCatalog(): Readonly<Record<CascadeTemplateId, CascadeTemplate>> {
    const catalog = {} as Record<CascadeTemplateId, CascadeTemplate>;
    for (const templateId of NEGATIVE_TEMPLATE_IDS) {
      catalog[templateId] = this.templates[templateId];
    }
    return Object.freeze(catalog);
  }

  public getRecoveryTagUniverse(): readonly string[] {
    const tags = new Set<string>();

    for (const template of this.listTemplates()) {
      for (const tag of template.recoveryTags) {
        tags.add(tag);
      }
      for (const condition of template.recovery) {
        if ('tags' in condition) {
          for (const tag of condition.tags) {
            tags.add(tag);
          }
        }
      }
    }

    return freezeReadonlyArray([...tags].sort());
  }

  public getCascadeTagUniverse(): readonly string[] {
    const tags = new Set<string>();

    for (const template of this.listTemplates()) {
      for (const effect of template.effects) {
        if (effect.cascadeTag) {
          tags.add(effect.cascadeTag);
        }
      }
    }

    return freezeReadonlyArray([...tags].sort());
  }

  public getCatalogSnapshot(): Readonly<{
    templates: Readonly<Record<CascadeTemplateId, CascadeTemplate>>;
    byLayer: Readonly<Record<ShieldLayerId, CascadeTemplateId>>;
    bySeverity: Readonly<Record<CascadeSeverity, readonly CascadeTemplateId[]>>;
    pressureAmplified: Readonly<Record<PressureTier, readonly CascadeTemplateId[]>>;
    modeShifted: Readonly<Record<ModeCode, readonly CascadeTemplateId[]>>;
  }> {
    return Object.freeze({
      templates: this.templates,
      byLayer: this.layerTemplateMap,
      bySeverity: this.severityIndex,
      pressureAmplified: this.pressureAmplifiedIndex,
      modeShifted: this.modeShiftedIndex,
    });
  }

  public describe(templateId: CascadeTemplateId | string): Readonly<{
    templateId: CascadeTemplateId;
    label: string;
    positive: boolean;
    severity: CascadeSeverity;
    layerAffinity: ShieldLayerId | null;
    maxConcurrent: number;
    maxTriggersPerRun: number;
    recoveryKinds: readonly string[];
    pressureAmplifiedTiers: readonly PressureTier[];
    modeShiftedModes: readonly ModeCode[];
  }> {
    const template = this.get(templateId);
    const layerAffinity = this.resolveLayerAffinity(template.templateId);

    return Object.freeze({
      templateId: template.templateId,
      label: template.label,
      positive: template.positive,
      severity: template.severity,
      layerAffinity,
      maxConcurrent: template.maxConcurrent,
      maxTriggersPerRun: template.maxTriggersPerRun,
      recoveryKinds: freezeReadonlyArray(template.recovery.map((condition) => condition.kind)),
      pressureAmplifiedTiers: freezeReadonlyArray(
        ALL_PRESSURE_TIERS.filter((tier) => (template.pressureScalar?.[tier] ?? 1) > 1),
      ),
      modeShiftedModes: freezeReadonlyArray(
        ALL_MODE_CODES.filter((mode) => (template.modeOffsetModifier?.[mode] ?? 0) !== 0),
      ),
    });
  }

  public getStrongestPressureTier(templateId: CascadeTemplateId | string): PressureTier {
    const template = this.get(templateId);
    let bestTier: PressureTier = 'T0';
    let bestScalar = template.pressureScalar?.T0 ?? 1;

    for (const tier of ALL_PRESSURE_TIERS) {
      const scalar = template.pressureScalar?.[tier] ?? 1;
      if (scalar > bestScalar) {
        bestScalar = scalar;
        bestTier = tier;
      }
    }

    return bestTier;
  }

  public getMostAcceleratedMode(templateId: CascadeTemplateId | string): ModeCode | null {
    const template = this.get(templateId);
    let bestMode: ModeCode | null = null;
    let bestDelta = 0;

    for (const mode of ALL_MODE_CODES) {
      const delta = template.modeOffsetModifier?.[mode] ?? 0;
      if (delta > bestDelta) {
        bestDelta = delta;
        bestMode = mode;
      }
    }

    return bestMode;
  }

  private resolveLayerAffinity(templateId: CascadeTemplateId): ShieldLayerId | null {
    for (const layerId of ALL_SHIELD_LAYERS) {
      if (this.layerTemplateMap[layerId] === templateId) {
        return layerId;
      }
    }
    return null;
  }

  private validateCatalog(): void {
    const seenDedupeKeys = new Set<string>();

    for (const templateId of ALL_TEMPLATE_IDS) {
      const template = this.templates[templateId];

      if (template.templateId !== templateId) {
        throw new Error(
          `Cascade template key mismatch: registry key ${templateId} !== template.templateId ${template.templateId}`,
        );
      }

      if (!template.label.trim()) {
        throw new Error(`Cascade template ${templateId} is missing a non-empty label.`);
      }

      if (template.maxConcurrent <= 0) {
        throw new Error(`Cascade template ${templateId} must have maxConcurrent > 0.`);
      }

      if (template.maxTriggersPerRun <= 0) {
        throw new Error(`Cascade template ${templateId} must have maxTriggersPerRun > 0.`);
      }

      if (template.baseOffsets.length === 0) {
        throw new Error(`Cascade template ${templateId} must define at least one scheduled offset.`);
      }

      if (template.baseOffsets.length !== template.effects.length) {
        throw new Error(
          `Cascade template ${templateId} has ${template.baseOffsets.length} offsets but ${template.effects.length} effects.`,
        );
      }

      for (let index = 0; index < template.baseOffsets.length; index += 1) {
        const offset = template.baseOffsets[index];
        if (!Number.isInteger(offset) || offset < 0) {
          throw new Error(
            `Cascade template ${templateId} has invalid base offset at index ${index}: ${String(offset)}.`,
          );
        }

        if (index > 0 && offset < template.baseOffsets[index - 1]) {
          throw new Error(
            `Cascade template ${templateId} offsets must be non-decreasing for deterministic scheduling.`,
          );
        }
      }

      if (!template.dedupeKey.trim()) {
        throw new Error(`Cascade template ${templateId} is missing a dedupe key.`);
      }

      if (seenDedupeKeys.has(template.dedupeKey)) {
        throw new Error(
          `Cascade template ${templateId} reuses dedupe key ${template.dedupeKey}; dedupe keys must be unique.`,
        );
      }
      seenDedupeKeys.add(template.dedupeKey);

      if (template.positive && template.recovery.length > 0) {
        throw new Error(
          `Positive cascade template ${templateId} must not declare recovery conditions in the current backend model.`,
        );
      }

      if (template.positive && template.recoveryTags.length > 0) {
        throw new Error(
          `Positive cascade template ${templateId} must not declare recoveryTags in the current backend model.`,
        );
      }

      if (!template.positive && template.recovery.length === 0 && template.recoveryTags.length === 0) {
        throw new Error(
          `Negative cascade template ${templateId} must declare structured recovery or legacy recovery tags.`,
        );
      }

      if (template.modeOffsetModifier) {
        for (const mode of Object.keys(template.modeOffsetModifier)) {
          if (!ALL_MODE_CODES.includes(mode as ModeCode)) {
            throw new Error(`Cascade template ${templateId} declares unsupported mode offset key: ${mode}.`);
          }
        }
      }

      if (template.pressureScalar) {
        for (const tier of Object.keys(template.pressureScalar)) {
          if (!ALL_PRESSURE_TIERS.includes(tier as PressureTier)) {
            throw new Error(
              `Cascade template ${templateId} declares unsupported pressure scalar key: ${tier}.`,
            );
          }
        }
      }

      const effectlessTemplate = template.effects.every((effect) => this.isEffectEmpty(effect));
      if (effectlessTemplate) {
        throw new Error(`Cascade template ${templateId} must produce at least one meaningful effect.`);
      }

      for (const [index, effect] of template.effects.entries()) {
        if (this.isEffectEmpty(effect)) {
          throw new Error(`Cascade template ${templateId} has an empty effect payload at index ${index}.`);
        }
      }
    }

    for (const layerId of ALL_SHIELD_LAYERS) {
      const templateId = this.layerTemplateMap[layerId];
      if (!templateId) {
        throw new Error(`Layer template map is missing a cascade template for ${layerId}.`);
      }
      if (!(NEGATIVE_TEMPLATE_IDS as readonly CascadeTemplateId[]).includes(templateId)) {
        throw new Error(`Layer ${layerId} must map to a negative cascade template; received ${templateId}.`);
      }
    }

    for (const severity of ALL_SEVERITIES) {
      if (!this.severityIndex[severity]) {
        throw new Error(`Severity index is missing severity bucket ${severity}.`);
      }
    }

    for (const tier of ALL_PRESSURE_TIERS) {
      if (!this.pressureAmplifiedIndex[tier]) {
        throw new Error(`Pressure amplification index is missing tier bucket ${tier}.`);
      }
    }

    for (const mode of ALL_MODE_CODES) {
      if (!this.modeShiftedIndex[mode]) {
        throw new Error(`Mode-shifted index is missing mode bucket ${mode}.`);
      }
    }
  }

  private isEffectEmpty(effect: CascadeTemplate['effects'][number]): boolean {
    const numericFields: Array<number | undefined> = [
      effect.cashDelta,
      effect.debtDelta,
      effect.incomeDelta,
      effect.expenseDelta,
      effect.shieldDelta,
      effect.heatDelta,
      effect.trustDelta,
      effect.treasuryDelta,
      effect.battleBudgetDelta,
      effect.holdChargeDelta,
      effect.counterIntelDelta,
      effect.timeDeltaMs,
      effect.divergenceDelta,
    ];

    const hasNumericSignal = numericFields.some((value) => value !== undefined && value !== 0);
    const hasCardSignal = Boolean(
      effect.injectCards?.length || effect.exhaustCards?.length || effect.grantBadges?.length,
    );
    const hasNamedAction = Boolean(effect.namedActionId);
    const hasTag = Boolean(effect.cascadeTag);

    return !(hasNumericSignal || hasCardSignal || hasNamedAction || hasTag);
  }
}

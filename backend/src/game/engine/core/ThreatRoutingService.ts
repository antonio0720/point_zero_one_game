/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/core/ThreatRoutingService.ts
 *
 * Doctrine:
 * - threat routing is deterministic and mode-aware
 * - tension surfaces become battle attacks only through backend routing
 * - routing must respect disabled bots, counter-intel, and mode targeting
 * - no global mutable state; all outputs are derived from the input snapshot
 * - routing must be cheap enough to run every tick
 */

import type {
  AttackCategory,
  AttackEvent,
  HaterBotId,
  ShieldLayerId,
  ThreatEnvelope,
  VisibilityLevel,
} from './GamePrimitives';
import type { RunStateSnapshot } from './RunStateSnapshot';
import {
  createDeterministicId,
  deepFrozenClone,
} from './Deterministic';
import {
  ModeRuleCompiler,
  type CompiledModeRules,
} from './ModeRuleCompiler';

export interface ThreatRoutingOptions {
  readonly maxNewAttacks?: number;
  readonly spawnAmbientThreats?: boolean;
  readonly allowBotRouting?: boolean;
  readonly strictDedup?: boolean;
  readonly rules?: CompiledModeRules;
}

export interface RoutedThreat {
  readonly threatId: string;
  readonly source: string;
  readonly category: AttackCategory;
  readonly targetLayer: ShieldLayerId | 'DIRECT';
  readonly targetEntity: AttackEvent['targetEntity'];
  readonly magnitude: number;
  readonly visibility: VisibilityLevel;
  readonly attack: AttackEvent;
  readonly notes: readonly string[];
}

export interface ThreatRoutingResult {
  readonly snapshot: RunStateSnapshot;
  readonly rules: CompiledModeRules;
  readonly injectedAttacks: readonly AttackEvent[];
  readonly deferredThreats: readonly ThreatEnvelope[];
  readonly routes: readonly RoutedThreat[];
}

const VISIBILITY_ORDER: Record<VisibilityLevel, number> = {
  HIDDEN: 0,
  SILHOUETTE: 1,
  PARTIAL: 2,
  EXPOSED: 3,
};

const VISIBILITY_BY_ORDER: Record<number, VisibilityLevel> = {
  0: 'HIDDEN',
  1: 'SILHOUETTE',
  2: 'PARTIAL',
  3: 'EXPOSED',
};

const BOT_CATEGORY_ROTATION: readonly AttackCategory[] = [
  'EXTRACTION',
  'LOCK',
  'DRAIN',
  'HEAT',
  'BREACH',
  'DEBT',
];

export class ThreatRoutingService {
  public constructor(
    private readonly modeRuleCompiler: ModeRuleCompiler = new ModeRuleCompiler(),
  ) {}

  public apply(
    snapshot: RunStateSnapshot,
    options: ThreatRoutingOptions = {},
  ): ThreatRoutingResult {
    const rules =
      options.rules ?? this.modeRuleCompiler.compileSnapshot(snapshot);
    const maxNewAttacks = Math.max(0, options.maxNewAttacks ?? 3);

    const ambientThreats =
      options.spawnAmbientThreats === false
        ? []
        : this.createAmbientThreats(snapshot, rules);

    const mergedThreats = this.mergeThreats(
      [...snapshot.tension.visibleThreats, ...ambientThreats],
      options.strictDedup !== false,
    );

    const maturedThreats = mergedThreats.filter((threat) => threat.etaTicks <= 0);
    const deferredThreats = mergedThreats
      .filter((threat) => threat.etaTicks > 0)
      .map((threat) => this.normalizeThreatVisibility(threat, rules));

    const threatRoutes = maturedThreats.map((threat) =>
      this.routeVisibleThreat(snapshot, rules, threat),
    );

    const botRoutes =
      options.allowBotRouting === false
        ? []
        : this.routeBotThreats(snapshot, rules);

    const routes = [...threatRoutes, ...botRoutes]
      .sort((a, b) => {
        if (b.magnitude !== a.magnitude) {
          return b.magnitude - a.magnitude;
        }
        return a.threatId.localeCompare(b.threatId);
      });

    const injectedAttacks = this.dedupeAttacks(
      routes.slice(0, maxNewAttacks).map((route) => route.attack),
    );

    const nextPendingAttacks = this.dedupeAttacks([
      ...snapshot.battle.pendingAttacks,
      ...injectedAttacks,
    ]);

    const nextBattleBudget = this.computeBattleBudget(snapshot, routes);
    const nextRivalryHeatCarry = this.computeRivalryHeatCarry(
      snapshot,
      routes,
      rules,
    );

    const nextSnapshot = deepFrozenClone<RunStateSnapshot>({
      ...snapshot,
      tension: {
        ...snapshot.tension,
        visibleThreats: deferredThreats,
      },
      battle: {
        ...snapshot.battle,
        pendingAttacks: nextPendingAttacks,
        battleBudget: nextBattleBudget,
        rivalryHeatCarry: nextRivalryHeatCarry,
      },
    });

    return {
      snapshot: nextSnapshot,
      rules,
      injectedAttacks,
      deferredThreats,
      routes,
    };
  }

  private routeVisibleThreat(
    snapshot: RunStateSnapshot,
    rules: CompiledModeRules,
    threat: ThreatEnvelope,
  ): RoutedThreat {
    const category = this.categoryFromThreat(threat);
    const targetLayer = this.selectTargetLayer(
      snapshot,
      rules,
      category,
      threat.severity,
    );
    const targetEntity = this.selectTargetEntity(snapshot, rules, category);
    const magnitude = this.computeMagnitude(snapshot, rules, threat.severity);

    const notes = [
      `source:${threat.source}`,
      `visibility:${threat.visibleAs}`,
      `severity:${threat.severity}`,
      `routed-category:${category}`,
      `routed-target:${targetEntity}/${targetLayer}`,
    ];

    const attack: AttackEvent = {
      attackId: createDeterministicId(
        snapshot.seed,
        'threat-route',
        threat.threatId,
        snapshot.tick,
      ),
      source: this.normalizeAttackSource(threat.source),
      targetEntity,
      targetLayer,
      category,
      magnitude,
      createdAtTick: snapshot.tick,
      notes,
    };

    return {
      threatId: threat.threatId,
      source: threat.source,
      category,
      targetLayer,
      targetEntity,
      magnitude,
      visibility: this.normalizeThreatVisibility(threat, rules).visibleAs,
      attack,
      notes,
    };
  }

  private routeBotThreats(
    snapshot: RunStateSnapshot,
    rules: CompiledModeRules,
  ): RoutedThreat[] {
    const disabledBots = new Set<HaterBotId>(rules.threatPolicy.disabledBots);

    return snapshot.battle.bots
      .filter((bot) => !bot.neutralized)
      .filter((bot) => !disabledBots.has(bot.botId))
      .filter((bot) => {
        if (bot.state === 'ATTACKING' || bot.state === 'TARGETING') {
          return true;
        }

        return bot.state === 'WATCHING' && snapshot.pressure.tier === 'T4';
      })
      .map((bot, index) => {
        const severity = this.clampInt(
          Math.round(
            bot.heat / 12 +
              snapshot.pressure.score / 25 +
              (bot.state === 'ATTACKING' ? 3 : 1),
          ),
          1,
          10,
        );

        const category = BOT_CATEGORY_ROTATION[index % BOT_CATEGORY_ROTATION.length];
        const targetLayer = this.selectTargetLayer(
          snapshot,
          rules,
          category,
          severity,
        );
        const targetEntity = this.selectTargetEntity(snapshot, rules, category);
        const magnitude = this.computeMagnitude(snapshot, rules, severity);

        const notes = [
          `bot:${bot.botId}`,
          `bot-state:${bot.state}`,
          `bot-heat:${bot.heat}`,
          `routed-category:${category}`,
          `routed-target:${targetEntity}/${targetLayer}`,
        ];

        const attack: AttackEvent = {
          attackId: createDeterministicId(
            snapshot.seed,
            'bot-route',
            bot.botId,
            snapshot.tick,
            index,
          ),
          source: bot.botId,
          targetEntity,
          targetLayer,
          category,
          magnitude,
          createdAtTick: snapshot.tick,
          notes,
        };

        return {
          threatId: `${bot.botId}:${snapshot.tick}`,
          source: bot.botId,
          category,
          targetLayer,
          targetEntity,
          magnitude,
          visibility: this.visibilityFromCounterIntel(rules),
          attack,
          notes,
        };
      });
  }

  private createAmbientThreats(
    snapshot: RunStateSnapshot,
    rules: CompiledModeRules,
  ): ThreatEnvelope[] {
    const threats: ThreatEnvelope[] = [];

    const activeBots = snapshot.battle.bots.filter(
      (bot) => !bot.neutralized && bot.state !== 'DORMANT',
    ).length;

    const shouldCreatePressureThreat =
      snapshot.tension.visibleThreats.length === 0 &&
      (snapshot.pressure.tier === 'T3' ||
        snapshot.pressure.tier === 'T4' ||
        snapshot.economy.haterHeat >= 40 ||
        activeBots >= 2);

    if (shouldCreatePressureThreat) {
      threats.push({
        threatId: createDeterministicId(
          snapshot.seed,
          'ambient-pressure',
          snapshot.tick,
          snapshot.mode,
        ),
        source:
          snapshot.mode === 'ghost' ? 'LEGEND_PACE' : 'SYSTEM_PRESSURE',
        etaTicks: snapshot.pressure.tier === 'T4' ? 0 : 1,
        severity: this.clampInt(
          Math.round(snapshot.pressure.score / 18 + snapshot.economy.haterHeat / 20),
          1,
          10,
        ),
        visibleAs: this.visibilityFromCounterIntel(rules),
        summary:
          snapshot.mode === 'ghost'
            ? 'Legend pace spike threatens tempo parity.'
            : 'System pressure is condensing into a live hostile window.',
      });
    }

    const shouldCreateRivalryThreat =
      snapshot.mode === 'pvp' &&
      snapshot.battle.rivalryHeatCarry >= 8 &&
      snapshot.tension.visibleThreats.every((threat) => threat.source !== 'OPPONENT');

    if (shouldCreateRivalryThreat) {
      threats.push({
        threatId: createDeterministicId(
          snapshot.seed,
          'ambient-rivalry',
          snapshot.tick,
        ),
        source: 'OPPONENT',
        etaTicks: 0,
        severity: this.clampInt(
          Math.round(4 + snapshot.battle.rivalryHeatCarry / 3),
          1,
          10,
        ),
        visibleAs: this.raiseVisibility(this.visibilityFromCounterIntel(rules), 1),
        summary: 'Opponent pressure window opened off rivalry carry heat.',
      });
    }

    return threats;
  }

  private mergeThreats(
    threats: readonly ThreatEnvelope[],
    strictDedup: boolean,
  ): ThreatEnvelope[] {
    if (!strictDedup) {
      return [...threats];
    }

    const deduped = new Map<string, ThreatEnvelope>();

    for (const threat of threats) {
      const key = `${threat.threatId}::${threat.source}::${threat.summary}`;
      const existing = deduped.get(key);

      if (!existing) {
        deduped.set(key, threat);
        continue;
      }

      deduped.set(key, {
        ...existing,
        etaTicks: Math.min(existing.etaTicks, threat.etaTicks),
        severity: Math.max(existing.severity, threat.severity),
        visibleAs:
          VISIBILITY_ORDER[existing.visibleAs] >= VISIBILITY_ORDER[threat.visibleAs]
            ? existing.visibleAs
            : threat.visibleAs,
      });
    }

    return [...deduped.values()];
  }

  private dedupeAttacks(attacks: readonly AttackEvent[]): AttackEvent[] {
    const deduped = new Map<string, AttackEvent>();

    for (const attack of attacks) {
      deduped.set(attack.attackId, attack);
    }

    return [...deduped.values()].sort((a, b) => {
      if (a.createdAtTick !== b.createdAtTick) {
        return a.createdAtTick - b.createdAtTick;
      }
      return a.attackId.localeCompare(b.attackId);
    });
  }

  private categoryFromThreat(threat: ThreatEnvelope): AttackCategory {
    const text = `${threat.source} ${threat.summary}`.toLowerCase();

    if (text.includes('debt') || text.includes('credit')) {
      return 'DEBT';
    }

    if (text.includes('lock') || text.includes('freeze') || text.includes('filing')) {
      return 'LOCK';
    }

    if (text.includes('breach') || text.includes('crash') || text.includes('rupture')) {
      return 'BREACH';
    }

    if (text.includes('heat') || text.includes('expose') || text.includes('spectator')) {
      return 'HEAT';
    }

    if (text.includes('drain') || text.includes('bleed')) {
      return 'DRAIN';
    }

    return threat.severity >= 8 ? 'BREACH' : 'EXTRACTION';
  }

  private selectTargetLayer(
    snapshot: RunStateSnapshot,
    rules: CompiledModeRules,
    category: AttackCategory,
    severity: number,
  ): ShieldLayerId | 'DIRECT' {
    const weakestLayer = snapshot.shield.weakestLayerId;
    const weakestLayerState = snapshot.shield.layers.find(
      (layer) => layer.layerId === weakestLayer,
    );

    if (
      rules.allowDirectAttacks &&
      severity >= 8 &&
      weakestLayerState !== undefined &&
      weakestLayerState.current / Math.max(1, weakestLayerState.max) <= 0.20
    ) {
      return 'DIRECT';
    }

    switch (category) {
      case 'EXTRACTION':
      case 'DRAIN':
        return 'L1';
      case 'DEBT':
        return 'L2';
      case 'LOCK':
        return 'L3';
      case 'HEAT':
        return rules.mode === 'pvp' ? 'DIRECT' : 'L4';
      case 'BREACH':
      default:
        return weakestLayer;
    }
  }

  private selectTargetEntity(
    snapshot: RunStateSnapshot,
    rules: CompiledModeRules,
    category: AttackCategory,
  ): AttackEvent['targetEntity'] {
    if (rules.mode === 'pvp' && rules.allowDirectAttacks) {
      return 'OPPONENT';
    }

    if (rules.mode === 'coop' && (category === 'HEAT' || category === 'BREACH')) {
      return 'TEAM';
    }

    if (rules.mode === 'coop' && category === 'LOCK') {
      return 'PLAYER';
    }

    return 'SELF';
  }

  private computeMagnitude(
    snapshot: RunStateSnapshot,
    rules: CompiledModeRules,
    severity: number,
  ): number {
    const modeScalar = rules.allowDirectAttacks ? 1.10 : 1.00;
    const pressureScalar = rules.pressureCurveModifier;
    const heatScalar = rules.heatCurveModifier;
    const counterIntelMitigation =
      rules.threatPolicy.counterIntelTier >= 4 ? 0.90 : 1.00;
    const weakestLayerPenalty =
      snapshot.shield.layers.find(
        (layer) => layer.layerId === snapshot.shield.weakestLayerId,
      )?.current ?? 100;

    const integrityScalar = weakestLayerPenalty <= 20 ? 1.15 : 1.00;

    return Number(
      (
        severity *
        modeScalar *
        pressureScalar *
        heatScalar *
        counterIntelMitigation *
        integrityScalar
      ).toFixed(3),
    );
  }

  private computeBattleBudget(
    snapshot: RunStateSnapshot,
    routes: readonly RoutedThreat[],
  ): number {
    const delta = routes.reduce((sum, route) => {
      if (route.category === 'BREACH' || route.targetLayer === 'DIRECT') {
        return sum + 5;
      }

      return sum + 2;
    }, 0);

    return Math.min(
      snapshot.battle.battleBudgetCap,
      snapshot.battle.battleBudget + delta,
    );
  }

  private computeRivalryHeatCarry(
    snapshot: RunStateSnapshot,
    routes: readonly RoutedThreat[],
    rules: CompiledModeRules,
  ): number {
    const directPressure = routes.filter(
      (route) =>
        route.targetEntity === 'OPPONENT' || route.targetLayer === 'DIRECT',
    ).length;

    const next =
      snapshot.battle.rivalryHeatCarry +
      directPressure * rules.threatPolicy.rivalryHeatMultiplier;

    return Number(next.toFixed(6));
  }

  private normalizeThreatVisibility(
    threat: ThreatEnvelope,
    rules: CompiledModeRules,
  ): ThreatEnvelope {
    const floorOrder = VISIBILITY_ORDER[rules.threatPolicy.threatVisibilityFloor];
    const ceilingOrder =
      VISIBILITY_ORDER[rules.threatPolicy.threatVisibilityCeiling];
    const threatOrder = VISIBILITY_ORDER[threat.visibleAs];

    const clampedOrder = Math.max(
      floorOrder,
      Math.min(ceilingOrder, threatOrder),
    );

    return {
      ...threat,
      visibleAs: VISIBILITY_BY_ORDER[clampedOrder],
    };
  }

  private normalizeAttackSource(
    source: string,
  ): AttackEvent['source'] {
    if (
      source === 'BOT_01' ||
      source === 'BOT_02' ||
      source === 'BOT_03' ||
      source === 'BOT_04' ||
      source === 'BOT_05'
    ) {
      return source;
    }

    if (source === 'OPPONENT') {
      return 'OPPONENT';
    }

    return 'SYSTEM';
  }

  private visibilityFromCounterIntel(
    rules: CompiledModeRules,
  ): VisibilityLevel {
    if (rules.threatPolicy.counterIntelTier >= 4) {
      return 'EXPOSED';
    }

    if (rules.threatPolicy.counterIntelTier === 3) {
      return 'PARTIAL';
    }

    return rules.threatPolicy.threatVisibilityFloor;
  }

  private raiseVisibility(
    value: VisibilityLevel,
    levels: number,
  ): VisibilityLevel {
    const next = Math.min(3, VISIBILITY_ORDER[value] + levels);
    return VISIBILITY_BY_ORDER[next];
  }

  private clampInt(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }
}
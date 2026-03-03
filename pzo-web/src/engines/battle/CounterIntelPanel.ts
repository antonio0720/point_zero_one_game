/**
 * FILE: pzo-web/src/engines/battle/CounterIntelPanel.ts
 * Read-only intelligence filter — produces IntelReport objects for the frontend.
 *
 * Never modifies bot state. Never emits events.
 * Monetizes information asymmetry: free players feel the machine but can't see it.
 * Pass holders see the structure of their oppression. Forensics holders see everything.
 *
 * Tier exposure:
 *   FREE          → 'Adversarial activity detected.' | 'Target acquired — [LAYER].'
 *   SEASON_PASS   → Bot name, attack type hint, target layer, arrival tick window
 *   FORENSICS_PASS → Full profile, optimal counter, damage forecast, breach risk
 */
import {
  BotId,
  BotState,
  EntitlementTier,
  HaterBotRuntimeState,
  IntelReport,
  FullBotProfile,
  BATTLE_ACTION_COSTS,
  BattleActionType,
} from './types';
import type { ShieldReader } from '../shield/types';

// ── Internal helpers ──────────────────────────────────────────────────────────

function buildFullProfile(bot: HaterBotRuntimeState): FullBotProfile {
  return {
    botId:                         bot.profileId,
    name:                          bot.profile.name,
    archetype:                     bot.profile.archetype,
    primaryAttackType:             bot.profile.primaryAttackType,
    targetLayerId:                 bot.profile.targetLayerId,
    escalationConditionDescription: bot.profile.escalationConditionDescription,
    attackDialogue:                bot.profile.attackDialogue,
    consequenceText:               bot.profile.consequenceText,
  };
}

/**
 * Forecast raw damage before deflection.
 * Uses the midpoint of the bot's power range, adjusted by active damage reduction.
 */
function forecastDamage(
  bot: HaterBotRuntimeState,
  _shieldReader: ShieldReader
): number {
  const midPower =
    (bot.profile.attackPowerMin + bot.profile.attackPowerMax) / 2;
  return Math.round(midPower * (1 - bot.damageReductionPct));
}

/**
 * Assess whether the target shield layer is at breach risk given the forecast damage.
 */
function assessBreachRisk(
  bot: HaterBotRuntimeState,
  shieldReader: ShieldReader
): boolean {
  const forecast   = forecastDamage(bot, shieldReader);
  const layerState = shieldReader.getLayerState(bot.profile.targetLayerId);
  // Breach risk: forecast would consume more than the layer's current integrity pts
  return forecast >= layerState.currentIntegrity;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function buildIntelReport(
  bot: HaterBotRuntimeState,
  tier: EntitlementTier,
  shieldReader: ShieldReader
): IntelReport {
  const isFree      = tier === EntitlementTier.FREE;
  const isPass      = tier !== EntitlementTier.FREE;
  const isForensic  = tier === EntitlementTier.FORENSICS_PASS;
  const isAttacking = bot.state === BotState.ATTACKING;

  return {
    botId: bot.profileId,

    // Display name: hidden from FREE unless bot is actively ATTACKING
    displayName:
      isPass || isAttacking
        ? bot.profile.name
        : null,

    state: bot.state,

    // Attack type hint: SEASON_PASS+
    attackTypeHint:
      isPass ? bot.profile.primaryAttackType : null,

    // Target layer hint: SEASON_PASS+
    targetLayerHint:
      isPass ? bot.profile.targetLayerId : null,

    // Arrival tick hint: SEASON_PASS+
    arrivalTickHint:
      isPass ? (bot.preloadedArrivalTick ?? null) : null,

    // Full profile: FORENSICS_PASS only
    fullProfile:
      isForensic ? buildFullProfile(bot) : null,

    // Optimal counter action string: FORENSICS_PASS only
    optimalCounterAction:
      isForensic ? bot.profile.counterEvidenceCardType : null,

    // Damage forecast: FORENSICS_PASS + bot must be ATTACKING
    damageForecast:
      isForensic && isAttacking
        ? forecastDamage(bot, shieldReader)
        : null,

    // Breach risk: FORENSICS_PASS + bot must be ATTACKING
    breachRisk:
      isForensic && isAttacking
        ? assessBreachRisk(bot, shieldReader)
        : null,

    // Budget cost of optimal neutralize counter: FORENSICS_PASS only
    counterCostPts:
      isForensic
        ? BATTLE_ACTION_COSTS[BattleActionType.COUNTER_EVIDENCE_FILE]
        : null,
  };
}

/**
 * Build IntelReport array for all bots — filters by entitlement tier.
 * UI components call this to populate the Counter-Intel panel.
 */
export function buildAllIntelReports(
  bots: Map<BotId, HaterBotRuntimeState>,
  tier: EntitlementTier,
  shieldReader: ShieldReader
): IntelReport[] {
  return [...bots.values()].map(bot => buildIntelReport(bot, tier, shieldReader));
}

/**
 * Friendly UI label for a bot's current state, scoped to the player's tier.
 * Used in Counter-Intel panel notification text.
 */
export function getStateDisplayText(
  bot: HaterBotRuntimeState,
  tier: EntitlementTier
): string {
  const isFree     = tier === EntitlementTier.FREE;
  const isPass     = tier !== EntitlementTier.FREE;
  const isForensic = tier === EntitlementTier.FORENSICS_PASS;
  const name       = bot.profile.name;

  switch (bot.state) {
    case BotState.DORMANT:
      return '';   // Not visible in Counter-Intel panel when dormant

    case BotState.WATCHING:
      if (isFree)     return 'Adversarial activity detected. Protect your assets.';
      if (isForensic) return `${name} is monitoring your position. Full profile available.`;
      return `${name} is monitoring your position.`;

    case BotState.TARGETING:
      if (isFree)     return `Target acquired. Secure ${bot.profile.targetLayerId}.`;
      if (isForensic) {
        return `${name} targeting ${bot.profile.targetLayerId}. Arrival: ${bot.preloadedArrivalTick ?? '?'} ticks. Optimal counter: ${bot.profile.counterEvidenceCardType}.`;
      }
      return `${name} targeting ${bot.profile.targetLayerId}. Arrival: ${bot.preloadedArrivalTick ?? '?'} ticks.`;

    case BotState.ATTACKING:
      // Full consequence text shown regardless of tier during active extraction
      return `EXTRACTION ACTIVE — ${bot.profile.consequenceText}`;

    case BotState.RETREATING:
      return `Adversarial pressure reduced. Monitoring resumes in ${bot.retreatTicksRemaining} ticks.`;

    case BotState.NEUTRALIZED:
      return `Adversary neutralized. Evidence filed. Immunity: ${bot.neutralizedTicksRemaining} ticks.`;

    default:
      return '';
  }
}
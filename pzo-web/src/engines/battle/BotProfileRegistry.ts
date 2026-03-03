/**
 * FILE: pzo-web/src/engines/battle/BotProfileRegistry.ts
 * Pure static data. Frozen. No runtime logic.
 * Imports types.ts only — never import any engine module here.
 *
 * The five adversaries are archetypes of real systemic financial pressure.
 * The player does not fight people — they fight patterns.
 */
import { BotId, BotProfile, AttackType } from './types';
import { ShieldLayerId } from '../shield/types';

const PROFILES: readonly BotProfile[] = Object.freeze([
  // ── BOT_01 — THE LIQUIDATOR ────────────────────────────────────────────────
  {
    id:          BotId.BOT_01_LIQUIDATOR,
    name:        'THE LIQUIDATOR',
    archetype:   'Predatory creditor / distressed-asset buyer / short interest position',
    primaryAttackType:   AttackType.ASSET_STRIP,
    secondaryAttackType: null,
    targetLayerId:          ShieldLayerId.ASSET_FLOOR,
    secondaryTargetLayerId: null,
    attackPowerMin:    25,
    attackPowerMax:    45,
    secondaryPowerMin: 0,
    secondaryPowerMax: 0,
    watchingHeatThreshold:  20,
    targetingHeatThreshold: 41,
    attackingHeatThreshold: 61,
    retreatTicks:     5,
    neutralizedTicks: 3,
    counterEvidenceCardType: 'LEGAL_DEFENSE',
    attackDialogue:
      'Your assets are priced for distress. I am simply here to help the market find the floor.',
    retreatDialogue:
      'The market will correct again. I will return when the window reopens.',
    consequenceText:
      'Highest-value asset card removed from play for 3 ticks. L3 ASSET_FLOOR receives damage. Income reduced 25% for 3 ticks.',
    escalationConditionDescription:
      'Activates when player net worth exceeds 2× their starting baseline. Targets players who have grown — not struggling players.',
  },

  // ── BOT_02 — THE BUREAUCRAT ────────────────────────────────────────────────
  {
    id:          BotId.BOT_02_BUREAUCRAT,
    name:        'THE BUREAUCRAT',
    archetype:   'Regulatory burden / licensing gatekeeping / compliance overhead that disproportionately targets emerging wealth',
    primaryAttackType:   AttackType.REGULATORY_ATTACK,
    secondaryAttackType: null,
    targetLayerId:          ShieldLayerId.NETWORK_CORE,
    secondaryTargetLayerId: null,
    attackPowerMin:    15,
    attackPowerMax:    30,
    secondaryPowerMin: 0,
    secondaryPowerMax: 0,
    watchingHeatThreshold:  20,
    targetingHeatThreshold: 41,
    attackingHeatThreshold: 61,
    retreatTicks:     5,
    neutralizedTicks: 3,
    counterEvidenceCardType: 'LEGAL_FILING',
    attackDialogue:
      'Every income stream requires verification. There are forms. I am simply doing my job.',
    retreatDialogue:
      'Your paperwork appears to be in order. For now. We will revisit your compliance posture.',
    consequenceText:
      'One income card gains REGULATORY_HOLD status for 2 ticks (3 on crit). Card cannot be played. L4 NETWORK_CORE takes damage.',
    escalationConditionDescription:
      'Activates when player has 3+ distinct active income streams. Punishes complexity and diversification.',
  },

  // ── BOT_03 — THE MANIPULATOR ───────────────────────────────────────────────
  {
    id:          BotId.BOT_03_MANIPULATOR,
    name:        'THE MANIPULATOR',
    archetype:   'Disinformation campaigns / manufactured scarcity / FOMO-driven market signals designed to invert sound decisions',
    primaryAttackType:   AttackType.FINANCIAL_SABOTAGE,
    secondaryAttackType: AttackType.REPUTATION_ATTACK,
    targetLayerId:          ShieldLayerId.LIQUIDITY_BUFFER,
    secondaryTargetLayerId: ShieldLayerId.NETWORK_CORE,
    attackPowerMin:    10,
    attackPowerMax:    20,
    secondaryPowerMin: 8,
    secondaryPowerMax: 15,
    watchingHeatThreshold:  20,
    targetingHeatThreshold: 41,
    attackingHeatThreshold: 61,
    retreatTicks:     5,
    neutralizedTicks: 3,
    counterEvidenceCardType: 'COUNTER_NARRATIVE',
    attackDialogue:
      'Predictable decisions create exploitable markets. I have been studying your moves before you made them.',
    retreatDialogue:
      'You changed your pattern. Interesting. I will need to recalibrate the model.',
    consequenceText:
      'INVERSION_CURSE applied for 2 ticks (3 on crit). Next income card played has inverted effect. L1 takes primary damage. L4 takes secondary damage simultaneously.',
    escalationConditionDescription:
      'Activates when card pattern entropy drops below 0.4. Monitors play patterns — activates when patterns become predictable.',
  },

  // ── BOT_04 — THE CRASH PROPHET ─────────────────────────────────────────────
  {
    id:          BotId.BOT_04_CRASH_PROPHET,
    name:        'THE CRASH PROPHET',
    archetype:   'Macro volatility / recession narrative / manufactured systemic shocks that wipe out players without deep reserves',
    primaryAttackType:   AttackType.EXPENSE_INJECTION,
    secondaryAttackType: null,
    targetLayerId:          ShieldLayerId.LIQUIDITY_BUFFER,
    secondaryTargetLayerId: null,
    attackPowerMin:    30,
    attackPowerMax:    60,
    secondaryPowerMin: 0,
    secondaryPowerMax: 0,
    // NOTE: watchingHeatThreshold and targetingHeatThreshold both at 61 because
    // BOT_04's escalation condition also requires hater_heat > 60. In practice
    // this bot jumps DORMANT → TARGETING — it does not linger in WATCHING.
    watchingHeatThreshold:  20,
    targetingHeatThreshold: 61,
    attackingHeatThreshold: 61,
    retreatTicks:     5,
    neutralizedTicks: 3,
    counterEvidenceCardType: 'MACRO_HEDGE',
    attackDialogue:
      'The market always corrects. The only question is whether you have positioned yourself to survive the correction, or to be consumed by it.',
    retreatDialogue:
      'The correction happened. Rebuild your reserves. I will return when you have forgotten this lesson.',
    consequenceText:
      'Global expense multiplier +35% for 3 ticks (+50% on crit). L1 LIQUIDITY_BUFFER takes heavy damage. All income calculations recalculated at reduced rate for 3 ticks.',
    escalationConditionDescription:
      'Activates ONLY on high-income runs: hater_heat > 60 AND monthly income > $10,000. Exclusively targets players who have climbed high enough to lose the most.',
  },

  // ── BOT_05 — THE LEGACY HEIR ───────────────────────────────────────────────
  {
    id:          BotId.BOT_05_LEGACY_HEIR,
    name:        'THE LEGACY HEIR',
    archetype:   'Inherited structural advantage / generational wealth gap / passive systems that compound against new entrants',
    primaryAttackType:   AttackType.OPPORTUNITY_KILL,
    secondaryAttackType: null,
    targetLayerId:          ShieldLayerId.CREDIT_LINE,
    secondaryTargetLayerId: null,
    attackPowerMin:    18,
    attackPowerMax:    35,
    secondaryPowerMin: 0,
    secondaryPowerMax: 0,
    watchingHeatThreshold:  20,
    targetingHeatThreshold: 41,
    attackingHeatThreshold: 61,
    retreatTicks:     5,
    neutralizedTicks: 3,
    counterEvidenceCardType: 'SOVEREIGNTY_CLAIM',
    attackDialogue:
      'You have done well. It would be a shame if the system remembered that you were not born into this position.',
    retreatDialogue:
      'You found a way through. The system will need to recalibrate its thresholds for you.',
    consequenceText:
      'Highest income-growth card removed from active pool for 2 ticks (3 on crit). L2 CREDIT_LINE takes damage. Income growth rate capped at 0% (-5% on crit) for 2 ticks.',
    escalationConditionDescription:
      'Activates in late-game only: net worth > 5× freedom threshold. Exclusively targets wealth consolidation momentum — does not interfere early.',
  },
] as const);

export const BotProfileRegistry = {
  getAllProfiles(): BotProfile[] {
    return PROFILES as unknown as BotProfile[];
  },

  getProfile(id: BotId): BotProfile {
    const p = PROFILES.find(b => b.id === id);
    if (!p) throw new Error(`[BotProfileRegistry] No profile registered for BotId: ${id}`);
    return p as unknown as BotProfile;
  },
} as const;
/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT PLAYER FINGERPRINT CONTRACTS
 * FILE: shared/contracts/chat/player-fingerprint.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Shared player conversational and behavioral fingerprint contracts.
 *
 * The fingerprint layer exists to convert repeated chat + run behaviors into a
 * persistent player-profile surface that rival bots can study, target, bait,
 * respect, or strategically misread.
 * ============================================================================
 */

export type ChatPlayerFingerprintAxisId =
  | 'IMPULSIVE_VS_PATIENT'
  | 'GREED_VS_DEFENSE'
  | 'BLUFF_VS_LITERAL'
  | 'COMEBACK_VS_COLLAPSE'
  | 'PUBLIC_VS_PRIVATE'
  | 'PROCEDURE_AWARE_VS_CARELESS'
  | 'NOVELTY_SEEKING_VS_STABILITY'
  | 'TILT_VS_DISCIPLINE'
  | 'RISK_APPETITE'
  | 'RECOVERY_STRENGTH';

export type ChatPlayerArchetypeId =
  | 'THE_SPECULATOR'
  | 'THE_LAWYER'
  | 'THE_SHOWMAN'
  | 'THE_SURVIVOR'
  | 'THE_GHOST'
  | 'THE_COUNTERPUNCHER'
  | 'THE_PERFECTIONIST'
  | 'THE_SHARK_BAIT';

export type ChatPlayerFingerprintEventType =
  | 'MESSAGE_SENT'
  | 'MESSAGE_QUESTION'
  | 'MESSAGE_TAUNT'
  | 'MESSAGE_DEFLECTION'
  | 'MESSAGE_BOAST'
  | 'MESSAGE_CALM'
  | 'TURN_TIMEOUT'
  | 'SHIELD_BROKEN'
  | 'CASCADE_TRIGGERED'
  | 'CASCADE_ESCAPED'
  | 'NEGOTIATION_ACCEPTED'
  | 'NEGOTIATION_REJECTED'
  | 'COMEBACK'
  | 'COLLAPSE'
  | 'PERFECT_DEFENSE'
  | 'FAILED_GAMBLE'
  | 'BIG_SWING'
  | 'SMALL_DISCIPLINED_PLAY';

export interface ChatPlayerFingerprintEvent {
  readonly eventId: string;
  readonly playerId: string;
  readonly eventType: ChatPlayerFingerprintEventType;
  readonly createdAt: number;
  readonly roomId?: string | null;
  readonly channelId?: string | null;
  readonly intensity01?: number;
  readonly publicWitness01?: number;
  readonly text?: string | null;
  readonly tags?: readonly string[];
}

export interface ChatPlayerFingerprintVector {
  readonly impulsive01: number;
  readonly greed01: number;
  readonly bluff01: number;
  readonly comeback01: number;
  readonly publicness01: number;
  readonly procedureAwareness01: number;
  readonly noveltySeeking01: number;
  readonly tilt01: number;
  readonly riskAppetite01: number;
  readonly recoveryStrength01: number;
}

export interface ChatPlayerFingerprintSnapshot {
  readonly playerId: string;
  readonly updatedAt: number;
  readonly careerEventCount: number;
  readonly recentEventCount: number;
  readonly archetype: ChatPlayerArchetypeId;
  readonly confidence01: number;
  readonly vector: ChatPlayerFingerprintVector;
  readonly dominantAxes: readonly ChatPlayerFingerprintAxisId[];
  readonly pressureResponseTags: readonly string[];
  readonly exploitableSeams: readonly string[];
  readonly resilienceTags: readonly string[];
  readonly eventTail: readonly ChatPlayerFingerprintEvent[];
}

export interface ChatPlayerCounterplayHint {
  readonly archetype: ChatPlayerArchetypeId;
  readonly idealBotObjectives: readonly string[];
  readonly idealSceneArchetypes: readonly string[];
  readonly transformBiases: readonly string[];
  readonly notes: readonly string[];
}

export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return Number(value.toFixed(6));
}

export function emptyPlayerFingerprintVector(): ChatPlayerFingerprintVector {
  return {
    impulsive01: 0.50,
    greed01: 0.50,
    bluff01: 0.50,
    comeback01: 0.50,
    publicness01: 0.50,
    procedureAwareness01: 0.50,
    noveltySeeking01: 0.50,
    tilt01: 0.50,
    riskAppetite01: 0.50,
    recoveryStrength01: 0.50,
  };
}

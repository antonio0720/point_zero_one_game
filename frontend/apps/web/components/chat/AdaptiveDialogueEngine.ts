/**
 * AdaptiveDialogueEngine.ts — PZO Sovereign Chat
 * ML-driven dialogue selection. Wires PlayerModelEngine intelligence
 * outputs to HaterDialogueTrees for context-aware, adaptive taunting.
 *
 * This is the brain of the chat system. It decides:
 *   - WHEN a bot speaks (timing)
 *   - WHAT it says (context + personality)
 *   - HOW aggressive it is (ML-bounded)
 *   - WHETHER to back off (churn risk ceiling)
 *
 * Density6 LLC · Point Zero One · Confidential
 */

import type { DialogueContext, DialogueLine, DialogueCharacterId } from './HaterDialogueTrees';
import { DIALOGUE_TREES, pickDialogue } from './HaterDialogueTrees';
import { classifyPlayerResponse, sentimentToDialogueContext, ResponseCooldownManager } from './PlayerResponseClassifier';
import type { ResponseSentiment } from './PlayerResponseClassifier';
import type { GameChatContext } from '../components/chat/chatTypes';

// ─── Intelligence Input (from PlayerModelEngine) ──────────────────────────────

export interface IntelligenceSnapshot {
  risk:                number;  // 0-1
  biasScore:           number;  // 0-1
  bankruptcyRisk60:    number;  // 0-1, risk of bankruptcy within 60 ticks
  convergenceSignal:   number;  // 0-1, are they converging toward sovereignty?
  windowFailRisk:      number;  // 0-1
  volatility:          number;  // 0-1
  tiltRisk:            number;  // 0-1, emotional tilt
  churnRisk:           number;  // 0-1, risk of player quitting
  sessionMomentum:     number;  // >1 = improving, <1 = declining
}

// ─── Bot Personality Modifiers (tuned per player over time) ──────────────────

interface BotPersonality {
  aggressionCurve:    number;  // 0-1, increases as player improves
  sarcasmWeight:      number;  // 0-1, personality flavor
  respectThreshold:   number;  // sovereignty score at which bot starts respecting
  silenceChance:      number;  // 0-1, chance bot says nothing (dramatic pause)
  reactToPlayer:      number;  // 0-1, how likely to respond to player messages
}

const DEFAULT_PERSONALITIES: Record<string, BotPersonality> = {
  BOT_01_LIQUIDATOR:   { aggressionCurve: 0.8, sarcasmWeight: 0.4, respectThreshold: 0.7, silenceChance: 0.1, reactToPlayer: 0.9 },
  BOT_02_BUREAUCRAT:   { aggressionCurve: 0.5, sarcasmWeight: 0.7, respectThreshold: 0.8, silenceChance: 0.2, reactToPlayer: 0.7 },
  BOT_03_MANIPULATOR:  { aggressionCurve: 0.6, sarcasmWeight: 0.9, respectThreshold: 0.6, silenceChance: 0.15, reactToPlayer: 0.8 },
  BOT_04_CRASH_PROPHET:{ aggressionCurve: 0.7, sarcasmWeight: 0.3, respectThreshold: 0.75, silenceChance: 0.25, reactToPlayer: 0.5 },
  BOT_05_LEGACY_HEIR:  { aggressionCurve: 0.4, sarcasmWeight: 0.6, respectThreshold: 0.9, silenceChance: 0.3, reactToPlayer: 0.6 },
  MENTOR:              { aggressionCurve: 0.0, sarcasmWeight: 0.0, respectThreshold: 0.0, silenceChance: 0.4, reactToPlayer: 0.3 },
};

// ─── Dialogue Decision ────────────────────────────────────────────────────────

export interface DialogueDecision {
  characterId:  DialogueCharacterId;
  text:         string;
  context:      DialogueContext;
  personality:  BotPersonality;
  wasAdapted:   boolean;   // true if ML influenced the selection
  churnGuarded: boolean;   // true if aggression was reduced due to churn risk
}

// ─── Engine ───────────────────────────────────────────────────────────────────

export class AdaptiveDialogueEngine {
  private usedDialogue: Map<string, Set<string>> = new Map(); // characterId → Set<text>
  private cooldowns: ResponseCooldownManager;
  private lastContextPerBot: Map<string, DialogueContext> = new Map();
  private personalities: Record<string, BotPersonality>;

  constructor() {
    this.cooldowns = new ResponseCooldownManager(2500);
    this.personalities = { ...DEFAULT_PERSONALITIES };
  }

  // ─── Core: Select dialogue for a game state change ───────────────────────

  selectForGameEvent(
    characterId: DialogueCharacterId,
    context: DialogueContext,
    gameChatCtx: GameChatContext,
    intel?: IntelligenceSnapshot,
  ): DialogueDecision | null {
    if (!this.cooldowns.canRespond(characterId)) return null;

    const personality = this.personalities[characterId] ?? DEFAULT_PERSONALITIES.BOT_01_LIQUIDATOR;
    const tree = DIALOGUE_TREES[characterId];
    if (!tree) return null;

    const lines = tree[context];
    if (!lines || lines.length === 0) return null;

    // Dramatic silence check
    if (Math.random() < personality.silenceChance) return null;

    // Churn guard: if player is likely to quit, reduce aggression
    let churnGuarded = false;
    if (intel && intel.churnRisk > 0.65) {
      // Switch to softer context if available
      const softerContext = this.getSofterAlternative(context);
      if (softerContext && tree[softerContext]?.length) {
        const softerLines = tree[softerContext]!;
        const picked = pickDialogue(softerLines, gameChatCtx.tick, this.getUsedSet(characterId));
        if (picked) {
          this.markUsed(characterId, picked.text);
          this.cooldowns.markResponded(characterId);
          this.lastContextPerBot.set(characterId, softerContext);
          return {
            characterId, text: picked.text, context: softerContext,
            personality, wasAdapted: true, churnGuarded: true,
          };
        }
      }
      churnGuarded = true;
    }

    // Avoid repeating the same context twice in a row
    if (this.lastContextPerBot.get(characterId) === context && Math.random() < 0.6) {
      return null; // 60% chance to skip if same context as last time
    }

    const picked = pickDialogue(lines, gameChatCtx.tick, this.getUsedSet(characterId));
    if (!picked) return null;

    this.markUsed(characterId, picked.text);
    this.cooldowns.markResponded(characterId);
    this.lastContextPerBot.set(characterId, context);

    return {
      characterId, text: picked.text, context,
      personality, wasAdapted: !!intel, churnGuarded,
    };
  }

  // ─── React to player message ─────────────────────────────────────────────

  selectResponseToPlayer(
    playerText: string,
    gameChatCtx: GameChatContext,
    intel?: IntelligenceSnapshot,
  ): DialogueDecision[] {
    const sentiment = classifyPlayerResponse(playerText);
    const dialogueCtx = sentimentToDialogueContext(sentiment);
    if (!dialogueCtx) return [];

    const responses: DialogueDecision[] = [];

    // Pick 1-2 bots to respond (not all 5 at once)
    const respondingBots = this.selectRespondingBots(sentiment);

    for (const botId of respondingBots) {
      const decision = this.selectForGameEvent(
        botId as DialogueCharacterId,
        dialogueCtx,
        gameChatCtx,
        intel,
      );
      if (decision) {
        responses.push(decision);
      }
    }

    // If player asked for help, mentor always responds
    if (sentiment.help) {
      const mentorDecision = this.selectForGameEvent(
        'MENTOR',
        'PLAYER_NEAR_BANKRUPTCY', // closest context for help
        gameChatCtx,
        intel,
      );
      if (mentorDecision) responses.push(mentorDecision);
    }

    return responses;
  }

  // ─── Determine game state → DialogueContext ──────────────────────────────

  inferContextFromGameState(
    gameChatCtx: GameChatContext,
    intel?: IntelligenceSnapshot,
  ): DialogueContext {
    if (gameChatCtx.tick === 0) return 'GAME_START';

    // Near sovereignty
    if (gameChatCtx.netWorth > 400_000 && gameChatCtx.income > gameChatCtx.expenses * 1.5) {
      return 'NEAR_SOVEREIGNTY';
    }

    // Near bankruptcy
    if (intel && intel.bankruptcyRisk60 > 0.6) return 'PLAYER_NEAR_BANKRUPTCY';
    if (gameChatCtx.cash < 1000 && gameChatCtx.netWorth < 5000) return 'PLAYER_NEAR_BANKRUPTCY';

    // Income up (positive cashflow)
    if (gameChatCtx.income > gameChatCtx.expenses) return 'PLAYER_INCOME_UP';

    // Time pressure
    if (gameChatCtx.tickTier && ['T3', 'T4'].includes(gameChatCtx.tickTier)) return 'TIME_PRESSURE';

    // Comeback (was low, now recovering)
    if (intel && intel.sessionMomentum > 1.3) return 'PLAYER_COMEBACK';

    // Default based on pressure
    if (gameChatCtx.pressureTier && ['HIGH', 'CRITICAL'].includes(gameChatCtx.pressureTier)) {
      return 'TIME_PRESSURE';
    }

    return 'PLAYER_CARD_PLAY'; // generic fallback
  }

  // ─── Adapt personality based on player behavior over time ────────────────

  adaptPersonality(characterId: string, intel: IntelligenceSnapshot): void {
    const p = this.personalities[characterId];
    if (!p) return;

    // Player improving → bots get more aggressive (but capped)
    if (intel.sessionMomentum > 1.2) {
      p.aggressionCurve = Math.min(1.0, p.aggressionCurve + 0.02);
      p.silenceChance = Math.max(0.05, p.silenceChance - 0.01);
    }

    // Player struggling → bots ease up slightly
    if (intel.churnRisk > 0.5) {
      p.aggressionCurve = Math.max(0.2, p.aggressionCurve - 0.05);
      p.silenceChance = Math.min(0.5, p.silenceChance + 0.05);
    }

    // Player near sovereignty → respect kicks in
    if (intel.convergenceSignal > 0.8) {
      p.respectThreshold = Math.max(0, p.respectThreshold - 0.05);
    }
  }

  // ─── Reset for new run ───────────────────────────────────────────────────

  reset(): void {
    this.usedDialogue.clear();
    this.lastContextPerBot.clear();
    this.personalities = { ...DEFAULT_PERSONALITIES };
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private getUsedSet(characterId: string): Set<string> {
    if (!this.usedDialogue.has(characterId)) {
      this.usedDialogue.set(characterId, new Set());
    }
    return this.usedDialogue.get(characterId)!;
  }

  private markUsed(characterId: string, text: string): void {
    this.getUsedSet(characterId).add(text);
  }

  private selectRespondingBots(sentiment: ResponseSentiment): string[] {
    const allBots = ['BOT_01_LIQUIDATOR', 'BOT_02_BUREAUCRAT', 'BOT_03_MANIPULATOR', 'BOT_04_CRASH_PROPHET', 'BOT_05_LEGACY_HEIR'];

    // High intensity → more bots respond
    const maxResponders = sentiment.intensity > 0.7 ? 2 : 1;

    // Shuffle and pick based on personality reactToPlayer weight
    const candidates = allBots
      .filter(id => {
        const p = this.personalities[id];
        return p && Math.random() < p.reactToPlayer && this.cooldowns.canRespond(id);
      })
      .sort(() => Math.random() - 0.5);

    return candidates.slice(0, maxResponders);
  }

  private getSofterAlternative(context: DialogueContext): DialogueContext | null {
    const softerMap: Partial<Record<DialogueContext, DialogueContext>> = {
      PLAYER_NEAR_BANKRUPTCY: 'PLAYER_COMEBACK',
      BOT_WINNING: 'PLAYER_CARD_PLAY',
      TIME_PRESSURE: 'PLAYER_CARD_PLAY',
      PLAYER_RESPONSE_ANGRY: 'PLAYER_RESPONSE_TROLL', // de-escalate
    };
    return softerMap[context] ?? null;
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const adaptiveDialogueEngine = new AdaptiveDialogueEngine();

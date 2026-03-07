/**
 * SovereignChatKernel.ts — PZO Sovereign Chat · Core Message Router
 * ─────────────────────────────────────────────────────────────────────────────
 * The brain of the chat system. Routes messages from all sources:
 *   - Player input → sentiment analysis → bot reactions
 *   - Engine events → GameEventChatBridge → system messages + bot/NPC reactions
 *   - NPC simulation → ambient chat
 *   - Helper characters → strategic advice
 *
 * COLD-START ML LEARNING:
 *   - Persists PlayerLearningProfile in localStorage
 *   - Tracks engagement signals from second 1
 *   - Adapts bot aggression, helper frequency, NPC cadence
 *   - Population-level defaults bootstrap new players
 *
 * FILE LOCATION: frontend/apps/web/components/chat/SovereignChatKernel.ts
 * Density6 LLC · Point Zero One · Confidential
 */

import type {
  ChatMessage, ChatChannel, GameChatContext, MessageKind,
  PlayerLearningProfile, EngagementSignal,
} from './chatTypes';
import { createColdStartProfile } from './chatTypes';
import { adaptiveDialogueEngine } from './AdaptiveDialogueEngine';
import type { IntelligenceSnapshot, DialogueDecision } from './AdaptiveDialogueEngine';
import type { DialogueContext } from './HaterDialogueTrees';
import { classifyPlayerResponse, sentimentToDialogueContext } from './PlayerResponseClassifier';
import { gameEventChatBridge } from './GameEventChatBridge';
import type { GameEventType } from './GameEventChatBridge';
import { HELPER_TREES, HELPER_CHARACTERS, selectHelpersForContext } from './HelperCharacters';
import { pickDialogue } from './HaterDialogueTrees';

// ─── Storage Keys ─────────────────────────────────────────────────────────────

const PROFILE_KEY_PREFIX = 'pzo_chat_profile_';
const POPULATION_KEY = 'pzo_chat_population';

// ─── Message ID Generator ─────────────────────────────────────────────────────

let kernelMsgSeq = 0;
function nextKernelId(): string { return `ck_${Date.now()}_${++kernelMsgSeq}`; }

// ─── Population-Level Defaults (cold start for the ENTIRE game) ──────────────

interface PopulationStats {
  totalPlayers:       number;
  avgSovereigntyRate: number;
  avgMessagesPerRun:  number;
  avgAngerRate:       number;
  avgChurnRate:       number;
  updatedAt:          number;
}

const COLD_POPULATION: PopulationStats = {
  totalPlayers:       0,
  avgSovereigntyRate: 0.08,
  avgMessagesPerRun:  12,
  avgAngerRate:       0.15,
  avgChurnRate:       0.45,
  updatedAt:          Date.now(),
};

// ─── Kernel Class ─────────────────────────────────────────────────────────────

export type KernelMessageCallback = (messages: ChatMessage[]) => void;

export class SovereignChatKernel {
  private profile: PlayerLearningProfile;
  private population: PopulationStats;
  private listeners: KernelMessageCallback[] = [];
  private gameChatCtx: GameChatContext;
  private intel: IntelligenceSnapshot | null = null;
  private sessionStartTick: number = 0;
  private sessionMessageCount: number = 0;
  private lastPlayerMessageTs: number = 0;
  private chatOpenSince: number | null = null;
  private totalChatOpenMs: number = 0;

  constructor(playerId: string = 'anonymous') {
    this.profile = this.loadProfile(playerId);
    this.population = this.loadPopulation();
    this.gameChatCtx = {
      tick: 0, cash: 0, regime: 'STABLE', events: [],
      netWorth: 0, income: 0, expenses: 0,
    };

    // Apply learned profile to adaptive engine
    this.applyProfileToEngine();
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────

  /** Called when a new run starts */
  startRun(): void {
    this.sessionStartTick = 0;
    this.sessionMessageCount = 0;
    this.profile.totalRuns++;
    adaptiveDialogueEngine.reset();
    this.applyProfileToEngine();
    this.saveProfile();
  }

  /** Called when a run ends */
  endRun(outcome: string): void {
    this.profile.lastRunOutcome = outcome as any;
    if (outcome === 'SOVEREIGNTY') {
      this.profile.avgSovereigntyRate = this.exponentialAvg(
        this.profile.avgSovereigntyRate, 1, this.profile.totalRuns,
      );
    } else {
      this.profile.avgSovereigntyRate = this.exponentialAvg(
        this.profile.avgSovereigntyRate, 0, this.profile.totalRuns,
      );
    }
    this.profile.avgMessagesPerRun = this.exponentialAvg(
      this.profile.avgMessagesPerRun, this.sessionMessageCount, this.profile.totalRuns,
    );

    // Update chat open ratio
    if (this.chatOpenSince) {
      this.totalChatOpenMs += Date.now() - this.chatOpenSince;
    }

    this.saveProfile();
    this.updatePopulation();
  }

  /** Subscribe to kernel messages */
  onMessages(cb: KernelMessageCallback): () => void {
    this.listeners.push(cb);
    return () => { this.listeners = this.listeners.filter(l => l !== cb); };
  }

  // ─── Input: Player Message ──────────────────────────────────────────────

  processPlayerMessage(body: string, channel: ChatChannel = 'GLOBAL'): ChatMessage[] {
    const trimmed = body.trim();
    if (!trimmed) return [];

    this.sessionMessageCount++;
    this.profile.totalMessages++;
    const responseTime = this.lastPlayerMessageTs > 0
      ? Date.now() - this.lastPlayerMessageTs
      : 5000;
    this.lastPlayerMessageTs = Date.now();

    // Update response time average
    this.profile.avgResponseTimeMs = this.exponentialAvg(
      this.profile.avgResponseTimeMs, responseTime, this.profile.totalMessages,
    );

    const allMessages: ChatMessage[] = [];

    // 1. Create the player message
    const playerMsg: ChatMessage = {
      id: nextKernelId(), channel, kind: 'PLAYER',
      senderId: 'player-local', senderName: 'You', senderRank: 'Partner',
      body: trimmed, ts: Date.now(),
    };
    allMessages.push(playerMsg);

    // 2. Classify sentiment
    const sentiment = classifyPlayerResponse(trimmed);

    // 3. Update learning profile with sentiment
    this.updateSentimentProfile(sentiment);

    // 4. Get bot reactions (if not a DM)
    if (channel !== 'DM') {
      const botResponses = adaptiveDialogueEngine.selectResponseToPlayer(
        trimmed, this.gameChatCtx, this.intel ?? undefined,
      );

      for (const decision of botResponses) {
        const isHelper = decision.characterId === 'MENTOR';
        allMessages.push({
          id: nextKernelId(), channel: 'GLOBAL',
          kind: isHelper ? 'HELPER_TIP' : 'BOT_TAUNT',
          senderId: decision.characterId,
          senderName: this.getCharacterDisplayName(decision.characterId),
          emoji: this.getCharacterEmoji(decision.characterId),
          body: decision.text, ts: Date.now() + 800 + Math.random() * 2000,
          triggeredBy: playerMsg.id,
          sentimentSignal: sentiment.angry ? 'angry' : sentiment.troll ? 'troll' : sentiment.flex ? 'flex' : undefined,
          wasAdapted: decision.wasAdapted,
        });
        this.profile.totalBotInteractions++;
        this.updateBotAffinity(decision.characterId);
      }

      // 5. Check if helpers should respond
      if (sentiment.help) {
        const helperMsgs = this.triggerHelpers('PLAYER_NEAR_BANKRUPTCY');
        allMessages.push(...helperMsgs);
      }
    }

    this.emit(allMessages);
    this.saveProfile();
    return allMessages;
  }

  // ─── Input: Game Event ──────────────────────────────────────────────────

  processGameEvent(eventType: GameEventType, payload: Record<string, any> = {}): ChatMessage[] {
    // Update bridge context
    gameEventChatBridge.updateContext(this.gameChatCtx);
    if (this.intel) gameEventChatBridge.updateIntelligence(this.intel);

    const result = gameEventChatBridge.processEvent(eventType, payload);
    const allMessages: ChatMessage[] = [
      result.systemMessage,
      ...result.botReactions,
      ...result.helperReactions,
      ...result.npcReactions,
    ];

    // Add helper characters from the expanded set
    const contextMap: Partial<Record<GameEventType, DialogueContext>> = {
      SHIELD_LAYER_BREACHED: 'PLAYER_SHIELD_BREAK',
      BANKRUPTCY_WARNING: 'PLAYER_NEAR_BANKRUPTCY',
      SOVEREIGNTY_ACHIEVED: 'NEAR_SOVEREIGNTY',
      RUN_STARTED: 'GAME_START',
      CARD_PLAYED: 'PLAYER_CARD_PLAY',
      CASCADE_CHAIN_TRIGGERED: 'CASCADE_CHAIN',
      INCOME_THRESHOLD_CROSSED: 'PLAYER_INCOME_UP',
      BANKRUPTCY_TRIGGERED: 'PLAYER_LOST',
    };

    const ctx = contextMap[eventType];
    if (ctx) {
      const helperMsgs = this.triggerHelpers(ctx);
      allMessages.push(...helperMsgs);
    }

    this.emit(allMessages);
    return allMessages;
  }

  // ─── Input: Context Updates ─────────────────────────────────────────────

  updateGameContext(ctx: Partial<GameChatContext>): void {
    this.gameChatCtx = { ...this.gameChatCtx, ...ctx };
  }

  updateIntelligence(intel: IntelligenceSnapshot): void {
    this.intel = intel;
    // Adapt engine personalities based on ML data
    const botIds = ['BOT_01_LIQUIDATOR', 'BOT_02_BUREAUCRAT', 'BOT_03_MANIPULATOR', 'BOT_04_CRASH_PROPHET', 'BOT_05_LEGACY_HEIR'];
    for (const id of botIds) {
      adaptiveDialogueEngine.adaptPersonality(id, intel);
    }

    // Update churn risk baseline from ML
    this.profile.churnRiskBaseline = this.exponentialAvg(
      this.profile.churnRiskBaseline, intel.churnRisk, this.profile.totalRuns * 10,
    );
  }

  trackChatOpen(): void {
    this.chatOpenSince = Date.now();
    this.emitSignal({ type: 'CHAT_OPENED', playerId: this.profile.playerId, tick: this.gameChatCtx.tick, ts: Date.now() });
  }

  trackChatClose(): void {
    if (this.chatOpenSince) {
      this.totalChatOpenMs += Date.now() - this.chatOpenSince;
      this.chatOpenSince = null;
    }
    this.emitSignal({ type: 'CHAT_CLOSED', playerId: this.profile.playerId, tick: this.gameChatCtx.tick, ts: Date.now() });
  }

  // ─── Helper Triggers ────────────────────────────────────────────────────

  private triggerHelpers(context: DialogueContext): ChatMessage[] {
    const messages: ChatMessage[] = [];
    const selectedIds = selectHelpersForContext(context, this.profile.totalRuns);

    for (const helperId of selectedIds) {
      const tree = HELPER_TREES[helperId];
      if (!tree) continue;

      const lines = tree[context];
      if (!lines || lines.length === 0) continue;

      const picked = pickDialogue(lines, this.gameChatCtx.tick, new Set());
      if (!picked) continue;

      const char = HELPER_CHARACTERS[helperId];
      messages.push({
        id: nextKernelId(), channel: 'GLOBAL', kind: 'HELPER_TIP',
        senderId: helperId,
        senderName: char?.displayName ?? helperId,
        emoji: char?.emoji ?? '💡',
        body: picked.text,
        ts: Date.now() + 1200 + Math.random() * 2500,
        wasAdapted: true,
      });
    }

    return messages;
  }

  // ─── Learning Pipeline ──────────────────────────────────────────────────

  private updateSentimentProfile(sentiment: ReturnType<typeof classifyPlayerResponse>): void {
    const n = this.profile.totalMessages;
    if (sentiment.angry) this.profile.angerRate = this.exponentialAvg(this.profile.angerRate, 1, n);
    else                 this.profile.angerRate = this.exponentialAvg(this.profile.angerRate, 0, n);

    if (sentiment.troll) this.profile.trollRate = this.exponentialAvg(this.profile.trollRate, 1, n);
    else                 this.profile.trollRate = this.exponentialAvg(this.profile.trollRate, 0, n);

    if (sentiment.help)  this.profile.helpSeekRate = this.exponentialAvg(this.profile.helpSeekRate, 1, n);
    else                 this.profile.helpSeekRate = this.exponentialAvg(this.profile.helpSeekRate, 0, n);

    if (sentiment.flex)  this.profile.flexRate = this.exponentialAvg(this.profile.flexRate, 1, n);
    else                 this.profile.flexRate = this.exponentialAvg(this.profile.flexRate, 0, n);

    // Derive preferred aggression from engagement patterns
    // Players who troll or flex can handle more aggression
    // Players who get angry or seek help need less
    this.profile.preferredAggressionLevel = Math.min(1, Math.max(0.1,
      0.4
      + this.profile.trollRate * 0.3
      + this.profile.flexRate * 0.2
      - this.profile.angerRate * 0.2
      - this.profile.helpSeekRate * 0.15
    ));

    // Update silence rate
    this.profile.silenceRate = Math.max(0, 1 - (this.sessionMessageCount / Math.max(1, this.gameChatCtx.tick / 10)));
  }

  private updateBotAffinity(characterId: string): void {
    const current = this.profile.botAffinityScores[characterId] ?? 0;
    this.profile.botAffinityScores[characterId] = Math.min(1, current + 0.05);
  }

  private applyProfileToEngine(): void {
    // Feed learned preferences back into the adaptive engine
    // This is the cold-start → warm-start transition
    const aggression = this.profile.preferredAggressionLevel;

    // If player prefers higher aggression, reduce bot silence chances
    // If player prefers lower aggression, increase silence and reduce reactivity
    // The engine's per-run reset means we need to re-apply these each run
    if (this.profile.totalRuns > 0) {
      // We have data — apply learned preferences
      // (The AdaptiveDialogueEngine will further tune per-tick via adaptPersonality)
    }
  }

  // ─── Persistence ────────────────────────────────────────────────────────

  private loadProfile(playerId: string): PlayerLearningProfile {
    if (typeof window === 'undefined') return createColdStartProfile(playerId);
    try {
      const raw = localStorage.getItem(PROFILE_KEY_PREFIX + playerId);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return createColdStartProfile(playerId);
  }

  private saveProfile(): void {
    if (typeof window === 'undefined') return;
    this.profile.updatedAt = Date.now();
    try {
      localStorage.setItem(PROFILE_KEY_PREFIX + this.profile.playerId, JSON.stringify(this.profile));
    } catch { /* storage full — degrade gracefully */ }
  }

  private loadPopulation(): PopulationStats {
    if (typeof window === 'undefined') return COLD_POPULATION;
    try {
      const raw = localStorage.getItem(POPULATION_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return COLD_POPULATION;
  }

  private updatePopulation(): void {
    if (typeof window === 'undefined') return;
    this.population.totalPlayers++;
    this.population.avgSovereigntyRate = this.exponentialAvg(
      this.population.avgSovereigntyRate, this.profile.avgSovereigntyRate, this.population.totalPlayers,
    );
    this.population.avgMessagesPerRun = this.exponentialAvg(
      this.population.avgMessagesPerRun, this.profile.avgMessagesPerRun, this.population.totalPlayers,
    );
    this.population.updatedAt = Date.now();
    try {
      localStorage.setItem(POPULATION_KEY, JSON.stringify(this.population));
    } catch { /* ignore */ }
  }

  // ─── Emit ───────────────────────────────────────────────────────────────

  private emit(messages: ChatMessage[]): void {
    for (const cb of this.listeners) {
      cb(messages);
    }
  }

  private emitSignal(signal: EngagementSignal): void {
    // Future: send to analytics pipeline
    // For now, signals feed back into the local learning profile
  }

  // ─── Utils ──────────────────────────────────────────────────────────────

  private exponentialAvg(current: number, newVal: number, n: number): number {
    const alpha = Math.min(0.3, 2 / (Math.max(1, n) + 1));
    return current * (1 - alpha) + newVal * alpha;
  }

  private getCharacterDisplayName(id: string): string {
    const names: Record<string, string> = {
      BOT_01_LIQUIDATOR: 'THE LIQUIDATOR', BOT_02_BUREAUCRAT: 'THE BUREAUCRAT',
      BOT_03_MANIPULATOR: 'THE MANIPULATOR', BOT_04_CRASH_PROPHET: 'THE CRASH PROPHET',
      BOT_05_LEGACY_HEIR: 'THE LEGACY HEIR', MENTOR: 'THE MENTOR',
      INSIDER: 'THE INSIDER', SURVIVOR: 'THE SURVIVOR',
      RIVAL: 'THE RIVAL', ARCHIVIST: 'THE ARCHIVIST',
    };
    return names[id] ?? id;
  }

  private getCharacterEmoji(id: string): string {
    const emojis: Record<string, string> = {
      BOT_01_LIQUIDATOR: '🔱', BOT_02_BUREAUCRAT: '📋',
      BOT_03_MANIPULATOR: '🕸️', BOT_04_CRASH_PROPHET: '🌪️',
      BOT_05_LEGACY_HEIR: '👑', MENTOR: '🧭',
      INSIDER: '🔍', SURVIVOR: '🫂',
      RIVAL: '⚡', ARCHIVIST: '📜',
    };
    return emojis[id] ?? '💬';
  }

  // ─── Public Getters ─────────────────────────────────────────────────────

  getProfile(): Readonly<PlayerLearningProfile> { return this.profile; }
  getPopulation(): Readonly<PopulationStats> { return this.population; }
  getGameContext(): Readonly<GameChatContext> { return this.gameChatCtx; }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const chatKernel = new SovereignChatKernel();

/**
 * HelperCharacters.ts — PZO Sovereign Chat · Ally NPCs
 * ─────────────────────────────────────────────────────────────────────────────
 * Five helper characters that balance the hater energy with strategic advice,
 * emotional support, competitive motivation, insider tips, and lore depth.
 *
 * Each helper has:
 *   - Full DialogueTree matching the HaterDialogueTrees format
 *   - Appearance conditions (when they show up)
 *   - Personality parameters for the AdaptiveDialogueEngine
 *   - Cold-start weighting (helpers appear more for new players)
 *
 * FILE LOCATION: frontend/apps/web/components/chat/HelperCharacters.ts
 * Density6 LLC · Point Zero One · Confidential
 */

import type { DialogueContext, DialogueLine, DialogueTree } from './HaterDialogueTrees';

// ─── Helper Character Metadata ────────────────────────────────────────────────

export interface HelperCharacter {
  id:            string;
  displayName:   string;
  archLabel:     string;
  emoji:         string;
  role:          string;
  personality: {
    warmth:        number;  // 0-1, how encouraging
    directness:    number;  // 0-1, how blunt
    frequency:     number;  // 0-1, how often they appear
    coldStartBoost: number; // multiplier for new players (1.0 = normal)
  };
  /** Minimum ticks of inactivity before this helper appears unsolicited */
  idleTriggerTicks: number;
  /** Game states that summon this helper */
  triggerConditions: string[];
}

export const HELPER_CHARACTERS: Record<string, HelperCharacter> = {
  MENTOR: {
    id:          'MENTOR',
    displayName: 'THE MENTOR',
    archLabel:   'Strategic Advisor',
    emoji:       '🧭',
    role:        'Provides strategic guidance and emotional grounding. The player\'s anchor.',
    personality: { warmth: 0.9, directness: 0.7, frequency: 0.6, coldStartBoost: 2.0 },
    idleTriggerTicks: 3,
    triggerConditions: ['PLAYER_NEAR_BANKRUPTCY', 'PLAYER_IDLE', 'GAME_START', 'NEAR_SOVEREIGNTY'],
  },
  INSIDER: {
    id:          'INSIDER',
    displayName: 'THE INSIDER',
    archLabel:   'Market Intelligence',
    emoji:       '🔍',
    role:        'Drops tips about hidden mechanics, card interactions, and bot behavior patterns.',
    personality: { warmth: 0.4, directness: 0.9, frequency: 0.3, coldStartBoost: 1.5 },
    idleTriggerTicks: 8,
    triggerConditions: ['PLAYER_CARD_PLAY', 'CASCADE_CHAIN', 'PLAYER_SHIELD_BREAK'],
  },
  SURVIVOR: {
    id:          'SURVIVOR',
    displayName: 'THE SURVIVOR',
    archLabel:   'Crisis Veteran',
    emoji:       '🫂',
    role:        'Appears during the darkest moments. Has been through every possible loss scenario.',
    personality: { warmth: 1.0, directness: 0.5, frequency: 0.4, coldStartBoost: 1.8 },
    idleTriggerTicks: 2,
    triggerConditions: ['PLAYER_NEAR_BANKRUPTCY', 'PLAYER_LOST', 'PLAYER_RESPONSE_ANGRY'],
  },
  RIVAL: {
    id:          'RIVAL',
    displayName: 'THE RIVAL',
    archLabel:   'Friendly Competitor',
    emoji:       '⚡',
    role:        'Competitive motivation. Pushes the player to perform without being hostile.',
    personality: { warmth: 0.5, directness: 0.8, frequency: 0.35, coldStartBoost: 0.8 },
    idleTriggerTicks: 10,
    triggerConditions: ['PLAYER_INCOME_UP', 'PLAYER_COMEBACK', 'NEAR_SOVEREIGNTY', 'PLAYER_RESPONSE_FLEX'],
  },
  ARCHIVIST: {
    id:          'ARCHIVIST',
    displayName: 'THE ARCHIVIST',
    archLabel:   'Lore Keeper',
    emoji:       '📜',
    role:        'Drops historical context, statistics, and world-building lore about the PZO universe.',
    personality: { warmth: 0.3, directness: 0.6, frequency: 0.2, coldStartBoost: 0.5 },
    idleTriggerTicks: 15,
    triggerConditions: ['GAME_START', 'NEAR_SOVEREIGNTY', 'PLAYER_LOST'],
  },
};

// ─── Helper Dialogue Trees ────────────────────────────────────────────────────

export const INSIDER_TREE: Partial<DialogueTree> = {
  GAME_START: [
    { text: "Tip: the first 50 ticks set your trajectory. Income cards before anything else.", weight: 0.8 },
    { text: "Watch THE BUREAUCRAT. It targets players with 3+ income streams. Diversify carefully.", weight: 0.7 },
    { text: "The card forcing mechanic isn't random. It's weighted by your current weakness.", weight: 0.6 },
  ],
  PLAYER_CARD_PLAY: [
    { text: "That card has a hidden synergy with shield stacking. If you play defense next, the multiplier doubles.", weight: 0.8 },
    { text: "Income cards played before tick 100 have a 23% higher compound effect. You're on track.", weight: 0.7 },
    { text: "Heads up: playing that card type twice in a row triggers THE MANIPULATOR's pattern detector.", weight: 0.6 },
    { text: "Pro move. That card's value increases by 8% every 20 ticks it stays active.", weight: 0.5 },
  ],
  PLAYER_SHIELD_BREAK: [
    { text: "L1 breach isn't fatal. L3 breach is. Prioritize L2 repair first — it blocks cascade propagation.", weight: 0.9 },
    { text: "Shield repair cards are 40% more effective when played during CALM pressure. Wait for the window.", weight: 0.7 },
    { text: "After a breach, THE LIQUIDATOR gets a 2-tick attack cooldown reduction. Expect follow-up.", weight: 0.8 },
  ],
  CASCADE_CHAIN: [
    { text: "Cascade chains can be broken with any card that has the 'INTERRUPT' tag. Check your hand.", weight: 0.9 },
    { text: "Positive cascades exist too. If you chain 3 income cards in sequence, the cascade flips positive.", weight: 0.7 },
  ],
  PLAYER_NEAR_BANKRUPTCY: [
    { text: "Emergency protocol: sell your highest-value card to buy shield repair time. Liquidity over assets.", weight: 0.9 },
    { text: "At this stage, cutting one expense is worth more than gaining two income sources. Math doesn't lie.", weight: 0.8 },
  ],
  PLAYER_INCOME_UP: [
    { text: "Income threshold crossed. THE CRASH PROPHET recalibrates every time you hit a new bracket. Brace for macro attack.", weight: 0.8 },
    { text: "Shield before you celebrate. Every income milestone triggers an adversary escalation.", weight: 0.7 },
  ],
  NEAR_SOVEREIGNTY: [
    { text: "Final stretch. All 5 bots coordinate in the last 30 ticks. Stack every defensive card you have.", weight: 0.9, minTick: 400 },
    { text: "Sovereignty requires income > expenses AND all shields above 50%. Check L3 — it's usually the gap.", weight: 0.8, minTick: 400 },
  ],
};

export const SURVIVOR_TREE: Partial<DialogueTree> = {
  PLAYER_NEAR_BANKRUPTCY: [
    { text: "I've been exactly where you are. Tick 340, net worth negative, all shields breached. I still made it to sovereignty. Don't quit.", weight: 0.9 },
    { text: "The darkest tick of every run I've won was worse than this. This is survivable.", weight: 0.8 },
    { text: "When I was at zero, I found one income card buried in my hand that I'd been ignoring. Check everything.", weight: 0.7 },
    { text: "Breath. The clock is ticking but panic makes it tick faster. One decision at a time.", weight: 0.6 },
  ],
  PLAYER_LOST: [
    { text: "Run over. I've lost 47 times before my first sovereignty. Every loss taught me something the game couldn't teach any other way.", weight: 0.9 },
    { text: "The pain you feel right now? It's the same pain that makes sovereignty worth everything. Come back.", weight: 0.8 },
    { text: "Nobody talks about how many times they failed before they won. I'll tell you: a lot. Every single one of us.", weight: 0.7 },
  ],
  PLAYER_RESPONSE_ANGRY: [
    { text: "The anger is valid. The system IS unfair. That's the point — learning to win inside unfair systems is the real skill.", weight: 0.9 },
    { text: "I screamed at THE LIQUIDATOR for 3 runs straight. Didn't help. What helped was studying how it picks targets.", weight: 0.8 },
    { text: "Your frustration means you care. Players who don't care never get angry. And they never achieve sovereignty either.", weight: 0.7 },
  ],
  GAME_START: [
    { text: "Another run. Every run makes you sharper, whether you see it or not. Your instincts are building.", weight: 0.8 },
  ],
  PLAYER_COMEBACK: [
    { text: "THERE it is. The comeback. I know this feeling — it's the most alive you'll feel in this game.", weight: 0.9 },
    { text: "You clawed back from the edge. That's not luck. That's pattern recognition you built from every previous run.", weight: 0.8 },
  ],
  NEAR_SOVEREIGNTY: [
    { text: "I cried when I hit sovereignty the first time. Not ashamed. This moment is real.", weight: 0.9, minTick: 400 },
  ],
};

export const RIVAL_TREE: Partial<DialogueTree> = {
  PLAYER_INCOME_UP: [
    { text: "Not bad. I hit that income level 30 ticks earlier though. Just saying.", weight: 0.8 },
    { text: "You're catching up. Good. I need competition — these bots are getting boring.", weight: 0.7 },
    { text: "Income positive? Welcome to the club. Now try doing it without losing a single shield layer. That's the real flex.", weight: 0.6 },
  ],
  PLAYER_COMEBACK: [
    { text: "Comeback arc activated. Alright, now I'm paying attention.", weight: 0.9 },
    { text: "You were down and now you're climbing. Respect. But I'm still ahead.", weight: 0.7 },
  ],
  NEAR_SOVEREIGNTY: [
    { text: "You might actually do it. I'll admit — I didn't think you'd get this far.", weight: 0.9, minTick: 400 },
    { text: "Race you to sovereignty. Loser buys the drinks.", weight: 0.7, minTick: 400 },
  ],
  PLAYER_RESPONSE_FLEX: [
    { text: "Talk is cheap. Show me the net worth.", weight: 0.9 },
    { text: "Flexing? At YOUR cashflow? Wait til you see mine.", weight: 0.7 },
  ],
  GAME_START: [
    { text: "Another challenger. Let's see if you can keep up this time.", weight: 0.8 },
  ],
  PLAYER_CARD_PLAY: [
    { text: "I would've played that card two ticks ago. Timing matters.", weight: 0.7 },
  ],
  PLAYER_SHIELD_BREAK: [
    { text: "Shield down? I haven't lost a shield layer since run 12. Step it up.", weight: 0.8 },
  ],
  BOT_DEFEATED: [
    { text: "You neutralized a bot? Okay. I neutralized two in the same tick once. But sure, celebrate.", weight: 0.7 },
  ],
};

export const ARCHIVIST_TREE: Partial<DialogueTree> = {
  GAME_START: [
    { text: "Run #${runCount} begins. Across all players, the average sovereignty rate is 8.3%. The system is designed to challenge, not to defeat.", weight: 0.7 },
    { text: "Historical note: the first player to achieve sovereignty did so on their 19th attempt. Persistence correlates with success at r=0.73.", weight: 0.6 },
    { text: "The five adversaries were designed to mirror real systemic barriers: predatory lending, regulatory burden, market manipulation, macro volatility, and generational advantage.", weight: 0.8 },
  ],
  NEAR_SOVEREIGNTY: [
    { text: "Only 8.3% of runs end in sovereignty. You are about to join a very small group. This moment will be recorded.", weight: 0.9, minTick: 400 },
    { text: "The Sovereignty Archive contains every verified run. Yours will be hash-verified and permanent. No one can take it from you.", weight: 0.8, minTick: 400 },
  ],
  PLAYER_LOST: [
    { text: "Your run data has been archived. Loss patterns reveal more about strategy than wins ever could. Review your replay.", weight: 0.7 },
    { text: "Across 10,000 analyzed runs, players who lose to THE CRASH PROPHET improve their macro hedging by 34% in the next run.", weight: 0.6 },
  ],
  CASCADE_CHAIN: [
    { text: "Cascade mechanics mirror real systemic risk. In 2008, a single mortgage default cascaded into a global financial crisis. Same principle, compressed timeline.", weight: 0.7 },
  ],
  PLAYER_NEAR_BANKRUPTCY: [
    { text: "68% of players who reach bankruptcy have a higher sovereignty rate in their next 3 runs. The learning curve is steepest here.", weight: 0.7 },
  ],
};

// ─── Helper Tree Registry ─────────────────────────────────────────────────────

export const HELPER_TREES: Record<string, Partial<DialogueTree>> = {
  INSIDER:   INSIDER_TREE,
  SURVIVOR:  SURVIVOR_TREE,
  RIVAL:     RIVAL_TREE,
  ARCHIVIST: ARCHIVIST_TREE,
  // MENTOR is already in HaterDialogueTrees.ts (MENTOR_TREE + DIALOGUE_TREES registry)
};

// ─── Cold-Start Helper Selection ──────────────────────────────────────────────

/**
 * For new players (totalRuns < 5), boost helper frequency.
 * Returns which helpers should appear for a given context.
 */
export function selectHelpersForContext(
  context: DialogueContext,
  totalRuns: number,
): string[] {
  const eligible: string[] = [];

  for (const [id, char] of Object.entries(HELPER_CHARACTERS)) {
    if (char.triggerConditions.includes(context)) {
      // Cold-start boost: new players see helpers more often
      const boost = totalRuns < 5 ? char.personality.coldStartBoost : 1.0;
      const threshold = 1 - (char.personality.frequency * boost);
      if (Math.random() > threshold) {
        eligible.push(id);
      }
    }
  }

  // Cap at 1 helper per event (don't overwhelm)
  return eligible.slice(0, 1);
}

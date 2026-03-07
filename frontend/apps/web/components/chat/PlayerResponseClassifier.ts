/**
 * PlayerResponseClassifier.ts — PZO Sovereign Chat
 * Lightweight client-side sentiment classification for player messages.
 * Determines how bots and the game react to player chat input.
 * Density6 LLC · Point Zero One · Confidential
 */

// ─── Response Sentiment ───────────────────────────────────────────────────────

export interface ResponseSentiment {
  angry:      boolean;
  troll:      boolean;
  help:       boolean;
  flex:       boolean;
  strategic:  boolean;
  social:     boolean;
  intensity:  number;  // 0-1, how strong the signal is
  raw:        string;
}

// ─── Pattern Sets ─────────────────────────────────────────────────────────────

const ANGRY_PATTERNS: RegExp[] = [
  /shut\s*up/i, /stfu/i, /f+u+c+k/i, /bs|bullshit/i, /hate\s*(this|you|game)/i,
  /unfair/i, /cheat(ing|er|s)?/i, /rigged/i, /broken/i, /stupid/i,
  /wtf/i, /trash/i, /garbage/i, /worst/i, /impossible/i,
  /screw\s*(you|this|that)/i, /done\s*with\s*this/i, /rage/i,
  /can'?t\s*win/i, /give\s*up/i, /over\s*it/i, /so\s*mad/i,
  /😡|🤬|💢|🖕/,
];

const TROLL_PATTERNS: RegExp[] = [
  /lol|lmao|rofl|haha/i, /cope|seethe|mald/i, /ratio/i,
  /ez|easy/i, /skill\s*issue/i, /get\s*good/i, /no\s*cap/i,
  /gg\s*ez/i, /imagine/i, /crying/i, /stay\s*mad/i,
  /rent\s*free/i, /touch\s*grass/i, /clown/i, /L\s*bot/i,
  /you'?re?\s*not\s*real/i, /ai\s*moment/i,
  /🤡|💀|😂|🤣|😭/,
];

const HELP_PATTERNS: RegExp[] = [
  /help/i, /how\s*(do|can|should)/i, /what\s*should\s*I/i,
  /hint/i, /tip(s)?/i, /advice/i, /confused/i, /stuck/i,
  /don'?t\s*understand/i, /explain/i, /what\s*(is|are|does)/i,
  /strategy/i, /recommend/i, /suggest/i,
  /🤔|❓|🆘/,
];

const FLEX_PATTERNS: RegExp[] = [
  /let'?s\s*go/i, /watch\s*(this|me)/i, /too\s*easy/i,
  /i'?m?\s*(the\s*)?best/i, /crush(ing|ed)/i, /dominat/i,
  /unstoppable/i, /on\s*fire/i, /money\s*printer/i,
  /sovereignty\s*(time|bound|incoming)/i, /built\s*different/i,
  /can'?t\s*stop\s*me/i, /i\s*got\s*this/i, /easy\s*money/i,
  /🔥|💪|👑|🚀|💰|📈/,
];

const STRATEGIC_PATTERNS: RegExp[] = [
  /should\s*(I|we)\s*(buy|sell|play|hold|stack)/i,
  /what\s*card/i, /which\s*(mode|path|option)/i,
  /shield\s*(first|stack)/i, /income\s*before/i,
  /hedge/i, /diversif/i, /optimize/i, /efficient/i,
  /ROI/i, /compound/i, /passive/i,
];

const SOCIAL_PATTERNS: RegExp[] = [
  /anyone/i, /who\s*else/i, /good\s*(game|run|play)/i,
  /gg/i, /nice/i, /congrats/i, /gl|good\s*luck/i,
  /welcome/i, /hey|hi|hello|yo|sup/i,
  /team/i, /together/i, /partner/i,
  /👋|🤝|✌️/,
];

// ─── Classifier ───────────────────────────────────────────────────────────────

export function classifyPlayerResponse(text: string): ResponseSentiment {
  const angry     = ANGRY_PATTERNS.some(p => p.test(text));
  const troll     = TROLL_PATTERNS.some(p => p.test(text));
  const help      = HELP_PATTERNS.some(p => p.test(text));
  const flex      = FLEX_PATTERNS.some(p => p.test(text));
  const strategic = STRATEGIC_PATTERNS.some(p => p.test(text));
  const social    = SOCIAL_PATTERNS.some(p => p.test(text));

  // Count pattern matches for intensity
  const angryHits = ANGRY_PATTERNS.filter(p => p.test(text)).length;
  const trollHits = TROLL_PATTERNS.filter(p => p.test(text)).length;
  const flexHits  = FLEX_PATTERNS.filter(p => p.test(text)).length;
  const totalHits = angryHits + trollHits + flexHits;
  const intensity = Math.min(1, totalHits / 5);

  // Caps lock detection amplifies intensity
  const capsRatio = text.replace(/[^A-Za-z]/g, '').length > 0
    ? (text.replace(/[^A-Z]/g, '').length / text.replace(/[^A-Za-z]/g, '').length)
    : 0;

  const capsBoost = capsRatio > 0.6 ? 0.3 : 0;

  return {
    angry,
    troll,
    help,
    flex,
    strategic,
    social,
    intensity: Math.min(1, intensity + capsBoost),
    raw: text,
  };
}

// ─── Response Context (maps sentiment → DialogueContext) ──────────────────────

import type { DialogueContext } from './HaterDialogueTrees';

export function sentimentToDialogueContext(
  sentiment: ResponseSentiment,
): DialogueContext | null {
  if (sentiment.angry)  return 'PLAYER_RESPONSE_ANGRY';
  if (sentiment.troll)  return 'PLAYER_RESPONSE_TROLL';
  if (sentiment.flex)   return 'PLAYER_RESPONSE_FLEX';
  return null;
}

// ─── Cooldown Manager (prevent bot spam in response to player messages) ──────

export class ResponseCooldownManager {
  private lastResponse: Map<string, number> = new Map();
  private readonly cooldownMs: number;

  constructor(cooldownMs = 3000) {
    this.cooldownMs = cooldownMs;
  }

  canRespond(botId: string): boolean {
    const last = this.lastResponse.get(botId) ?? 0;
    return Date.now() - last > this.cooldownMs;
  }

  markResponded(botId: string): void {
    this.lastResponse.set(botId, Date.now());
  }

  /** Vary cooldown by intensity — angrier players get faster bot responses */
  getCooldownForIntensity(intensity: number): number {
    // High intensity = shorter cooldown (bots fire back faster)
    // Low intensity = longer cooldown (bots don't waste breath)
    return Math.max(1500, this.cooldownMs * (1 - intensity * 0.5));
  }
}

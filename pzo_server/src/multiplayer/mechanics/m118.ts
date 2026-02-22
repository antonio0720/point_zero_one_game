/**
 * M118 — Clip Remix Chains (Duet/Stitch But Verified) — Multiplayer Layer
 * Source spec: mechanics/M118_clip_remix_chains_duet_stitch_but_verified.md
 *
 * Deploy to: pzo_server/src/multiplayer/mechanics/m118.ts
 */

import { createHash } from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RemixType = 'REACT' | 'ANNOTATE' | 'COUNTER_GHOST';

export type RemixStatus = 'PENDING_VERIFY' | 'VERIFIED' | 'REJECTED' | 'QUARANTINED';

export interface SourceClip {
  clipId: string;
  runSeed: string;
  ownerAccountId: string;
  momentType: 'OPPORTUNITY_FLIP' | 'FUBAR_KILLED_ME' | 'MISSED_THE_BAG';
  proofHash: string;       // M50 proof hash
  createdAtTick: number;
  isPrivate: boolean;
}

export interface RemixClip {
  remixId: string;
  sourceClipId: string;
  remixerAccountId: string;
  remixType: RemixType;
  annotation: string | null;    // for ANNOTATE
  counterRunSeed: string | null; // for COUNTER_GHOST (different seed branch)
  counterProofHash: string | null;
  inheritedProofHash: string;   // from source; proves remix is real
  chainDepth: number;           // how many remixes deep (max enforced)
  status: RemixStatus;
  createdAtTick: number;
  verifiedAtTick: number | null;
}

export interface RemixChain {
  originClipId: string;
  clips: RemixClip[];
  totalDepth: number;
}

export interface RemixLedgerEvent {
  rule: 'M118';
  rule_version: '1.0';
  eventType: 'REMIX_CREATE' | 'REMIX_VERIFY' | 'REMIX_REJECT' | 'REMIX_QUARANTINE';
  remixId: string;
  remixerAccountId: string;
  tick: number;
  auditHash: string;
  payload: Record<string, unknown>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_CHAIN_DEPTH = 5;            // max remix-of-remix depth
const MAX_REMIXES_PER_HOUR = 10;      // rate limit per account
const MAX_ANNOTATION_LEN = 280;       // characters
const HARASSMENT_COOLDOWN_TICKS = 20; // ticks before re-remixing same source

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function auditHash(payload: unknown): string {
  return sha256(JSON.stringify(payload)).slice(0, 32);
}

function ledgerEvent(
  eventType: RemixLedgerEvent['eventType'],
  remixId: string,
  remixerAccountId: string,
  tick: number,
  payload: Record<string, unknown>,
): RemixLedgerEvent {
  return {
    rule: 'M118',
    rule_version: '1.0',
    eventType,
    remixId,
    remixerAccountId,
    tick,
    auditHash: auditHash({ eventType, remixId, remixerAccountId, tick, payload }),
    payload,
  };
}

// ─── Validation ───────────────────────────────────────────────────────────────

export function validateRemixEligibility(
  source: SourceClip,
  remixerAccountId: string,
  remixType: RemixType,
  annotation: string | null,
  chainDepth: number,
  remixerHourlyCount: number,
  lastRemixOfSourceByAccount: number | null, // tick of last remix, or null
  currentTick: number,
): string | null {
  if (source.isPrivate) return 'SOURCE_IS_PRIVATE';
  if (chainDepth >= MAX_CHAIN_DEPTH) return `MAX_CHAIN_DEPTH_EXCEEDED: ${MAX_CHAIN_DEPTH}`;
  if (remixerHourlyCount >= MAX_REMIXES_PER_HOUR) return 'RATE_LIMIT_EXCEEDED';
  if (annotation && annotation.length > MAX_ANNOTATION_LEN) return `ANNOTATION_TOO_LONG: max ${MAX_ANNOTATION_LEN} chars`;
  if (
    lastRemixOfSourceByAccount !== null &&
    currentTick - lastRemixOfSourceByAccount < HARASSMENT_COOLDOWN_TICKS
  ) {
    return `HARASSMENT_COOLDOWN: wait ${HARASSMENT_COOLDOWN_TICKS - (currentTick - lastRemixOfSourceByAccount)} ticks`;
  }
  if (remixType === 'COUNTER_GHOST' && remixerAccountId === source.ownerAccountId) {
    return 'CANNOT_COUNTER_OWN_CLIP';
  }
  return null;
}

// ─── Core API ─────────────────────────────────────────────────────────────────

/**
 * Create a remix clip from a source clip.
 * Status starts PENDING_VERIFY; verifier confirms proof lineage.
 */
export function createRemix(
  source: SourceClip,
  remixerAccountId: string,
  remixType: RemixType,
  tick: number,
  annotation: string | null = null,
  counterRunSeed: string | null = null,
  counterProofHash: string | null = null,
  chainDepth: number = 1,
  remixerHourlyCount: number = 0,
  lastRemixOfSourceByAccount: number | null = null,
): { remix: RemixClip; event: RemixLedgerEvent } | { error: string } {
  const eligErr = validateRemixEligibility(
    source,
    remixerAccountId,
    remixType,
    annotation,
    chainDepth,
    remixerHourlyCount,
    lastRemixOfSourceByAccount,
    tick,
  );
  if (eligErr) return { error: eligErr };

  if (remixType === 'COUNTER_GHOST' && (!counterRunSeed || !counterProofHash)) {
    return { error: 'COUNTER_GHOST_REQUIRES_PROOF' };
  }

  const remixId = sha256(
    `remix:${source.clipId}:${remixerAccountId}:${remixType}:${tick}`,
  ).slice(0, 20);

  const remix: RemixClip = {
    remixId,
    sourceClipId: source.clipId,
    remixerAccountId,
    remixType,
    annotation,
    counterRunSeed,
    counterProofHash,
    inheritedProofHash: source.proofHash,
    chainDepth,
    status: 'PENDING_VERIFY',
    createdAtTick: tick,
    verifiedAtTick: null,
  };

  const event = ledgerEvent('REMIX_CREATE', remixId, remixerAccountId, tick, {
    sourceClipId: source.clipId,
    remixType,
    chainDepth,
    inheritedProofHash: source.proofHash,
  });

  return { remix, event };
}

/**
 * Verify a remix clip — confirms proof lineage is intact.
 * Called by verifier-service after replay check.
 */
export function verifyRemix(
  remix: RemixClip,
  verifiedProofHash: string,
  tick: number,
): { remix: RemixClip; event: RemixLedgerEvent } | { error: string } {
  if (remix.status !== 'PENDING_VERIFY') return { error: 'NOT_PENDING_VERIFY' };
  if (verifiedProofHash !== remix.inheritedProofHash) return { error: 'PROOF_HASH_MISMATCH' };

  const updated: RemixClip = { ...remix, status: 'VERIFIED', verifiedAtTick: tick };
  const event = ledgerEvent('REMIX_VERIFY', remix.remixId, remix.remixerAccountId, tick, {
    verifiedProofHash,
    chainDepth: remix.chainDepth,
  });

  return { remix: updated, event };
}

/**
 * Reject a remix (proof broken, policy violation, etc).
 */
export function rejectRemix(
  remix: RemixClip,
  reason: string,
  tick: number,
): { remix: RemixClip; event: RemixLedgerEvent } {
  const updated: RemixClip = { ...remix, status: 'REJECTED' };
  const event = ledgerEvent('REMIX_REJECT', remix.remixId, remix.remixerAccountId, tick, { reason });
  return { remix: updated, event };
}

/**
 * Quarantine a remix chain for harassment loop detection.
 */
export function quarantineRemix(
  remix: RemixClip,
  reason: string,
  tick: number,
): { remix: RemixClip; event: RemixLedgerEvent } {
  const updated: RemixClip = { ...remix, status: 'QUARANTINED' };
  const event = ledgerEvent('REMIX_QUARANTINE', remix.remixId, remix.remixerAccountId, tick, { reason });
  return { remix: updated, event };
}

/**
 * Build the full chain view for a given origin clip.
 * Used for UI rendering of the "duet/stitch" thread.
 */
export function buildRemixChain(originClipId: string, allRemixes: RemixClip[]): RemixChain {
  // BFS from origin
  const verified = allRemixes.filter(r => r.status === 'VERIFIED');
  const bySource: Record<string, RemixClip[]> = {};
  for (const r of verified) {
    if (!bySource[r.sourceClipId]) bySource[r.sourceClipId] = [];
    bySource[r.sourceClipId].push(r);
  }

  const chain: RemixClip[] = [];
  const queue: string[] = [originClipId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const children = bySource[current] ?? [];
    chain.push(...children);
    queue.push(...children.map(c => c.remixId));
  }

  return {
    originClipId,
    clips: chain,
    totalDepth: chain.length > 0 ? Math.max(...chain.map(c => c.chainDepth)) : 0,
  };
}

/**
 * M118 — Clip Remix Chains (Duet/Stitch But Verified)
 * PZO_T00232 | Phase: PZO_P04_MULTIPLAYER
 * File: pzo_server/src/multiplayer/mechanics/m118.ts
 */

export type RemixStatus = 'pending_verification' | 'verified' | 'rejected' | 'chained';
export type RemixType = 'duet' | 'stitch' | 'response' | 'counter';

export interface ClipOrigin {
  clipId: string;
  ownerId: string;
  createdTurn: number;
  contentHash: string;      // deterministic hash of clip content for tamper-proof chaining
  mechanicId: string;       // which PZO mechanic this clip demonstrates
  verifiedSkillBP: number;  // skill basis points awarded on verification
}

export interface RemixLink {
  remixId: string;
  parentClipId: string;
  remixClipId: string;
  remixerId: string;
  remixType: RemixType;
  status: RemixStatus;
  chainDepth: number;       // 0 = original, 1 = first remix, etc.
  createdTurn: number;
  verifiedTurn?: number;
  rewardMultiplier: number; // increases with chain depth (capped)
  chainHash: string;        // hash(parentChainHash + remixClipId)
}

export interface RemixChain {
  chainId: string;
  tableId: string;
  rootClipId: string;
  links: RemixLink[];
  totalChainLength: number;
  maxChainDepth: number;    // configurable cap
  rewardPool: number;       // total rewards distributed from this chain
  participantIds: Set<string>;
}

const MAX_CHAIN_DEPTH = 7;
const BASE_REWARD_BP = 100;
const DEPTH_MULTIPLIER = 1.15; // 15% bonus per chain depth

export function initChain(
  chainId: string,
  tableId: string,
  rootClip: ClipOrigin
): RemixChain {
  return {
    chainId,
    tableId,
    rootClipId: rootClip.clipId,
    links: [],
    totalChainLength: 1,
    maxChainDepth: MAX_CHAIN_DEPTH,
    rewardPool: 0,
    participantIds: new Set([rootClip.ownerId]),
  };
}

export function addRemix(
  chain: RemixChain,
  remixId: string,
  parentClipId: string,
  remixClipId: string,
  remixerId: string,
  remixType: RemixType,
  currentTurn: number
): { ok: boolean; link?: RemixLink; reason?: string } {
  // Find parent depth
  const parentLink = chain.links.find(l => l.remixClipId === parentClipId);
  const parentDepth = parentLink ? parentLink.chainDepth : 0;
  const newDepth = parentDepth + 1;

  if (newDepth > chain.maxChainDepth) {
    return { ok: false, reason: `chain_depth_exceeded_max_${chain.maxChainDepth}` };
  }

  // Prevent self-remix of own clip in same depth
  const siblingsByRemixer = chain.links.filter(
    l => l.remixerId === remixerId && l.chainDepth === newDepth
  );
  if (siblingsByRemixer.length >= 2) {
    return { ok: false, reason: 'remixer_exceeded_sibling_limit' };
  }

  const parentHash = parentLink?.chainHash ?? parentClipId;
  const chainHash = simpleHash(parentHash + remixClipId);
  const rewardMultiplier = Math.min(
    parseFloat((Math.pow(DEPTH_MULTIPLIER, newDepth)).toFixed(4)),
    3.0  // cap at 3x
  );

  const link: RemixLink = {
    remixId,
    parentClipId,
    remixClipId,
    remixerId,
    remixType,
    status: 'pending_verification',
    chainDepth: newDepth,
    createdTurn: currentTurn,
    rewardMultiplier,
    chainHash,
  };

  chain.links.push(link);
  chain.participantIds.add(remixerId);
  chain.totalChainLength++;

  return { ok: true, link };
}

export function verifyRemix(
  chain: RemixChain,
  remixId: string,
  verifiedTurn: number,
  baseReward: number
): { ok: boolean; reward: number; reason?: string } {
  const link = chain.links.find(l => l.remixId === remixId);
  if (!link) return { ok: false, reward: 0, reason: 'remix_not_found' };
  if (link.status !== 'pending_verification') return { ok: false, reward: 0, reason: 'already_processed' };

  link.status = 'verified';
  link.verifiedTurn = verifiedTurn;

  const reward = Math.round(baseReward * (BASE_REWARD_BP / 10000) * link.rewardMultiplier);
  chain.rewardPool += reward;

  // Mark parent as chained
  const parentLink = chain.links.find(l => l.remixClipId === link.parentClipId);
  if (parentLink && parentLink.status === 'verified') {
    parentLink.status = 'chained';
  }

  return { ok: true, reward };
}

export function rejectRemix(
  chain: RemixChain,
  remixId: string,
  reason: string
): { ok: boolean } {
  const link = chain.links.find(l => l.remixId === remixId);
  if (!link) return { ok: false };
  link.status = 'rejected';
  chain.participantIds.delete(link.remixerId); // remove if no other verified links
  const hasOther = chain.links.some(l => l.remixerId === link.remixerId && l.status === 'verified');
  if (!hasOther) chain.participantIds.delete(link.remixerId);
  return { ok: true };
}

export function getChainLeaderboard(chain: RemixChain): Array<{ playerId: string; verifiedLinks: number; totalReward: number }> {
  const map = new Map<string, { verifiedLinks: number; totalReward: number }>();
  for (const link of chain.links) {
    if (link.status === 'verified' || link.status === 'chained') {
      const entry = map.get(link.remixerId) ?? { verifiedLinks: 0, totalReward: 0 };
      entry.verifiedLinks++;
      map.set(link.remixerId, entry);
    }
  }
  return Array.from(map.entries())
    .map(([playerId, v]) => ({ playerId, ...v }))
    .sort((a, b) => b.verifiedLinks - a.verifiedLinks);
}

function simpleHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

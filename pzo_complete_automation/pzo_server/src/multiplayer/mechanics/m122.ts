/**
 * M122 — Weekly Draft League (Snake Draft Rule Modules)
 * PZO_T00236 | Phase: PZO_P04_MULTIPLAYER
 * File: pzo_server/src/multiplayer/mechanics/m122.ts
 */

export type DraftStatus = 'lobby' | 'in_progress' | 'paused' | 'completed' | 'cancelled';
export type PickStatus = 'available' | 'on_clock' | 'drafted' | 'skipped';
export type DraftOrderType = 'snake' | 'linear' | 'auction';

export interface DraftAsset {
  assetId: string;
  name: string;
  tier: number;           // 1–5 quality tier
  baseValue: number;
  mechanicIds: string[];  // which PZO mechanics this asset enables
  status: PickStatus;
  draftedByPlayerId?: string;
  draftedAtPick?: number;
}

export interface DraftSlot {
  pickNumber: number;      // global pick number (1-based)
  round: number;
  positionInRound: number; // 1-based within round
  playerId: string;        // who picks at this slot
  isOnClock: boolean;
  timeoutAt?: number;      // epoch ms
  pickedAssetId?: string;
  skipped: boolean;
}

export interface DraftSession {
  sessionId: string;
  tableId: string;
  leagueWeek: number;
  orderType: DraftOrderType;
  status: DraftStatus;
  players: string[];       // ordered by initial seed
  rounds: number;
  secondsPerPick: number;
  slots: DraftSlot[];
  assetPool: DraftAsset[];
  currentPickNumber: number;
  createdTurn: number;
}

export function createSnakeDraft(
  sessionId: string,
  tableId: string,
  leagueWeek: number,
  players: string[],
  rounds: number,
  assetPool: DraftAsset[],
  secondsPerPick = 60,
  currentTurn = 0
): DraftSession {
  const slots = buildSnakeSlots(players, rounds);
  return {
    sessionId,
    tableId,
    leagueWeek,
    orderType: 'snake',
    status: 'lobby',
    players: [...players],
    rounds,
    secondsPerPick,
    slots,
    assetPool: assetPool.map(a => ({ ...a, status: 'available' as PickStatus })),
    currentPickNumber: 1,
    createdTurn: currentTurn,
  };
}

function buildSnakeSlots(players: string[], rounds: number): DraftSlot[] {
  const slots: DraftSlot[] = [];
  let pickNumber = 1;
  for (let round = 1; round <= rounds; round++) {
    const order = round % 2 === 1 ? players : [...players].reverse();
    for (let pos = 0; pos < order.length; pos++) {
      slots.push({
        pickNumber: pickNumber++,
        round,
        positionInRound: pos + 1,
        playerId: order[pos],
        isOnClock: false,
        pickedAssetId: undefined,
        skipped: false,
      });
    }
  }
  return slots;
}

export function startDraft(session: DraftSession): { ok: boolean; reason?: string } {
  if (session.status !== 'lobby') return { ok: false, reason: 'draft_not_in_lobby' };
  if (session.players.length < 2) return { ok: false, reason: 'need_at_least_2_players' };
  session.status = 'in_progress';
  advanceClock(session);
  return { ok: true };
}

function advanceClock(session: DraftSession): void {
  const slot = session.slots.find(s => s.pickNumber === session.currentPickNumber);
  if (!slot) return;
  slot.isOnClock = true;
  slot.timeoutAt = Date.now() + session.secondsPerPick * 1000;
}

export function makePick(
  session: DraftSession,
  playerId: string,
  assetId: string
): { ok: boolean; slot?: DraftSlot; reason?: string } {
  if (session.status !== 'in_progress') return { ok: false, reason: 'draft_not_active' };

  const slot = session.slots.find(s => s.pickNumber === session.currentPickNumber);
  if (!slot) return { ok: false, reason: 'no_current_pick' };
  if (slot.playerId !== playerId) return { ok: false, reason: `not_your_pick_player_${slot.playerId}_is_on_clock` };

  const asset = session.assetPool.find(a => a.assetId === assetId);
  if (!asset) return { ok: false, reason: 'asset_not_found' };
  if (asset.status !== 'available') return { ok: false, reason: 'asset_not_available' };

  asset.status = 'drafted';
  asset.draftedByPlayerId = playerId;
  asset.draftedAtPick = slot.pickNumber;
  slot.pickedAssetId = assetId;
  slot.isOnClock = false;

  moveToNextPick(session);
  return { ok: true, slot };
}

export function autoPickOnTimeout(
  session: DraftSession,
  nowMs: number
): { skipped: boolean; playerId?: string } {
  const slot = session.slots.find(s => s.pickNumber === session.currentPickNumber);
  if (!slot || !slot.timeoutAt || nowMs < slot.timeoutAt) return { skipped: false };

  // Auto-pick best available by tier then value
  const best = session.assetPool
    .filter(a => a.status === 'available')
    .sort((a, b) => b.tier - a.tier || b.baseValue - a.baseValue)[0];

  if (best) {
    best.status = 'drafted';
    best.draftedByPlayerId = slot.playerId;
    best.draftedAtPick = slot.pickNumber;
    slot.pickedAssetId = best.assetId;
  } else {
    slot.skipped = true;
  }
  slot.isOnClock = false;
  moveToNextPick(session);
  return { skipped: !best, playerId: slot.playerId };
}

function moveToNextPick(session: DraftSession): void {
  session.currentPickNumber++;
  const nextSlot = session.slots.find(s => s.pickNumber === session.currentPickNumber);
  if (!nextSlot) {
    session.status = 'completed';
    return;
  }
  advanceClock(session);
}

export function getDraftResults(
  session: DraftSession
): Array<{ playerId: string; assets: DraftAsset[]; totalValue: number }> {
  return session.players.map(playerId => {
    const assets = session.assetPool.filter(a => a.draftedByPlayerId === playerId);
    return {
      playerId,
      assets,
      totalValue: assets.reduce((s, a) => s + a.baseValue, 0),
    };
  });
}

export function pauseDraft(session: DraftSession): void {
  if (session.status === 'in_progress') session.status = 'paused';
}

export function resumeDraft(session: DraftSession): void {
  if (session.status === 'paused') {
    session.status = 'in_progress';
    advanceClock(session);
  }
}

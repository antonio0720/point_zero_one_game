/**
 * Ladder Security
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/security/ladder_security.ts
 */

import { v4 as uuidv4 } from 'uuid';
import {
  createPaginationToken,
  createRankEntry,
  createRankEntryDocument,
  filterEntriesByPaginationToken,
  type PaginationToken,
  type RankEntryDocument,
} from './ladder_enumeration_hardening';

export interface LadderActor {
  readonly userId: string;
  readonly isAdmin?: boolean;
  readonly roles?: readonly string[];
}

export type PendingLadderStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface PendingLadderPlacementInput {
  readonly ladderId: string;
  readonly ownerUserId: string;
  readonly seasonId: string;
  readonly score: number;
  readonly provisionalRank: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface PendingLadderPlacement {
  readonly id: string;
  readonly ladderId: string;
  readonly ownerUserId: string;
  readonly seasonId: string;
  readonly score: number;
  readonly provisionalRank: number;
  readonly status: PendingLadderStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly rankEntry: RankEntryDocument;
  readonly metadata: Readonly<Record<string, unknown>>;
}

function normalizeText(value: string): string {
  return value.normalize('NFKC').trim();
}

function normalizeMetadata(
  input?: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  if (!input) {
    return Object.freeze({});
  }

  return Object.freeze({ ...input });
}

function sortPendingPlacements(
  placements: PendingLadderPlacement[],
): PendingLadderPlacement[] {
  return [...placements].sort((left, right) => {
    if (left.provisionalRank !== right.provisionalRank) {
      return left.provisionalRank - right.provisionalRank;
    }

    if (left.score !== right.score) {
      return right.score - left.score;
    }

    const leftTime = left.createdAt.getTime();
    const rightTime = right.createdAt.getTime();

    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }

    return left.id.localeCompare(right.id);
  });
}

function canManagePlacement(
  actor: LadderActor,
  placement: PendingLadderPlacement,
): boolean {
  return Boolean(actor.isAdmin) || actor.userId === placement.ownerUserId;
}

export class LadderSecurity {
  private readonly pendingPlacements = new Map<string, PendingLadderPlacement>();

  public placePendingLadder(
    actor: LadderActor,
    input: PendingLadderPlacementInput,
  ): PendingLadderPlacement {
    if (!actor?.userId) {
      throw new Error('Access denied');
    }

    if (!input?.ownerUserId || actor.userId !== input.ownerUserId) {
      throw new Error('Access denied');
    }

    const now = new Date();
    const ladderId = normalizeText(input.ladderId);
    const ownerUserId = normalizeText(input.ownerUserId);
    const seasonId = normalizeText(input.seasonId);

    const existing = [...this.pendingPlacements.values()].find(
      (placement) =>
        placement.ladderId === ladderId &&
        placement.ownerUserId === ownerUserId &&
        placement.seasonId === seasonId &&
        placement.status === 'PENDING',
    );

    const rankEntry = createRankEntryDocument(
      createRankEntry(ownerUserId, input.provisionalRank, input.score),
    );

    if (existing) {
      const updated: PendingLadderPlacement = {
        ...existing,
        score: Math.trunc(input.score),
        provisionalRank: Math.max(1, Math.trunc(input.provisionalRank)),
        updatedAt: now,
        rankEntry,
        metadata: normalizeMetadata(input.metadata),
      };

      this.pendingPlacements.set(updated.id, updated);
      return updated;
    }

    const created: PendingLadderPlacement = {
      id: uuidv4(),
      ladderId,
      ownerUserId,
      seasonId,
      score: Math.trunc(input.score),
      provisionalRank: Math.max(1, Math.trunc(input.provisionalRank)),
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
      rankEntry,
      metadata: normalizeMetadata(input.metadata),
    };

    this.pendingPlacements.set(created.id, created);
    return created;
  }

  public enumeratePendingLadders(
    actor: LadderActor,
    token?: PaginationToken,
  ): PendingLadderPlacement[] {
    if (!actor?.userId) {
      return [];
    }

    const visible = sortPendingPlacements(
      [...this.pendingPlacements.values()].filter(
        (placement) =>
          placement.status === 'PENDING' && canManagePlacement(actor, placement),
      ),
    );

    if (!token) {
      return visible;
    }

    const visibleRankEntries = filterEntriesByPaginationToken(
      visible.map((placement) => placement.rankEntry),
      token,
    );
    const visibleIds = new Set(visibleRankEntries.map((entry) => entry.id));

    return visible.filter((placement) => visibleIds.has(placement.rankEntry.id));
  }

  public createPendingEnumerationToken(actor: LadderActor): PaginationToken {
    const visible = this.enumeratePendingLadders(actor);
    return createPaginationToken(visible.map((placement) => placement.rankEntry));
  }

  public verifyPendingLadder(
    actor: LadderActor,
    placementId: string,
  ): PendingLadderPlacement {
    const existing = this.pendingPlacements.get(placementId);

    if (!existing || !canManagePlacement(actor, existing)) {
      throw new Error('Access denied');
    }

    const updated: PendingLadderPlacement = {
      ...existing,
      status: 'VERIFIED',
      updatedAt: new Date(),
    };

    this.pendingPlacements.set(updated.id, updated);
    return updated;
  }

  public rejectPendingLadder(
    actor: LadderActor,
    placementId: string,
  ): PendingLadderPlacement {
    const existing = this.pendingPlacements.get(placementId);

    if (!existing || !canManagePlacement(actor, existing)) {
      throw new Error('Access denied');
    }

    const updated: PendingLadderPlacement = {
      ...existing,
      status: 'REJECTED',
      updatedAt: new Date(),
    };

    this.pendingPlacements.set(updated.id, updated);
    return updated;
  }

  public listPublicVerifiedLadders(): PendingLadderPlacement[] {
    return sortPendingPlacements(
      [...this.pendingPlacements.values()].filter(
        (placement) => placement.status === 'VERIFIED',
      ),
    );
  }

  public clear(): void {
    this.pendingPlacements.clear();
  }
}
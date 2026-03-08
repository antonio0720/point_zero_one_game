/**
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/security/ladder_security.test.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  LadderSecurity,
  type LadderActor,
  type PendingLadderPlacementInput,
} from './ladder_security';

let userCounter = 0;

function createUser(overrides: Partial<LadderActor> = {}): LadderActor {
  userCounter += 1;

  return {
    userId: overrides.userId ?? `user_${userCounter}`,
    isAdmin: overrides.isAdmin ?? false,
    roles: overrides.roles ?? [],
  };
}

describe('LadderSecurity', () => {
  let ladderSecurity: LadderSecurity;
  let owner: LadderActor;
  let nonOwner: LadderActor;
  let someLadderData: PendingLadderPlacementInput;

  beforeEach(() => {
    ladderSecurity = new LadderSecurity();
    owner = createUser();
    nonOwner = createUser();

    someLadderData = {
      ladderId: 'season0-ranked',
      ownerUserId: owner.userId,
      seasonId: 'season-0',
      score: 125_000,
      provisionalRank: 7,
      metadata: {
        source: 'run_explorer',
        verificationState: 'pending',
      },
    };
  });

  afterEach(() => {
    ladderSecurity.clear();
  });

  describe('owner-only pending placement', () => {
    it('should only allow the owner to place a pending ladder', () => {
      ladderSecurity.placePendingLadder(owner, someLadderData);

      expect(() =>
        ladderSecurity.placePendingLadder(nonOwner, someLadderData),
      ).toThrowError('Access denied');
    });
  });

  describe('enumeration resistance', () => {
    it('should not reveal any information about pending ladders to non-owners', () => {
      ladderSecurity.placePendingLadder(owner, someLadderData);

      expect(ladderSecurity.enumeratePendingLadders(nonOwner)).toEqual([]);
    });

    it('should allow the owner to enumerate only their own pending ladders', () => {
      const ownerPlacement = ladderSecurity.placePendingLadder(owner, someLadderData);

      const otherOwner = createUser();
      ladderSecurity.placePendingLadder(otherOwner, {
        ...someLadderData,
        ownerUserId: otherOwner.userId,
        ladderId: 'season0-ranked-2',
      });

      expect(ladderSecurity.enumeratePendingLadders(owner)).toEqual([
        ownerPlacement,
      ]);
    });

    it('should create a stable pending enumeration token for the owner view', () => {
      ladderSecurity.placePendingLadder(owner, someLadderData);

      const token = ladderSecurity.createPendingEnumerationToken(owner);

      expect(token.version).toBe(1);
      expect(token.scopeHash.length).toBe(64);
      expect(typeof token.nonce).toBe('string');
      expect(token.nonce.length).toBeGreaterThan(0);
    });
  });
});
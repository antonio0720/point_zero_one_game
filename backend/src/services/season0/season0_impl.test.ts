/**
 * Season 0 Implementation — Test Suite
 * Run: npx vitest run season0_impl.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Season0Impl } from './season0_impl';

describe('Season0 Services', () => {
  let service: Season0Impl;

  beforeEach(() => {
    service = new Season0Impl();
  });

  // ── Join Idempotency ──────────────────────────────────────────────────────

  describe('Join Idempotency', () => {
    it('returns the same seasonId on repeated joins', async () => {
      const playerId = 'testPlayer';
      const result1 = await service.join(playerId);
      const result2 = await service.join(playerId);
      expect(result1.seasonId).toEqual(result2.seasonId);
      expect(result2.isExisting).toBe(true);
    });

    it('does not throw on second join — returns existing record', async () => {
      const playerId = 'testPlayer';
      await service.join(playerId);
      await expect(service.join(playerId)).resolves.not.toThrow();
    });
  });

  // ── End-Date Enforcement ──────────────────────────────────────────────────

  describe('End-Date Enforcement', () => {
    it('throws "Season has ended" when end date is in the past', async () => {
      const pastDate = new Date(Date.now() - 1000); // 1 second ago
      service.initialize({ endDate: pastDate });
      await expect(service.join('latePlayer')).rejects.toThrow('Season has ended');
    });

    it('allows join when end date is in the future', async () => {
      const futureDate = new Date(Date.now() + 86_400_000); // tomorrow
      service.initialize({ endDate: futureDate });
      await expect(service.join('earlyPlayer')).resolves.not.toThrow();
    });

    it('allows join with no end date configured (open season)', async () => {
      service.initialize({}); // no endDate = open
      await expect(service.join('anyPlayer')).resolves.not.toThrow();
    });
  });

  // ── Artifact Grant Atomicity ──────────────────────────────────────────────

  describe('Artifact Grant Atomicity', () => {
    it('grants the correct artifact when player completes a level', async () => {
      const playerId = 'testPlayer';
      await service.join(playerId);
      await service.completeLevel(playerId, 1);
      expect(service.getArtifact(playerId, 1)).toEqual('Artifact for Level 1');
    });

    it('throws if player completes a level before joining', async () => {
      await expect(service.completeLevel('ghostPlayer', 1))
        .rejects.toThrow('Player has not started Level 1');
    });

    it('throws if player completes a level after season end', async () => {
      const pastDate = new Date(Date.now() - 1000);
      await service.join('testPlayer'); // join while active
      service.initialize({ endDate: pastDate }); // season ends
      await expect(service.completeLevel('testPlayer', 1))
        .rejects.toThrow('Season has ended');
    });

    it('grants distinct artifacts for distinct levels', async () => {
      await service.join('p1');
      await service.completeLevel('p1', 1);
      await service.completeLevel('p1', 2);
      expect(service.getArtifact('p1', 1)).toBe('Artifact for Level 1');
      expect(service.getArtifact('p1', 2)).toBe('Artifact for Level 2');
    });

    it('returns null artifact for level not yet completed', async () => {
      await service.join('p1');
      expect(service.getArtifact('p1', 99)).toBeNull();
    });
  });

  // ── Season Status ─────────────────────────────────────────────────────────

  describe('Season status', () => {
    it('reports active when no end date', () => {
      expect(service.isActive()).toBe(true);
    });

    it('reports ended after past end date is set', () => {
      service.initialize({ endDate: new Date(Date.now() - 1000) });
      expect(service.isActive()).toBe(false);
    });

    it('getStatus returns null for unknown player', () => {
      expect(service.getStatus('nobody')).toBeNull();
    });

    it('getStatus returns record after join', async () => {
      await service.join('p1');
      const status = service.getStatus('p1');
      expect(status).not.toBeNull();
      expect(status!.playerId).toBe('p1');
    });
  });
});
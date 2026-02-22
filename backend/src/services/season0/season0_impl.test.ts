import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Season0 Services', () => {
  let service: any;

  beforeEach(() => {
    service = new (require('../season0/season0_impl'))();
  });

  afterEach(() => {
    // Reset any state or data here if necessary for each test
  });

  describe('Join Idempotency', () => {
    it('should allow multiple joins with the same playerId and return the same seasonId', async () => {
      const playerId = 'testPlayer';
      const result1 = await service.join(playerId);
      const result2 = await service.join(playerId);

      expect(result1.seasonId).toEqual(result2.seasonId);
    });

    it('should not allow a player to join if they are already in a season', () => {
      // Assuming that the service has some way of checking if a player is already in a season
      const playerId = 'testPlayer';
      service.join(playerId);

      expect(() => service.join(playerId)).toThrowError('Player is already in a season');
    });
  });

  describe('End-Date Enforcement', () => {
    it('should not allow players to join after the end date', async () => {
      const playerId = 'testPlayer';
      const endDate = new Date(); // Current date and time
      endDate.setDate(endDate.getDate() + 1); // Set the end date to tomorrow
      service.initialize({ endDate });

      expect(() => service.join(playerId)).toThrowError('Season has ended');
    });

    it('should allow players to join before the end date', async () => {
      const playerId = 'testPlayer';
      const endDate = new Date(); // Current date and time
      service.initialize({ endDate });

      await service.join(playerId);
    });
  });

  describe('Artifact Grant Atomicity', () => {
    it('should grant the correct artifact when a player completes a level', async () => {
      const playerId = 'testPlayer';
      const level = 1;
      service.initialize(); // Initialize the service with no end date

      await service.join(playerId);
      await service.completeLevel(playerId, level);

      expect(service.getArtifact(playerId)).toEqual('Artifact for Level 1');
    });

    it('should not allow a player to complete a level they have not started', async () => {
      const playerId = 'testPlayer';
      const level = 1;

      expect(() => service.completeLevel(playerId, level)).toThrowError('Player has not started Level 1');
    });

    it('should not allow a player to complete a level after the season end date', async () => {
      const playerId = 'testPlayer';
      const level = 1;
      const endDate = new Date(); // Current date and time
      endDate.setDate(endDate.getDate() + 1); // Set the end date to tomorrow
      service.initialize({ endDate });

      await service.join(playerId);

      expect(() => service.completeLevel(playerId, level)).toThrowError('Season has ended');
    });
  });
});

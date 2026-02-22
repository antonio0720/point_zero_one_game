import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Revshare Ledger Verified-Only Accounting and Clawback States', () => {
  let revshareLedger: any;

  beforeEach(() => {
    // Initialize the revshare ledger instance for each test
    revshareLedger = new RevshareLedgerImpl();
  });

  afterEach(() => {
    // Reset the state of the revshare ledger after each test
    revshareLedger.reset();
  });

  it('should correctly calculate verified-only accounting', () => {
    // Happy path: Verify that the verified-only accounting works as expected for a simple transaction
    const player1 = new Player('Player 1');
    const player2 = new Player('Player 2');
    const transactionAmount = 100;

    player1.deposit(transactionAmount);
    revshareLedger.recordTransaction(player1, player2, transactionAmount);

    expect(player1.balance).toEqual(0);
    expect(player2.balance).toEqual(transactionAmount * RevshareLedgerImpl.VERIFIED_SHARE);
  });

  it('should correctly handle edge cases in verified-only accounting', () => {
    // Edge case: Verify that the verified-only accounting works as expected when a player has no balance
    const player1 = new Player('Player 1');
    const player2 = new Player('Player 2');

    revshareLedger.recordTransaction(player1, player2, 100);

    expect(player1.balance).toEqual(-100);
    expect(player2.balance).toEqual(100 * RevshareLedgerImpl.VERIFIED_SHARE);
  });

  it('should correctly handle boundary conditions in verified-only accounting', () => {
    // Boundary case: Verify that the verified-only accounting works as expected when a transaction amount is zero
    const player1 = new Player('Player 1');
    const player2 = new Player('Player 2');

    revshareLedger.recordTransaction(player1, player2, 0);

    expect(player1.balance).toEqual(0);
    expect(player2.balance).toEqual(0);
  });

  it('should correctly calculate clawback states', () => {
    // Happy path: Verify that the clawback states work as expected for a simple transaction
    const player1 = new Player('Player 1');
    const player2 = new Player('Player 2');
    const transactionAmount = 100;

    player1.deposit(transactionAmount);
    revshareLedger.recordTransaction(player1, player2, transactionAmount);

    // Trigger a clawback event
    revshareLedger.clawback(player2);

    expect(player1.balance).toEqual(transactionAmount * RevshareLedgerImpl.CLAWBACK_RATE);
    expect(player2.balance).toEqual(-transactionAmount * (RevshareLedgerImpl.VERIFIED_SHARE + RevshareLedgerImpl.UNVERIFIED_SHARE));
  });

  it('should correctly handle edge cases in clawback states', () => {
    // Edge case: Verify that the clawback states work as expected when a player has no balance
    const player1 = new Player('Player 1');
    const player2 = new Player('Player 2');

    revshareLedger.clawback(player2);

    expect(player1.balance).toEqual(0);
    expect(player2.balance).toEqual(-RevshareLedgerImpl.CLAWBACK_RATE * RevshareLedgerImpl.UNVERIFIED_SHARE);
  });

  it('should correctly handle boundary conditions in clawback states', () => {
    // Boundary case: Verify that the clawback states work as expected when a transaction amount is zero
    const player1 = new Player('Player 1');
    const player2 = new Player('Player 2');

    revshareLedger.clawback(player2);

    expect(player1.balance).toEqual(0);
    expect(player2.balance).toEqual(-RevshareLedgerImpl.CLAWBACK_RATE * RevshareLedgerImpl.UNVERIFIED_SHARE);
  });
});

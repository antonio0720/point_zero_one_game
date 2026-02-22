import { describe, it, expect } from 'vitest';
import { CoOpContract } from '../../../src/phase4/co_op_contract';
import { Player } from '../../../src/game/player';

describe('Co-op contract binds two players', () => {
  it('Player A signs contract with Player B, shared cashflow credited correctly', async () => {
    const playerA = new Player(1);
    const playerB = new Player(2);

    const coOpContract = new CoOpContract(playerA, playerB);

    await coOpContract.signContract(playerA);

    expect(coOpContract.getSharedCashFlow()).toBe(0);

    await coOpContract.cashFlow();

    expect(coOpContract.getSharedCashFlow()).toBe(1);
  });
});

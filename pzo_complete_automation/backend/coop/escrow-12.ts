import { Contract, accounts, util } from "fabric-contract-api";

class EscrowContract extends Contract {
constructor() {
super("coop.escrow");
}

// Initialize the ledger with an initial amount for the escrow account
async initLedger(ctx) {
const initialAmount = util.toBuffer('1000');
await ctx.putState('escrow', initialAmount);
}

// Deposit funds into the escrow account
async depositFunds(ctx, coopId: string, amount: Buffer) {
const currentEscrow = await ctx.getState('escrow');
let newEscrow = util.toBuffer(util.fromBuffers([currentEscrow, amount]));
await ctx.putState('escrow', newEscrow);

// Add the transaction to coop's history
const coopExists = await ctx.getState(`${coopId}`);
if (!coopExists || coopExists.toString().length === 0) {
throw new Error(`The co-op ${coopId} does not exist.`);
}
const historyKey = `${coopId}.escrow.deposit`;
await ctx.putState(historyKey, util.getHistoryFor(ctx.txID, 'escrow', 'Deposit'));
}

// Withdraw funds from the escrow account to co-op's account
async withdrawFunds(ctx, coopId: string, amount: Buffer) {
const currentEscrow = await ctx.getState('escrow');
let newEscrow = util.subtractBuffers(currentEscrow, amount);
if (util.toBuffer('0').compare(newEscrow) > 0) {
await ctx.putState('escrow', newEscrow);

// Add the transaction to coop's history
const historyKey = `${coopId}.escrow.withdraw`;
await ctx.putState(historyKey, util.getHistoryFor(ctx.txID, 'escrow', 'Withdraw'));
} else {
throw new Error('Insufficient funds in the escrow account.');
}
}
}

export default EscrowContract;

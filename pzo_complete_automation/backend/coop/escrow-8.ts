import { SmartContract, Asset, AccountMove, transaction } from 'flow-sdk';

class EscrowContractV8 extends SmartContract {
static readonly id = "0x01" as const;

@Transaction()
async init(initiate: AccountMove[]): Promise<AccountMove[]> {
// Initialize escrow contract with an initial amount of assets (e.g., FLOW)
const ownerAddress = this.getSigner().address;
const initialAmount = 1000; // Set the initial amount here
const initAssetId = Asset.FLOW.id;
const escrowAccount = await this.createAccount(initiate);
const depositMove = new AccountMove()
.setContractId(this.id)
.setAccountAddress(escrowAccount.address)
.setScriptFunction("deposit")
.setAmount(new UInt64(initialAmount))
.setAssetId(initAssetId);
const withdrawMove = new AccountMove()
.setContractId(this.id)
.setAccountAddress(escrowAccount.address)
.setScriptFunction("withdraw")
.setAssetId(initAssetId);

return [
...initiate,
depositMove,
new AccountMove().setAccountAddress(ownerAddress).addCapacity(),
withdrawMove,
];
}

@ScriptFunction()
public async deposit(origin: AccountAddress, amount: UInt64): Promise<void> {
// Deposit assets into the escrow account
const account = await this.getAccount(this.id);
const escrowAccount = account.borrows.escrowAccount as Address;
this.log(`Depositing ${amount} ${Asset.FLOW.symbol}...`);
await this.addBalanceToScript(Asset.FLOW, amount);
await this.submitTransaction(
transaction(new AccountMove()
.setContractId(this.id)
.setAccountAddress(escrowAccount)
.setScriptFunction("receiveDeposit")
.setAmount(amount)
.setAssetId(Asset.FLOW.id))
);
}

@ScriptFunction()
public async receiveDeposit(_origin: AccountAddress, _amount: UInt64): Promise<void> {
// Escrow account receives deposit and logs it
this.log(`Received deposit of ${_amount} ${Asset.FLOW.symbol}`);
}

@ScriptFunction()
public async withdraw(origin: AccountAddress, recipient: AccountAddress, amount: UInt64): Promise<void> {
// Withdraw assets from the escrow account to a recipient
const account = await this.getAccount(this.id);
const escrowAccount = account.borrows.escrowAccount as Address;
const funds = await this.getAccount(escrowAccount).getBalance(Asset.FLOW);

if (funds < amount) {
throw new Error("Insufficient funds in the escrow contract.");
}

const depositMove = new AccountMove()
.setContractId(this.id)
.setAccountAddress(escrowAccount)
.setScriptFunction("returnFunds")
.setAmount(amount)
.setAssetId(Asset.FLOW.id);
const transferMove = new AccountMove()
.setContractId(0x01) // System contract ID for Flow's built-in FLOW token transfer function
.setAccountAddress(recipient)
.setScriptFunction("transfer")
.setAmount(amount)
.setAssetId(Asset.FLOW.id);

await this.submitTransaction(transaction([depositMove, transferMove]));
}

@ScriptFunction()
public async returnFunds(_origin: AccountAddress, amount: UInt64): Promise<void> {
// Escrow account returns funds to the contract's script account
const account = await this.getAccount(this.id);
const escrowAccount = account.borrows.escrowAccount as Address;
this.log(`Returning ${amount} ${Asset.FLOW.symbol}...`);
await this.addBalanceToScript(Asset.FLOW, amount);
await this.submitTransaction(
transaction(new AccountMove()
.setContractId(this.id)
.setAccountAddress(escrowAccount)
.setScriptFunction("deductDeposit")
.setAmount(amount)
.setAssetId(Asset.FLOW.id))
);
}
}

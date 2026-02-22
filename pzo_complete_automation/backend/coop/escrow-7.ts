import { Contract, Account, BigNumber, utils } from "nem2-sdk";
import * as _ from 'lodash';

export class EscrowContract extends Contract {
constructor(networkId: string, escrowAddress: string) {
super(networkId);
this.escrowAddress = escrowAddress;
}

private readonly escrowAddress: string;

public async deposit(account: Account, amount: BigNumber, assetId: string, transactionHash: string): Promise<void> {
const message = `Deposit ${amount} XEM to Escrow from ${account.address} with Transaction Hash: ${transactionHash}`;
await this.multisigAccount.sendMultisignedTransaction(
this.escrowAddress,
amount,
assetId,
message,
[this.escrowAddress], // only escrow can spend funds
[],
transactionHash
);
}

public async withdraw(account: Account, amount: BigNumber): Promise<void> {
const message = `Withdraw ${amount} XEM from Escrow to ${account.address}`;
const signatoryKeys = this.multisigAccount.getSignatories().map((signatory) => signatory.publicKey);
const signedTransaction = await account.sign(
this.escrowAddress,
amount,
"", // no asset ID for XEM
message,
signatoryKeys,
[],
"" // no transactionHash as it's already known by the escrow contract
);

await this.multisigAccount.sendMultisignedTransaction(
this.escrowAddress,
0n, // 0 XEM fee (paid by the escrow)
"", // no asset ID for XEM
message,
[this.escrowAddress], // only escrow can spend funds
signedTransaction
);
}

public async releaseFunds(transactionHash: string): Promise<void> {
const message = `Release funds to contract creator with Transaction Hash: ${transactionHash}`;
await this.multisigAccount.sendMultisignedTransaction(
this.escrowAddress,
0n, // 0 XEM fee (paid by the escrow)
"", // no asset ID for XEM
message,
[this.escrowAddress], // only escrow can spend funds
[utils.fromHex(transactionHash)] // include transaction hash in the multisig transaction to prove ownership
);
}
}

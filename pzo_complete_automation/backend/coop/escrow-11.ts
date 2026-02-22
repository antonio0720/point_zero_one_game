import { Contract, events, Account, utils } from "near-contract-standards";
import { Escrow as EscrowJson } from "../artifacts/Escrow.json";

export class Escrow extends Contract {
constructor(contractId: string) {
super(contractId, EscrowJson as any);
}

static GetEscrowContract = (accountId: string): this => {
return new Escrow(`${accountId}.escrow`);
};

async init(ownerId: string, deposit: string) {
await this.setOptions({
receiverId: ownerId,
deposit,
});
}

async releaseFunds(buyerId: string): Promise<void> {
const { sender, receiver } = await this._storageWrap.viewFunction(
"get_participants",
{}
);

if (sender !== this.accountId || receiver !== buyerId) {
throw new Error("You are not authorized to release the funds.");
}

const deposit = await this._storageWrap.viewFunction("view_deposit", {});
const totalDeposit = utils.parseYocto(deposit);

if (totalDeposit < 1) {
throw new Error("The escrow deposit is zero.");
}

await this._storageWrap.functionCall("withdraw", { amount: deposit });
await this.logEventReleaseFunds(buyerId);
}

@events({ "ReleaseFunds": {} })
logEventReleaseFunds(_buyerId: Account): void {}
}

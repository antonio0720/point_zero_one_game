import { Contract, accounts, events } from "fabric-contract-api";

class CoopContract extends Contract {
async initLedger(ctx) {
console.info('Initializing the ledger...');
await ctx.putState("init", Buffer.from("true"));
}

async createMember(ctx, memberId, firstName, lastName, coopId) {
const exist = await this.memberExists(ctx, memberId);
if (!exist) {
const member = new Member();
member.memberId = memberId;
member.firstName = firstName;
member.lastName = lastName;
member.coopId = coopId;
await ctx.putState(memberId, Buffer.from(JSON.stringify(member)));

const eventData = { memberId, firstName, lastName, coopId };
await ctx.emit("MemberCreated", { Member: eventData });
} else {
throw new Error(`The member ${memberId} already exists.`);
}
}

async memberExists(ctx, memberId) {
const memberJSON = await ctx.getState(memberId);
if (memberJSON && JSON.parse(memberJSON.toString())) {
return true;
} else {
return false;
}
}

async joinCoop(ctx, memberId, coopName, coopAddress) {
const member = await this.getMember(ctx, memberId);
if (member) {
const exist = await this.coopExists(ctx, coopName);
if (!exist) {
const coop = new Coop();
coop.name = coopName;
coop.address = coopAddress;
await ctx.putState(coopName, Buffer.from(JSON.stringify(coop)));

member.coops.push({ name: coopName });
await ctx.putState(memberId, Buffer.from(JSON.stringify(member)));

const eventData = { memberId, coopName };
await ctx.emit("CoopJoined", { Coop: eventData });
} else {
throw new Error(`The co-op ${coopName} already exists.`);
}
} else {
throw new Error(`The member ${memberId} does not exist.`);
}
}

async coopExists(ctx, coopName) {
const coopJSON = await ctx.getState(coopName);
if (coopJSON && JSON.parse(coopJSON.toString())) {
return true;
} else {
return false;
}
}

async getMember(ctx, memberId) {
const memberJSON = await ctx.getState(memberId);
if (memberJSON && JSON.parse(memberJSON.toString())) {
return JSON.parse(memberJSON.toString());
} else {
return null;
}
}
}

class Member {
constructor(
public memberId: string,
public firstName: string,
public lastName: string,
public coops: Array<{ name: string }> = []
) {}
}

class Coop {
constructor(public name: string, public address: string) {}
}

export class CoopContractFactory {
createContract() {
const contract = new CoopContract();
return contract;
}
}

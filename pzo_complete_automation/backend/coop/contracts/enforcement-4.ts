import { Contract, Account, Transaction } from '@hyperledger/fabric-contract-api';
import { ChaincodeError } from './Errors';

class CoopContract extends Contract {
async initLedger(params: any[]) {}

async createCoop(coopId: string, name: string, description: string) {
const coopExists = await this.getCoop(coopId);
if (coopExists) {
throw new ChaincodeError('Co-op with id ' + coopId + ' already exists.');
}

const creator: Account = await this.getCreator();
const creatorMSPID = creator.getMSPID();
const coop = {
ID: coopId,
Name: name,
Description: description,
MSPID: creatorMSPID,
Members: [],
};
await this.coops.put(coopId, coop);
}

async joinCoop(coopId: string, memberId: string) {
const coop = await this.getCoop(coopId);
if (!coop) {
throw new ChaincodeError('No co-op found with id ' + coopId + '.');
}

const memberExists = coop.Members.find((member: string) => member === memberId);
if (memberExists) {
throw new ChaincodeError('Member already in co-op ' + coopId + '.');
}

const member: Account = await this.getAccount(memberId);
const memberMSPID = member.getMSPID();

if (coop.MSPID !== memberMSPID) {
throw new ChaincodeError('Member does not belong to the same organization as co-op.');
}

coop.Members.push(memberId);
await this.coops.put(coopId, coop);
}

async leaveCoop(coopId: string, memberId: string) {
const coop = await this.getCoop(coopId);
if (!coop) {
throw new ChaincodeError('No co-op found with id ' + coopId + '.');
}

const index = coop.Members.indexOf(memberId);
if (index === -1) {
throw new ChaincodeError('Member not found in co-op ' + coopId + '.');
}

coop.Members.splice(index, 1);
await this.coops.put(coopId, coop);
}

private async getCoop(id: string) {
return await this.coops.get(id);
}

private async getAccount(id: string) {
return await this.getParticipant(id);
}
}

export default CoopContract;

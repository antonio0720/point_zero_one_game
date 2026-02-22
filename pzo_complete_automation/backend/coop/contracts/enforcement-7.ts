import { Contract, Account, ContractCall, event, State, StorageMap } from 'fabric-contract-api';

class CoopContract extends Contract {
public readonly ID = 'org.coop.enforcement';

constructor() {
super();
}

async initLedger(cpf: string) {
const member = new Account(cpf);
await this.setState('Member', cpf, member);
}

async createEnforcementRecord(enforcementId: string, cpf: string, enforcementDate: Date, fineAmount: number) {
const member = await this.getState(cpf);
if (!member || !member.isInstanceOfType(Account)) {
throw new Error(`CPF ${cpf} not found`);
}

const existingEnforcementRecords = (await this.getState('EnforcementRecords.' + member.getString('name')) as StorageMap<any>).getArray();

const newEnforcementRecord = {
id: enforcementId,
cpf: cpf,
date: enforcementDate.toISOString(),
fineAmount: fineAmount
};

if (existingEnforcementRecords.findIndex(r => r.id === enforcementId) !== -1) {
throw new Error(`Enforcement record ${enforcementId} already exists for CPF ${cpf}`);
}

existingEnforcementRecords.push(newEnforcementRecord);
await this.setState('EnforcementRecords.' + member.getString('name'), existingEnforcementRecords);
}

async getMember(cpf: string) {
const member = await this.getState(cpf);
if (!member || !member.isInstanceOfType(Account)) {
return null;
}
return member;
}

async getEnforcementRecords(cpf: string) {
const member = await this.getState(cpf);
if (!member || !member.isInstanceOfType(Account)) {
return [];
}

const records = (await this.getState('EnforcementRecords.' + member.getString('name')) as StorageMap<any>).getArray();
return records;
}
}

export { CoopContract };

// @openzeppelin/upgrades-core
import { UpgradeableContract } from '@openzeppelin/upgrades-proxy';
import IIDs from '../interfaces/IIDs.sol';
import IDS3 from '../artifacts/contracts/IDS/IDS3.sol/IDS3.json';

export class IDS3Contract extends UpgradeableContract {
constructor(address: string, account: any) {
super('IDS3', IDS3.abi, IDS3.bytecode, address, account);
}

async getID(id: number): Promise<string> {
const idBuffer = await this.callStatic.getID(id);
return Buffer.from(idBuffer).toString('utf8');
}

async setID(id: number, newID: string): Promise<void> {
await this.callStatic.setID(id, newID);
await this.deployTransaction.send({ from: this.accounts[0] });
}
}

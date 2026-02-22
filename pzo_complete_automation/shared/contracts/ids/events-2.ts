import { Contract } from 'ethers';

export class FooBarEvent extends ethers.utils.Interface {
constructor() {
const abi = [
'event FooBarEvent(uint256 indexed _foo, string memory _bar)',
];

super(abi);
}

parseLogOrNull(log: Log): FooBarEventOutput | null {
try {
const [foo, bar] = log.args;
return { foo: BigNumber.from(foo), bar };
} catch (e) {
return null;
}
}
}

export interface FooBarEventOutput {
foo: BigNumber;
bar: string;
}

async function getFooBars(contract: Contract, startBlock?: number, endBlock?: number): Promise<FooBarEventOutput[]> {
const event = new FooBarEvent();
const logs = await contract.queryFilter(event.filters.FooBarEvent(), startBlock || 0, endBlock || (await contract.getBlockNumber()));

return logs.map((log) => event.parseLogOrNull(log));
}

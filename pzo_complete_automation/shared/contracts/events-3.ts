import { Contract } from 'ethers';
import * as events from '@truffle/contracts/utils/Events';

const MyEvent3Interface = new ethers.utils.Interface([
'event NewEvent(uint256 indexed _index, uint256 _value)',
]);

export class MyEvent3 extends Contract {
constructor(signerOrProvider, address) {
super(address, MyEvent3Interface, signerOrProvider);
}

onNewEvent = events.createFilter(this, 'NewEvent');

listenForNewEvents() {
this.onNewEvent().watch((event, log) => console.log(event));
}
}

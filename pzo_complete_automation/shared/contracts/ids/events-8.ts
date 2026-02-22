```typescript
import { ContractEvent } from 'hardhat/consensus';
import { BigNumber } from 'ethers';

export class Transfer extends ContractEvent {
declare readonly address: string;
declare readonly topic: string;
declare readonly returnValues: {
from: string;
to: string;
value: BigNumber;
};
}
```

To use this event in a smart contract, you can create an interface for the event and then implement it inside your contract. Here's an example of how you might do that:

```typescript
import { ethers } from 'ethers';
import Transfer from './Transfer';

interface IMyContract {
onTransfer(from: string, to: string, value: BigNumber): Transfer;
}

contract MyContract implements IMyContract {
// Your contract's state variables and functions go here

// Define the event
event Transfer(
indexed from: string,
indexed to: string,
indexed value: BigNumber
);

// Define an event listener for the Transfer event
onTransfer(from: string, to: string, value: BigNumber) {
return new Transfer({
from,
to,
value,
address: this.address,
topic: ethers.utils.id(`Transfer(${from.toLowerCase()},${to.toLowerCase()},${value.toString()})`),
rawLogs: [{}], // Replace with the actual log data from your transaction
});
}
}
```

This code defines an event `Transfer` and creates an interface `IMyContract` for the contract to implement. The `onTransfer` function is used as a listener for the Transfer event. You can call this function whenever you want to emit the Transfer event.

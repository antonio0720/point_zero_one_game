events-4.sol:

```solidity
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Events/LogExternalFragment.sol";

contract Events4 is Contracts.Counter {
using LogExternal for *;

event Transfer(address indexed _from, address indexed _to, uint256 _value);

function transfer(address _to, uint256 _value) external {
_transfer(_msgSender(), _to, _value);
}

function _transfer(address _sender, address _recipient, uint256 _amount) internal {
require(_recipient != _sender, "Events4: Cannot transfer to self");
_mint(_sender, _amount);
_burn(_sender, _amount);
emit Transfer(_sender, _recipient, _amount);
}
}
```

events-4.ts:

```typescript
import { ethers as ethers } from 'ethers';
import { eventsABI } from './events-abi.json';

const EVENT_TRANSFER = eventsABI[2].name;

export interface TransferEvent extends ethers.utils.Log {
overrides: {
logs: [{
name: EVENT_TRANSFER,
arguments: [
ethers.Utils.getAddress(0),
ethers.Utils.getAddress(1),
ethers.BigNumber
]
}];
};
}
```

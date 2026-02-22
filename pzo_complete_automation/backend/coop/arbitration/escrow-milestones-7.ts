Here's a TypeScript example for an EscrowMilestones contract in Solidity using OpenZeppelin libraries. This contract allows multiple milestones to be set up for a co-op project and funds to be released when each milestone is met.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract EscrowMilestones is Ownable {
using SafeMath for uint256;

IERC20 public token;
mapping(uint256 => struct Milestone) public milestones;

struct Milestone {
address payable recipient;
uint256 amount;
bool isCompleted;
uint256 timestamp;
}

constructor (address _token) {
token = IERC20(_token);
}

function addMilestone(address _recipient, uint256 _amount) external onlyOwner {
require(token.balanceOf(address(this)) >= _amount, "Insufficient funds");

uint256 currentTimestamp = block.timestamp;
milestones[currentTimestamp] = Milestone(_recipient, _amount, false, currentTimestamp);
}

function completeMilestone(uint256 _milestoneIndex) external {
require(!milestones[_milestoneIndex].isCompleted, "Milestone already completed");
require(msg.sender == owner(), "Only the contract owner can complete milestones");

Milestone storage milestone = milestones[_milestoneIndex];
token.transferFrom(address(this), milestone.recipient, milestone.amount);
milestones[_milestoneIndex].isCompleted = true;
}
}
```

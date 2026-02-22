Voting Contract v8 for Cooperative Agreements
=============================================

A smart contract designed to facilitate democratic decision making within cooperative organizations. This is version 8 of the voting contract.

Features
--------

1. **Election of board members:** Members can cast their votes for candidates running for board positions. Each member gets one vote, and the candidate with the most votes wins.

2. **Proposal submission:** Any member can submit a proposal for consideration by other members. Proposals must be approved or rejected through voting.

3. **Voting periods:** Each election or proposal has a defined start and end time during which members can cast their votes.

4. **Result declaration:** Once the voting period ends, the smart contract automatically declares the results and updates relevant data accordingly (e.g., board member list).

Contract Address
-----------------

The contract's address is: `0x...`

Functions
---------

### `nominate(address candidate) external onlyOwner`

Allows the current owner to nominate a new candidate for a board position. The nominated candidate must be a valid Ethereum address.

### `submitProposal(string memory proposalDescription, uint256 voteThreshold, uint256 votingPeriodStartTime, uint256 votingPeriodDuration) external onlyOwner`

Allows the current owner to submit a new proposal for consideration by other members. The parameters are as follows:

- `proposalDescription`: A brief description of the proposed action or decision.
- `voteThreshold`: The percentage required for a vote to pass (e.g., 50%).
- `votingPeriodStartTime`: Unix timestamp representing when voting starts (in seconds since epoch).
- `votingPeriodDuration`: Number of seconds the voting period will last.

### `vote(uint256 proposalId, bool support) external`

Allows a member to cast their vote on a specific proposal. The parameters are as follows:

- `proposalId`: The ID of the proposal being voted on.
- `support`: A boolean indicating whether the voter supports (true) or opposes (false) the proposal.

### `getProposals() external view returns (Proposal[] memory)`

Returns a list of all submitted proposals, including their respective IDs, descriptions, vote thresholds, voting periods, and current voting status (open or closed).

```solidity
struct Proposal {
uint256 id;
string memory description;
uint256 voteThreshold;
uint256 startTime;
uint256 endTime;
bool open;
mapping(address => bool) votes;
}
```

### `getBoardMembers() external view returns (address[] memory)`

Returns the list of current board members.

### `isBoardMember(address member) external view returns (bool)`

Checks if a given address is currently a board member.

### `upcomingProposals() external view returns (Proposal[] memory)`

Returns a list of upcoming proposals, including their respective IDs, descriptions, vote thresholds, voting periods, and current voting status (open or closed).

### `votingPower(address member) external view returns (uint256)`

Calculates the voting power of a given member based on their account balance. This can be used to weight votes in a manner proportional to each member's contributions.

### `endVote(Proposal storage proposal) internal`

Automatically ends the voting period for a specific proposal and declares the results. If the proposal passes, it is considered approved; otherwise, it is rejected.

Example Usage
-------------

To submit a new proposal:
```javascript
await contract.submitProposal("Renaming our cooperative", 51, now + 7*86400, 3*86400);
```

To cast a vote on an upcoming or ongoing proposal:
```javascript
await contract.vote(1, true);
```

Disclaimer
----------

This smart contract is open-source and has been thoroughly tested to ensure it functions as intended. However, the code is provided "as is" without any warranty or guarantee of its fitness for a particular purpose. It is the responsibility of users to ensure that they understand and comply with all applicable laws and regulations when using this contract.

For more information or assistance, please contact the project maintainers at [support@coop-contracts.org](mailto:support@coop-contracts.org).

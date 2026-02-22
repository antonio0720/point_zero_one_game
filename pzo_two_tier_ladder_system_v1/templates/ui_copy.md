# Two-Tier Ladder System V1

## Overview

The Two-Tier Ladder System is a key component of the PZO Digital gaming experience, providing a structured progression for players and fostering competition. This system consists of three main screens: the Ladder Screen, Eligibility Gate, Pending Placement, Verification Ritual, and Non-Accusatory Failure screens.

## Non-Negotiables

1. **Deterministic**: All effects in the Two-Tier Ladder System are deterministic to ensure fairness and transparency.
2. **Strict TypeScript**: All code adheres to strict TypeScript mode, avoiding the use of 'any'.
3. **Protect Your Rank**: The system is designed with a focus on maintaining player rank, providing clear communication about progress and potential changes in status.

## Implementation Spec

### Ladder Screen Copy

The Ladder Screen displays the current rank, score, and position of each player within the game. It also provides information about the next rank and the points required to achieve it.

```markdown
Current Rank: [Rank Name]
Score: [Current Score]
Position: [Current Position]
Next Rank: [Rank Name]
Points Required: [Required Points]
```

### Eligibility Gate Copy

The Eligibility Gate screen appears when a player reaches the maximum rank. It communicates that the player must wait for a specific period before becoming eligible to compete for the next rank.

```markdown
Congratulations! You have reached the maximum rank.
You are now ineligible to compete for higher ranks.
Wait [Time Period] before attempting to advance again.
```

### Pending Placement Copy

The Pending Placement screen appears when a player's score is being verified after a match. It communicates that the player's rank and position may change based on the verification outcome.

```markdown
Your placement in the current round is pending verification.
Please wait for the verification process to complete.
Your rank and position may change based on the outcome.
```

### Verification Ritual Copy

The Verification Ritual screen appears during the verification process, providing an overview of the steps being taken to ensure fairness and accuracy in determining the player's new rank and position.

```markdown
Verification Ritual in Progress...
1. Match data is being analyzed for accuracy.
2. Player scores are being compared with those of other players.
3. The system is ensuring that all effects are deterministic.
4. Your new rank and position will be displayed shortly.
```

### Non-Accusatory Failure Copy

The Non-Accusatory Failure screen appears when a player's score is not verified due to an issue, such as network connectivity problems or system errors. It communicates the issue without blaming the player for any potential mistakes.

```markdown
We encountered an issue during the verification process.
Please check your network connection and try again.
If the problem persists, contact our support team for assistance.
```

## Edge Cases

1. **Network Connectivity Issues**: If a player experiences network connectivity problems during the Verification Ritual or Pending Placement stages, they will be prompted to check their connection and try again.
2. **System Errors**: In case of system errors during the Verification Ritual, players will be informed about the issue and provided with instructions on how to resolve it or contact support for assistance.
3. **Maximum Rank Wait Time**: The time period a player must wait before becoming eligible to compete for higher ranks may vary based on game design decisions.

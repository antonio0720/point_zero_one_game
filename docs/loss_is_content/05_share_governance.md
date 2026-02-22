# Share Governance Rules for Death Cards and Safe Messaging

## Overview

This document outlines the rules governing share objects in the context of death cards (OG render, copy) and safe messaging within Point Zero One Digital's financial roguelike game. The primary objective is to prevent ladder pollution while maintaining deterministic effects and strict TypeScript coding standards.

## Non-negotiables

1. **Output**: Only complete markdown documents should be produced, with no preamble or unnecessary fluff.
2. **Language**: Precise, execution-grade language must be used to ensure clarity and efficiency.
3. **Anti-bureaucratic**: Avoid bureaucratic jargon and focus on practical implementation details.
4. **Deterministic Effects**: All effects must remain deterministic to maintain the integrity of the game's mechanics.
5. **TypeScript Standards**: Strict TypeScript coding standards, including strict mode and avoiding the use of 'any', should be adhered to.
6. **Prevent Ladder Pollution**: Ensure that the implementation does not introduce unnecessary complications or inconsistencies into the game's progression (ladder pollution).

## Implementation Spec

### Share Object Rules for Death Cards

1. Upon a player's death, all share objects owned by the deceased player are distributed among surviving players according to predefined rules.
2. The distribution process should be deterministic and transparent, ensuring fairness and preventing manipulation.
3. Each surviving player should receive a proportionate share of the deceased player's shares based on their current wealth relative to the total wealth of all surviving players.
4. If a share object is owned by multiple players at the time of death, it should be divided equally among those co-owners and distributed according to the rules above.
5. In case of ties in wealth distribution (e.g., two players have the same amount of wealth), the tie should be resolved randomly to maintain fairness.

### Safe Messaging

1. When sharing share objects, a safe messaging system should be implemented to prevent manipulation and ensure secure transfer.
2. The messaging system should use cryptographic techniques to verify the authenticity and integrity of the share object being transferred.
3. To prevent ladder pollution, the messaging system should not allow players to send or receive shares outside of the intended distribution process (e.g., death).
4. In case of disputes or errors, a dispute resolution mechanism should be in place to address issues and ensure fairness.

## Edge Cases

1. **Multiple Deaths**: If multiple players die simultaneously, their share objects should be distributed according to the rules above, with ties resolved randomly as needed.
2. **Share Splits**: In cases where a share object is split (e.g., through a governance action), the distribution of shares upon death should take into account the new share count and adjust proportions accordingly.
3. **Share Merges**: If share objects are merged, the combined share should be treated as a single entity for distribution purposes, with proportions adjusted accordingly based on the new total share count.
4. **Player Disconnections**: In case of player disconnections or account deletions, any shares owned by the disconnected player should be handled according to the rules above, with surviving players adjusting their wealth proportions accordingly.

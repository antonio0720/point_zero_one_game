# Membership Objects - pzo_season0_founding_era_waitlist_engine_v1 Documentation

## Overview

This document outlines the key components of membership objects in the Point Zero One Digital's Season 0 game. The membership objects include the Season0 Token, Identity Artifact Bundle, Proof Card Stamp, Founding Era Pass, and Membership State.

## Non-negotiables

1. All objects are strictly typed in TypeScript.
2. Strict mode is enforced for all code.
3. All effects are deterministic.
4. No use of 'any' type in TypeScript.

## Implementation Spec

### Season0 Token

- Represents the player's membership in Season 0.
- Unique identifier.
- Grants access to Season 0 content and features.

### Identity Artifact Bundle (IAB)

- A collection of five unique components: Badge, Emblem, Insignia, Medallion, and Seal.
- Each component has a unique identifier and associated metadata.
- IABs are non-transferable and unique to each player.

#### Badge

- Represents the player's role or status within the game community.
- Unique identifier.
- Associated metadata includes name, description, and image URL.

#### Emblem

- Represents the player's guild or alliance affiliation.
- Unique identifier.
- Associated metadata includes name, description, and image URL.

#### Insignia

- Represents the player's personal achievement or milestone.
- Unique identifier.
- Associated metadata includes name, description, and image URL.

#### Medallion

- Represents the player's financial contribution to the game.
- Unique identifier.
- Associated metadata includes amount contributed and date of contribution.

#### Seal

- Represents the player's participation in special events or promotions.
- Unique identifier.
- Associated metadata includes event name, date, and description.

### Proof Card Stamp (PCS)

- A digital stamp that verifies ownership of specific IAB components.
- Each PCS has a unique identifier and associated metadata.
- PCSs are transferable between players.

#### Fields

- `componentId`: The unique identifier of the associated IAB component.
- `ownerId`: The unique identifier of the current owner of the PCS.
- `timestamp`: The date and time when the PCS was created or last transferred.

### Founding Era Pass (FEP)

- A limited-edition pass for players joining during the game's founding era.
- Grants exclusive benefits and early access to certain features.
- Non-transferable and unique to each player.

### Membership State

- Represents the player's current membership status.
- Includes streak, freezes, and progress data.

#### Streak

- Tracks consecutive days the player has logged in or made a transaction.
- Reset when the player misses a day or makes no transactions for a specified period.

#### Freezes

- Temporary lockout periods due to inactivity or violation of game rules.
- Duration and reasons for freezes are recorded.

#### Progress

- Tracks the player's progress through Season 0 content and features.
- Includes completed levels, unlocked rewards, and earned achievements.

## Edge Cases

1. In case of a duplicate IAB component, the newer one will overwrite the existing one in the player's inventory.
2. If a player attempts to transfer a PCS that is not owned by them, the transaction will be rejected.
3. If a player violates game rules, they may face a freeze period, during which their membership state will reflect the freeze status.
4. In case of a system error or maintenance, the player's membership state may temporarily be affected, but all data will be restored upon system recovery.

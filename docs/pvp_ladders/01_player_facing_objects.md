# Player-Facing Objects in PvP Ladders

This document outlines the defined nouns and states for the player-facing objects within the PvP ladders of Point Zero One Digital's 12-minute financial roguelike game.

## Overview

The following entities are crucial to the player experience in our PvP ladders: `CasualRankEntry`, `VerifiedRankEntry`, `EligibilityChecklist`, `PendingPlacement`, `Quarantine`, and `RewardClasses`. This document provides a detailed description of each, along with non-negotiables, implementation specifications, and edge cases where relevant.

## CasualRankEntry

A `CasualRankEntry` represents a player's position in the casual rankings. It includes the following attributes:

1. Player ID (unique identifier for the player)
2. Rank (position within the casual rankings)
3. Score (calculated based on game performance)
4. Last Updated Timestamp (the time when the entry was last updated)

Non-negotiables:

1. The `Player ID` must be a string of alphanumeric characters, ensuring uniqueness across all players.
2. The `Rank` and `Score` should be integers, with the rank being 1 for the highest position.
3. The `Last Updated Timestamp` should be in ISO 8601 format (YYYY-MM-DDTHH:MM:SS.sssZ).

## VerifiedRankEntry

A `VerifiedRankEntry` is similar to a `CasualRankEntry`, but it requires additional verification for the player's identity. It includes the following attributes:

1. Player ID (unique identifier for the player)
2. Rank (position within the verified rankings)
3. Score (calculated based on game performance and identity verification)
4. Last Updated Timestamp (the time when the entry was last updated)
5. Verification Status (indicates whether the player's identity has been successfully verified or not)

Non-negotiables:

1. The `Player ID`, `Rank`, `Score`, and `Last Updated Timestamp` should follow the same rules as in a `CasualRankEntry`.
2. The `Verification Status` can be either "verified" or "unverified".

## EligibilityChecklist

An `EligibilityChecklist` outlines the requirements for a player to participate in PvP matches and climb the rankings. It includes the following attributes:

1. Player ID (unique identifier for the player)
2. Completed Checks (an array of check names that have been completed by the player)
3. Incomplete Checks (an array of check names that still need to be completed by the player)
4. Last Updated Timestamp (the time when the checklist was last updated)

Non-negotiables:

1. The `Player ID` must follow the same rules as in a `CasualRankEntry`.
2. The `Completed Checks` and `Incomplete Checks` should be arrays of strings, with each string representing a specific check (e.g., "email verification", "age verification").
3. The `Last Updated Timestamp` should follow the same rules as in a `CasualRankEntry`.

## PendingPlacement

A `PendingPlacement` represents a player who is currently waiting for their placement in the rankings due to a recent match or update. It includes the following attributes:

1. Player ID (unique identifier for the player)
2. Match ID (unique identifier for the match that resulted in the pending placement)
3. Placement Status (indicates whether the player's placement is still pending or has been finalized)
4. Last Updated Timestamp (the time when the `PendingPlacement` was last updated)

Non-negotiables:

1. The `Player ID`, `Match ID`, and `Last Updated Timestamp` should follow the same rules as in a `CasualRankEntry`.
2. The `Placement Status` can be either "pending" or "finalized".

## Quarantine

A `Quarantine` is a state for players who have been temporarily banned from participating in PvP matches due to violations of the game's rules. It includes the following attributes:

1. Player ID (unique identifier for the player)
2. Reason for Quarantine (a string explaining why the player was quarantined)
3. Start Date (the date and time when the quarantine began)
4. End Date (the date and time when the quarantine will end, if applicable)
5. Last Updated Timestamp (the time when the `Quarantine` was last updated)

Non-negotiables:

1. The `Player ID`, `Start Date`, and `Last Updated Timestamp` should follow the same rules as in a `CasualRankEntry`.
2. The `Reason for Quarantine` should be a string explaining the violation that led to the quarantine.
3. If an `End Date` is provided, it should follow the same rules as the `Start Date`.

## RewardClasses

A `RewardClass` represents a category of rewards that can be earned by players based on their performance in PvP matches and other activities. It does not include specific reward details but serves as an identity for each class. The following attributes are included:

1. Class Name (a unique identifier for the reward class)
2. Description (a brief explanation of the rewards associated with this class)
3. Last Updated Timestamp (the time when the `RewardClass` was last updated)

Non-negotiables:

1. The `Class Name` should be a unique string for each reward class.
2. The `Description` should provide a clear and concise explanation of the rewards associated with the class.
3. The `Last Updated Timestamp` should follow the same rules as in a `CasualRankEntry`.

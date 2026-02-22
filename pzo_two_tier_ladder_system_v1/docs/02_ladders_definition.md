# Two-Tier Ladder System Documentation - v1

## Overview

The Two-Tier Ladder System is a crucial component of Point Zero One Digital's gaming infrastructure, providing a structured competition environment for players in our financial roguelike game. This system consists of two primary ladders: Casual and Verified, each with its unique characteristics and rules.

## Non-Negotiables

1. **Determinism**: All ladder operations must be deterministic to ensure fairness and reproducibility.
2. **Strict TypeScript**: All code adheres to strict TypeScript mode for type safety and consistency.
3. **No 'any'**: The use of the 'any' type is strictly prohibited to maintain type safety.
4. **Optimistic vs Hard-Gate Mechanisms**: Casual and Verified ladders utilize different mechanisms (optimistic publish and hard-gate/proof-backed, respectively) for publishing and verifying player progress.

## Ladder Taxonomy

### Casual Ladders

- Global Casual: A continuously running ladder open to all players, with no restrictions on entry or exit. Progress is optimistically published without immediate verification.
- Daily Leagues: Temporary ladders that reset daily, offering a fresh competition each day. Players can join and leave at will.
- Event Leagues: Special ladders associated with specific events, such as tournaments or promotions. These ladders have defined start and end times.

### Verified Ladders

- Global Verified: A continuously running ladder open to all players, but progress requires proof-backed verification.
- Season Leagues: Temporary ladders that span multiple days (e.g., a month or a season), with defined start and end times. Progress requires proof-backed verification.
- Weekly Leagues: Temporary ladders that reset weekly, offering a fresh competition each week. Progress requires proof-backed verification.

## Ladder Definition Object Schema

Each ladder definition object must include the following properties:

1. `name` (string): The unique identifier for the ladder (e.g., "GlobalCasual", "DailyLeague1").
2. `type` (enum): The type of ladder, either "casual" or "verified".
3. `duration` (enum|number): The duration of the ladder, either a string representing the type (e.g., "daily", "weekly", "season") or a number for continuous ladders (e.g., Global Casual).
4. `entryRequirements` (object): An object defining any prerequisites for joining the ladder (e.g., minimum score, specific event participation).
5. `exitRules` (array): An array of rules governing when and how a player can leave the ladder (e.g., after a certain number of games, at the end of the duration).
6. `verificationMechanism` (enum|function): The mechanism used to verify progress in Verified ladders. For Casual ladders, this property is optional and should be set to null or an empty function.
7. `rewards` (object): An object defining the rewards associated with each rank in the ladder.

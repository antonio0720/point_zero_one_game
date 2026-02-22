# Remote Config Safety Rails

This document outlines the allowable and disallowed modifications through remote configuration in Point Zero One Digital's financial roguelike game. Strict adherence to these rules ensures a fair, deterministic, and production-ready gaming experience.

## Non-negotiables

1. **Engine RNG**: The engine's random number generator (RNG) is non-modifiable via remote configuration. All RNG outcomes must be determined at compile time to maintain game integrity.

2. **Macro Parameters in Ranked Games**: Macro parameters, such as win conditions or reward distributions, are not modifiable during ranked games. This ensures a fair and consistent competitive environment.

3. **Verifier Rules**: Verifier rules governing the validation of transactions and player actions cannot be modified remotely. These rules form the backbone of the game's security and must remain unchanged to maintain trust among players.

4. **Ladder Eligibility**: Players' eligibility for ladders, including rankings and rewards, cannot be altered through remote configuration. This ensures a transparent and fair competitive system.

## Implementation Spec

1. Remote config modifications should only affect non-critical game parameters, such as cosmetic items, difficulty levels, or tutorial content.

2. All changes to remote config must undergo thorough testing to ensure they do not impact the game's deterministic nature or compromise security.

3. Changes to remote config should be versioned and logged for auditing purposes.

## Edge Cases

1. In the event of a critical bug or security vulnerability, an emergency hotfix may temporarily override the non-negotiables listed above. However, such exceptions must be rare and carefully documented.

2. For seasonal events or limited-time promotions, certain game parameters may be modified remotely. These modifications should not impact the core gameplay mechanics or compromise security.

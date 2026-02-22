# Remote Config Knobs: Safe vs Unsafe

This document outlines the distinction between safe and unsafe remote config knobs in Point Zero One Digital's financial roguelike game, focusing on their implications, non-negotiables, implementation specifications, and edge cases.

## Overview

Remote configuration (remote-config) is a mechanism that allows for dynamic adjustment of game parameters during runtime without requiring a new build or deployment. This document categorizes remote-config knobs into safe and unsafe based on their impact on the game's determinism, security, and stability.

## Non-negotiables

1. All remote-config knobs must be strictly typed in TypeScript to ensure type safety.
2. Strict mode must always be enabled for all code related to remote-config.
3. All effects of remote-config knobs must be deterministic to maintain the game's integrity and reproducibility.
4. Remote-config changes should not compromise the game's security or stability.

## Implementation Spec

### Safe Knobs

Safe knobs are those that do not affect the game's core mechanics, balance, or determinism. They can be safely adjusted remotely without impacting the game's integrity. Examples include:

- UI scaling factors
- Debug logging levels
- Analytics event tracking

### Unsafe Knobs

Unsafe knobs are those that can potentially affect the game's core mechanics, balance, or determinism. They should be used sparingly and with caution due to their potential impact on the game's integrity. Examples include:

- Monetization parameters (e.g., price of in-game items)
- Game balancing values (e.g., enemy health, player stats)
- Deterministic seed values for random number generation

### Config Split

To ensure the game's stability and security, it is recommended to split remote-config into multiple tiers:

1. Production config: Contains stable, non-changing parameters that are essential for the game's operation.
2. Development config: Contains parameters that are specific to the development environment or testing purposes.
3. Live config: Contains parameters that can be safely adjusted during live operations, such as safe knobs.
4. Emergency config: Contains parameters that should only be used in emergency situations and have a significant impact on the game's core mechanics or balance. These parameters should be used sparingly and with caution due to their potential impact on the game's integrity.

## Edge Cases

1. In some cases, it may be necessary to adjust unsafe knobs during live operations. This should only be done after thorough testing and consideration of the potential impact on the game's integrity.
2. It is essential to ensure that remote-config changes are properly versioned and rolled out in a controlled manner to minimize the risk of introducing bugs or instability into the game.

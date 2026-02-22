# Offer Governance in Point Zero One Digital Games

This document outlines the governance rules for offers within the context of our financial roguelike game, Point Zero One Digital.

## Non-negotiables

1. **Forbidden offer contexts**: Offers must not be presented during:
   - Game loading or saving processes
   - Player death or victory sequences
   - In-game tutorials or initial onboarding
   - Any other critical game events that may disrupt the player's focus

2. **Allowed offer contexts**: Offers can be presented during:
   - Idle periods, such as waiting for resource generation or AI decision-making
   - Paused game states, provided the player has voluntarily paused the game
   - Non-critical UI transitions, like menu navigation or inventory management

3. **Frequency caps and cooldowns**: To prevent spamming and maintain a fair gaming experience:
   - A maximum number of offers per session is set
   - A minimum time interval (cooldown) must elapse between each offer

4. **Loss-recovery protection**: Players should not be offered any incentives during loss recovery, such as game over or bankruptcy scenarios.

## Implementation Spec

The offer system will be implemented using deterministic algorithms to ensure fairness and reproducibility. The frequency of offers will be controlled by a random number generator with a predefined range, ensuring that the maximum number of offers per session is not exceeded.

Cooldowns between offers will be enforced using a timer system, with adjustable intervals based on game state and player behavior.

Loss-recovery protection will be implemented by disabling the offer system during these scenarios and re-enabling it once the player has resumed normal gameplay.

## Edge Cases

1. **Player-initiated pauses**: If a player voluntarily pauses the game, offers may still be presented during this pause, as long as they do not interfere with the player's ability to resume or unpause the game.

2. **Idle periods and AI decision-making**: The offer system should prioritize offering incentives during longer idle periods or when the AI is making decisions that may take some time, such as calculating optimal moves or resource allocation.

3. **Game updates and patches**: Any changes to the offer governance rules will be communicated to players through in-game notifications and/or release notes, ensuring transparency and fairness.

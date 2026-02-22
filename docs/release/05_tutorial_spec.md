# Point Zero One Digital Tutorial Spec - First Run Arc

This document outlines the specifications for the tutorial experience in Point Zero One Digital's financial roguelike game. The goal is to ensure a consistent, engaging, and confidence-building first run for players while setting the stage for subsequent gameplay.

## Non-negotiables

1. **Survival Guarantee**: Players must be guaranteed to survive for at least 3 turns during their initial run. This provides an opportunity to familiarize themselves with the game mechanics and build confidence.
2. **Tooltips Duration**: Tooltips should display for a maximum of 5 seconds. This ensures that information is presented concisely without causing unnecessary pauses in gameplay.
3. **No Pauses**: There should be no pauses between tooltip appearances. The game should flow smoothly from one event to the next, maintaining an engaging pace.
4. **Skip Option**: After completing the tutorial (Tutorial 1), players should have the option to skip subsequent tutorials if they choose to do so. This caters to experienced players who may not require further guidance.
5. **Second Run Conversion**: Strive to convert at least 80% of players into attempting a second run within their initial game session. This encourages player retention and engagement.

## Implementation Spec

1. **Survival Guarantee**: Implement a system that ensures the player's assets are protected for the first three turns, providing them with a risk-free introduction to the game.
2. **Tooltips Duration**: Limit tooltip display time to 5 seconds using JavaScript timers or similar mechanisms.
3. **No Pauses**: Utilize asynchronous functions and event-driven programming to ensure smooth transitions between game events without pauses.
4. **Skip Option**: Implement a skip button for tutorials after the initial one, allowing players to bypass subsequent guidance if they wish.
5. **Second Run Conversion**: Design the tutorial and early game experience in such a way that it encourages players to continue playing and attempt a second run. This could involve offering rewards or presenting engaging challenges.

## Edge Cases

1. **Player Skill Level**: Adapt the tutorial experience based on player performance during the initial runs. For example, if a player demonstrates advanced understanding of the game mechanics, they may be presented with more challenging scenarios earlier in the tutorial.
2. **Device Performance**: Optimize the tutorial and game for various devices to ensure smooth performance and minimize potential lags or delays that could disrupt the intended 5-second tooltip duration.

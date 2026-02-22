# Player Promise: Death Yields Package

## Overview

This document outlines the design and implementation of a player-facing promise in Point Zero One Digital's financial roguelike game. Upon the player's death, a package is delivered that includes a Cause-of-Death card, one counterfactual fork, and one targeted training recommendation.

## Non-Negotiables

1. **Determinism**: The package contents must be deterministic, ensuring fairness and reproducibility of gameplay.
2. **Strict TypeScript**: All code adheres to strict TypeScript mode for type safety and consistency.
3. **No 'any'**: Avoid using the `any` type in TypeScript to maintain type safety and readability.
4. **Production-Grade**: The implementation must be deployment-ready, meeting production standards of quality and performance.

## Implementation Spec

### Cause-of-Death Card

Upon death, the game should generate a Cause-of-Death card that provides insight into the factors leading to the player's demise. This card will be generated based on the player's actions and financial decisions during the game.

### Counterfactual Fork

A counterfactual fork is a simulation of an alternative decision path that the player could have taken. The fork should present the player with a hypothetical scenario demonstrating how their strategy might have led to a different outcome.

### Targeted Training Recommendation

Based on the Cause-of-Death card and counterfactual fork, the game will provide a targeted training recommendation tailored to the player's weaknesses and areas for improvement. This recommendation will help the player learn from their mistakes and improve their financial management skills in future games.

## Edge Cases

1. **Multiple Causes of Death**: In cases where multiple factors contribute to the player's death, the game should prioritize the most significant cause and provide a comprehensive explanation.
2. **Complex Counterfactual Scenarios**: The game should handle complex counterfactual scenarios by breaking them down into manageable parts, ensuring that players can understand and learn from each aspect.
3. **Personalized Training Recommendations**: To cater to different learning styles and preferences, the training recommendations should be customizable and adaptive, allowing players to choose the format and content that best suits their needs.

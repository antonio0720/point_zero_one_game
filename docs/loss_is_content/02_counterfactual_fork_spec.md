# Counterfactual Fork Specification for Practice Mode

## Overview

The Counterfactual Fork is a practice-only feature in Point Zero One Digital's 12-minute financial roguelike game, designed to allow players to experiment with different strategies and decisions without affecting their ladder or trophy standings. This fork is explicitly not eligible for ladders or trophies to prevent abuse and maintain fair competition.

## Non-Negotiables

1. The Counterfactual Fork must be initiated from a snapshot at Tick N-Δ, ensuring that all subsequent decisions and outcomes are based on this specific state.
2. The Counterfatal Fork must not affect the player's ladder or trophy standings to maintain fairness and prevent abuse.
3. Anti-abuse controls must be in place to prevent manipulation of the game system through excessive use of the Counterfactual Fork.

## Implementation Spec

1. Upon initiating a Counterfactual Fork, the game state will be copied from Tick N-Δ and all subsequent decisions and outcomes will be based on this new state.
2. The player's actions within the Counterfactual Fork will not affect their ladder or trophy standings.
3. Anti-abuse controls will monitor the frequency of Counterfactual Fork usage to prevent manipulation of the game system. Excessive use may result in temporary or permanent restrictions on this feature.

## Edge Cases

1. If a player initiates a Counterfactual Fork and then returns to their main game, any changes made during the practice run will not be reflected in the main game.
2. If a player initiates multiple Counterfactual Forks concurrently, the anti-abuse controls may flag this as excessive usage and apply restrictions.
3. If a player attempts to manipulate the game system through the use of the Counterfactual Fork, their account may be subject to review and potential penalties.

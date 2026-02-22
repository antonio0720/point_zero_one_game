# Point Zero One Digital: Core Loop Specification - Game Logic

This document outlines the core loop definition for the 12-minute financial roguelike game developed by Point Zero One Digital. The focus is on a production-grade, deployment-ready infrastructure with strict TypeScript adherence and deterministic effects.

## Overview

The core loop consists of a series of steps that form the backbone of the gameplay experience. These steps include:

1. Choosing a Goal
2. Choosing a Profile
3. Executing 8-12 turns (card + decision)
4. Resolving outcomes
5. After Action
6. Queuing the next run

## Non-negotiables

1. Strict TypeScript adherence: Never use 'any' in TypeScript. All code is strict-mode.
2. Deterministic effects: Every action and outcome must be predictable to ensure fairness and reproducibility.
3. 12-minute target runtime: The game should aim for a consistent 12-minute playthrough, with optimization for performance and user experience.

## Implementation Spec

### Choosing a Goal

The player selects an objective from the available goals at the start of each run. This goal determines the overall strategy and objectives during the gameplay.

### Choosing a Profile

Upon selecting a goal, the player chooses a profile that provides unique abilities, advantages, or disadvantages throughout the game. Profiles should be balanced to ensure fairness among players.

### Executing Turns (8-12)

Each turn consists of drawing a card and making a decision based on the card's effects and the player's current situation. The number of turns varies between 8 and 12, with the goal of reaching the 12-minute target runtime.

### Resolving Outcomes

The outcomes of each turn are resolved immediately, updating the game state accordingly. This includes any changes to resources, status effects, or progress towards the chosen goal.

### After Action

After all turns have been completed, an "After Action" phase occurs where players can review their performance, make adjustments, and prepare for the next run if necessary.

### Queuing the Next Run

Once the player is ready, they queue the next run, which starts with choosing a new goal and profile.

## Edge Cases

- If a player takes longer than 12 minutes to complete a run, the game should provide an option for them to continue or end the run early.
- In case of network issues or unexpected errors, the game should have mechanisms in place to handle these situations gracefully and minimize user frustration.

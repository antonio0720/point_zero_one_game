# Invariant Policy for Point Zero One Digital's Financial Roguelike Game

## Overview

This document outlines the invariant policy for our financial roguelike game developed by Point Zero One Digital. The policy defines critical rules that must always hold true, violation handling procedures, and the format for an evidence chain to ensure fairness and transparency.

## Non-negotiables

1. **Deterministic Gameplay**: All game effects are deterministic, ensuring a consistent experience for all players regardless of their hardware or software configuration.
2. **Strict TypeScript Coding Standards**: Never use the 'any' type in TypeScript. All code is written in strict mode to maintain type safety and prevent runtime errors.
3. **Production-Grade, Deployment-Ready Infrastructure**: Our infrastructure is designed for robustness, scalability, and reliability, ensuring a smooth gaming experience for players.

## Implementation Spec

### Defining Invariants

Invariants are the rules that must always hold true within the game's logic. These include but are not limited to:

- Game state integrity (e.g., player resources, game progress)
- Fairness in random number generation and event distribution
- Consistency in game mechanics and interactions

### Violation Handling

Violations of invariants will be handled as follows:

1. **Detection**: Invariants are continuously monitored during gameplay to identify potential violations.
2. **Isolation**: If a violation is detected, the game session will be isolated to prevent further impact on other players or game data.
3. **Investigation**: The incident will be investigated by our team to determine the cause and extent of the violation.
4. **Resolution**: Depending on the severity and nature of the violation, corrective actions may include rolling back affected game states, issuing compensation to affected players, or banning offending accounts.
5. **Reporting**: Players will be notified about the incident, the resolution, and any necessary actions they need to take (e.g., account recovery).

### Evidence Chain Format

An evidence chain is a record of events leading up to an invariant violation. It includes:

- Timestamps for each event
- Actions taken by the player or game system
- Relevant game state data before and after the incident
- Any other pertinent information that can help explain the violation

The evidence chain will be stored securely and made available to our team during investigations. Players may also have access to a truncated version of their own evidence chains for transparency purposes.

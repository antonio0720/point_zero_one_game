# Telemetry Map for First-3-Runs Funnel, Death Causes, Lethal Cards, Economy Sinks, UX Friction, Delight Spikes, Verification Health

## Overview

This telemetry map outlines key metrics and events to monitor during the first three runs of a player in Point Zero One Digital's 12-minute financial roguelike game. The focus is on understanding funnel progression, death causes, lethal cards, economic sinks, UX friction points, delight spikes, and verification health.

## Non-Negotiables

1. Strict adherence to TypeScript's strict mode with no usage of 'any'.
2. Deterministic effects for reliable data analysis.
3. Production-grade, deployment-ready telemetry implementation.

## Implementation Spec

### First-3-Runs Funnel

- Track the number of players who complete their first, second, and third runs.
- Analyze drop-off rates between each run to identify potential issues or areas for improvement.

### Death Causes

- Record the cause of death during each play session (e.g., enemy attack, resource depletion, misplay).
- Identify common causes leading to player deaths and adjust game balance accordingly.

### Lethal Cards

- Monitor which cards consistently lead to player deaths when drawn or played.
- Consider rebalancing problematic cards or providing counter strategies for players.

### Economy Sinks

- Track the rate at which resources are spent during each play session.
- Identify areas where resources are being wasted or not utilized effectively, and make adjustments as needed.

### UX Friction

- Measure the time it takes players to complete various actions within the game (e.g., card selection, resource management).
- Optimize user interface elements to reduce friction and improve player experience.

### Delight Spikes

- Identify moments in the game that elicit positive emotional responses from players (e.g., successful strategies, unexpected rewards).
- Reinforce these moments to encourage repeat play and foster a more engaging experience.

### Verification Health

- Monitor the accuracy and completeness of telemetry data being collected.
- Ensure all events are properly tracked and reported for analysis.

## Edge Cases

- Account for players who may skip or rush through certain parts of the game, potentially affecting funnel progression and UX friction metrics.
- Handle cases where players encounter bugs or glitches that could impact gameplay and telemetry data collection.

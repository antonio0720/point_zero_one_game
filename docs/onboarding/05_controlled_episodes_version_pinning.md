# Controlled Episodes Version Pinning

## Overview

This document outlines the approach for using episodes/scenarios and version pinning to ensure reproducibility of Run1/2/3, content hashing, and a rollback strategy in Point Zero One Digital's 12-minute financial roguelike game.

## Non-negotiables

- Use strict TypeScript with no 'any' types.
- All code is written in strict mode.
- All effects are deterministic.

## Implementation Spec

### Episodes/Scenarios

Each episode or scenario within the game will be versioned and managed separately to ensure reproducibility across different runs of the game. This includes the game's assets, rules, and any other data that affects the gameplay.

### Version Pinning

Each episode or scenario will have a unique version number associated with it. When starting a new run, the specific versions of episodes/scenarios are pinned to ensure consistency in the gameplay experience.

### Content Hashing

To further ensure reproducibility and prevent unintended changes, each episode or scenario's data will be hashed before being versioned. This hash can then be used to verify that the data hasn't been altered since it was originally pinned for a run.

### Rollback Strategy

In case of any issues or bugs discovered during a run, a rollback strategy is implemented. By pinning to an earlier version of an episode/scenario, the game can be rolled back to a known-good state and continue from there.

## Edge Cases

### Version Conflicts

In cases where multiple episodes or scenarios have conflicting versions pinned for the same run, a priority system will be implemented to resolve these conflicts. This could involve prioritizing certain episodes/scenarios based on their importance to the gameplay experience or by using a version numbering system that allows for more granular control over updates.

### Data Corruption

In the event of data corruption, the rollback strategy will be crucial. However, additional measures such as regular backups and error handling code should also be implemented to minimize the risk of data corruption and ensure smooth gameplay.

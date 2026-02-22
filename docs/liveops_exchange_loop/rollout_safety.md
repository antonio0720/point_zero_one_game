# Rollout Safety in LiveOps Exchange Loop

## Overview

This document outlines the safety measures implemented in the rollout process of Point Zero One Digital's 12-minute financial roguelike game, focusing on staged rollouts, holdback cohorts, kill switches, and rollback steps.

## Non-Negotiables

1. **Staged Rollout**: Deployments are rolled out in stages to a percentage of users, allowing for monitoring and mitigation of any issues before they affect the entire user base.
2. **Holdback Cohorts**: A portion of users are held back from receiving updates during rollouts, providing a control group for comparison and potential reversion if necessary.
3. **Kill Switches**: Mechanisms to instantly halt deployment in case of critical issues or unexpected behavior.
4. **Rollback Steps**: Procedures to revert the game to a previous stable state in case of deployment failures or user backlash.

## Implementation Spec

### Staged Rollout

- Deployments are divided into multiple stages, each targeting a specific percentage of users.
- After each stage, monitoring and analysis are performed before proceeding to the next one.
- The rollout process continues until the entire user base has been updated.

### Holdback Cohorts

- A predefined percentage of users are not updated during deployments, serving as a control group for comparison with updated users.
- This allows for identifying any issues that may have arisen from the deployment and taking corrective action if necessary.

### Kill Switches

- Instant halt mechanisms (kill switches) are implemented at various levels of the system to allow for immediate intervention in case of critical issues or unexpected behavior.
- These kill switches can be triggered manually by operators or automatically based on predefined conditions.

### Rollback Steps

- In case of deployment failures or user backlash, procedures are in place to revert the game to a previous stable state.
- This includes reverting database changes, undoing code modifications, and restoring affected users to their previous version of the game.

## Edge Cases

- In situations where a critical issue affects a large portion of users, the rollout process may be paused or reversed entirely to minimize user impact.
- If a kill switch is triggered due to an unexpected issue, it's crucial to identify and address the root cause before resuming deployments to prevent similar incidents in the future.

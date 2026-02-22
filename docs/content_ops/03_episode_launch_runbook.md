# Episode Launch Runbook

## Overview

This runbook outlines the steps for launching a new episode in Point Zero One Digital's financial roguelike game. The process includes validation, sandbox testing, balance check, feature flag deployment, and player communication. A rollback procedure is also provided in case of any issues.

## Non-Negotiables

1. Strict TypeScript: Never use 'any'. All code should be written in strict mode.
2. Deterministic effects: All game effects must be deterministic to ensure consistency across all runs.
3. Production-grade: The code should be deployment-ready and adhere to best practices for production environments.
4. Communication: Clear and timely communication with the team and players is essential throughout the process.

## Implementation Spec

1. **Authoring**: Developers create new content for the episode, ensuring it aligns with game design principles and balance requirements.

2. **Validation**: The content is validated by a second developer to ensure it meets quality standards and does not introduce any bugs or inconsistencies.

3. **Sandbox Testing**: The episode is tested in a sandbox environment to verify its functionality and balance. This includes testing all game mechanics, user interfaces, and interactions.

4. **Balance Check**: Balance adjustments are made as necessary based on the results of the sandbox testing.

5. **Feature Flag Deployment**: The episode is deployed with a feature flag to control its availability in the live game.

6. **Launch**: Once approved, the feature flag is toggled to make the new episode available to players.

## Edge Cases

- If any issues are discovered during testing or after launch, the rollback procedure should be initiated to revert the game to a previous stable state.
- In case of significant balance issues, additional adjustments may need to be made post-launch, with clear communication to players about any changes and their impact on the game.

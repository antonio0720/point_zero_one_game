# Point Zero One Digital Pack Authoring Workflow

This document outlines the human workflow for creating game packs in Point Zero One Digital's financial roguelike game, with emphasis on strict guardrails, rollback rules, and a comparability pledge.

## Overview

The pack authoring workflow is designed to ensure efficient, consistent, and high-quality creation of game content. It enforces strict rules, provides clear rollback procedures, and guarantees compatibility across all game versions.

## Non-negotiables

1. **Use Strict TypeScript**: All code must be written in strict mode to maintain consistency and prevent errors. Avoid using the `any` type.
2. **Deterministic Effects**: All game effects should be deterministic, ensuring reproducible results across different runs.
3. **Deployment-Ready Infrastructure**: All packs must adhere to production-grade standards for seamless deployment and integration with the game.
4. **Human Workflow**: The workflow is designed around human interaction, balancing automation with manual oversight to maintain quality and creativity.

## Implementation Spec

1. **Code Development**: Write all code in strict TypeScript, avoiding the `any` type. Use deterministic algorithms for game effects.
2. **Unit Testing**: Implement unit tests to verify the correctness of individual functions and components.
3. **Integration Testing**: Combine pack components and test their interaction within the game environment.
4. **Code Review**: Submit code for review by a designated team member, who will ensure adherence to non-negotiables and provide feedback for improvement.
5. **Deployment**: Once approved, deploy the pack to the game's infrastructure for testing in a controlled environment.
6. **Player Testing**: Gather player feedback on the new pack, addressing any issues or balancing concerns that arise.
7. **Rollback Rules**: If critical issues are discovered during player testing, implement a rollback procedure to revert the pack to a previous version until the issue is resolved.
8. **Comparability Pledge**: Ensure compatibility with all game versions and maintain backward compatibility for future updates.

## Edge Cases

1. **Critical Issues**: In cases where critical issues are discovered during deployment, follow the rollback rules to revert the pack until a fix can be implemented.
2. **Version Compatibility**: Maintain compatibility with all game versions, ensuring that new packs do not break existing content or introduce unintended consequences.
3. **Code Review Feedback**: Address feedback from code reviews promptly and thoroughly to maintain high-quality code and adherence to non-negotiables.

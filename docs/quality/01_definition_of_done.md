# Definition of Done Checklist for Point Zero One Digital Projects

## Overview

This checklist outlines the criteria that must be met to consider a project completed and ready for deployment at Point Zero One Digital. The focus is on ensuring quality, security, and reliability in our 12-minute financial roguelike game and infrastructure architect designs.

## Non-negotiables

1. **Unit Tests Passing**: All unit tests must pass without any failures or errors. This ensures that individual components of the codebase function as intended.

2. **Integration Tests Passing**: Integration tests should also pass, verifying that different modules work together seamlessly.

3. **e2e Smoke Test Passing**: End-to-end (e2e) smoke tests confirm that the core functionality of the application works as expected in various environments.

4. **Determinism Test Passing**: All effects in the game and infrastructure designs must be deterministic, ensuring consistent results across runs.

5. **Economy Invariant Test Passing**: Economy invariant tests should verify that the game's economy remains stable and balanced throughout play sessions.

6. **Security Scan Clean**: The project must pass a comprehensive security scan to ensure it is free of vulnerabilities that could be exploited by malicious actors.

7. **Docs Updated**: Documentation for the project should be up-to-date, including any changes made during development.

8. **OPS Dashboard Updated**: The Operations (OPS) dashboard should reflect the current state of the deployed application, including monitoring and logging configurations.

9. **Rollback Plan Documented**: A rollback plan detailing how to revert changes in case of issues or emergencies must be available.

## Edge Cases

In some cases, exceptions may arise that require deviations from the checklist. These should be addressed on a case-by-case basis, with the primary goal being to maintain the highest level of quality and reliability for our projects.

### TypeScript 'any' Avoidance

While strict-mode TypeScript is enforced across all codebases, there may be instances where using `any` is unavoidable or beneficial. In such cases, a justification should be provided, along with a plan to refactor the code as soon as possible to eliminate the use of `any`.

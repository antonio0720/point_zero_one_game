# Session 1 - Engine Upgrade (Part 1, Phase 1A) Runbook

## Overview

This runbook outlines the steps to perform the initial phase of the engine upgrade in PZO Digital's financial roguelike game. The focus is on strict-mode TypeScript code, deterministic effects, and production-grade infrastructure.

## Non-negotiables

1. Strict-mode TypeScript: All code must be written in strict mode to ensure type safety and avoid implicit any types.
2. Deterministic effects: All game effects should produce the same results given the same inputs, ensuring fairness and reproducibility.
3. Production-grade deployment: The changes made during this phase should be ready for production deployment without causing unintended side effects or instability.
4. No use of 'any': Avoid using the 'any' type in TypeScript to maintain type safety throughout the codebase.

## Implementation Spec

### Step 1: Preparation

- Ensure you have the latest version of the PZO Master Build Guide.
- Fork and clone the PZO Digital repository to your local machine.
- Navigate to the `pzo` directory within the cloned repository.

### Step 2: Code Modification

- Open the `src/engine/Engine.ts` file in a code editor.
- Locate the section of code responsible for handling the current game state (usually a class or function named `GameState`).
- Implement the changes necessary to support the new engine version, ensuring strict-mode TypeScript and no use of 'any'.

### Step 3: Testing

- Run smoke tests to verify that the changes made do not cause any unexpected issues.
- The smoke tests should cover basic functionality such as game initialization, player actions, and state updates.

## Edge Cases

- If you encounter any type-related errors during code modification, ensure that all variables are properly typed and that no implicit 'any' types are used.
- If the smoke tests reveal unexpected behavior or crashes, double-check your changes against the original code and verify that the new engine version is compatible with the modifications.

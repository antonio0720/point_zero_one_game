# Point Zero One Digital Experiment Playbook for "loss_is_content"

## Overview

This playbook outlines A/B plans and guardrails for various elements within the "loss_is_content" feature, including hint copy, snippet captions, fork N-Δ default, and training rec ordering. The focus is on strict adherence to TypeScript's strict mode and deterministic effects, ensuring production-grade, deployment-ready infrastructure.

## Non-Negotiables

1. **TypeScript Strict Mode**: All code must be written in TypeScript strict mode to ensure type safety and avoid any potential runtime errors.
2. **Deterministic Effects**: All game effects should be deterministic to maintain consistency across different runs.
3. **No Use of 'any'**: Avoid using the `any` type in TypeScript as it defeats the purpose of type checking.
4. **Precise Language**: Use execution-grade language that is clear, concise, and anti-bureaucratic.

## Implementation Spec

### Hint Copy A/B Plans

1. **Plan A**: Implement hints using a descriptive, yet concise tone to guide players without giving away too much information.
2. **Plan B**: Use a more direct approach with hints that provide clear instructions on how to progress in the game.
3. **Evaluation Metrics**: Track player engagement, completion rates, and feedback to determine which plan is more effective.

### Snippet Captions A/B Plans

1. **Plan A**: Use captions that are descriptive and provide context for each snippet.
2. **Plan B**: Use concise captions that only identify the snippet's purpose or function.
3. **Evaluation Metrics**: Track user interaction rates, time spent on each snippet, and feedback to determine which plan is more effective.

### Fork N-Δ Default

1. **Default Behavior**: Set the default behavior for forks to be N-Δ (non-deterministic) to allow for a more dynamic gameplay experience.
2. **Guardrails**: Implement guardrails to prevent unintended consequences and ensure that the game remains balanced and fair.

### Training Rec Ordering

1. **Plan A**: Arrange training records in chronological order, starting from the earliest available record.
2. **Plan B**: Organize training records based on their difficulty level, starting with easier records and gradually increasing the difficulty.
3. **Evaluation Metrics**: Track player progress, completion rates, and feedback to determine which plan is more effective.

## Edge Cases

1. **Player Feedback**: If players consistently express confusion or frustration with a particular element (e.g., hints, snippet captions), reevaluate the current approach and consider implementing changes based on player feedback.
2. **Game Balance**: Monitor game balance closely to ensure that any changes made do not unintentionally favor one playstyle over another or create an unfair advantage for certain players.
3. **Performance Optimization**: Regularly review and optimize the codebase to maintain optimal performance and minimize potential issues during deployment.

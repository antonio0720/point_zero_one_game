# Point Zero One Digital Experiment Playbook

## Overview

This playbook outlines A/B plans for FUBAR event intensity, after-screen copy variants, macro twist timing, and proof UI timing with guardrails in the 12-minute financial roguelike game developed by Point Zero One Digital. The focus is on strict-mode TypeScript code that ensures deterministic effects and production-grade, deployment-ready infrastructure.

## Non-Negotiables

1. Strict-mode TypeScript: All code adheres to strict-mode TypeScript to avoid any implicit type conversions or global variables.
2. Deterministic Effects: All game effects are designed to be deterministic, ensuring consistent results across different runs.
3. Anti-Bureaucratic Language: Precise, execution-grade language is used throughout the document and codebase to minimize fluff and promote clarity.
4. Guardrails: Implement guardrails for each experiment to ensure that changes do not negatively impact gameplay or user experience.

## Implementation Spec

### FUBAR Event Intensity A/B Plans

- Plan A: Increase the frequency of FUBAR events by 20%.
- Plan B: Decrease the severity of FUBAR events by 30%.
- Plan C: Randomly vary both event frequency and severity to create a more dynamic gameplay experience.

### After-Screen Copy Variants

- Variant A: Display a motivational quote encouraging players to try again after a loss.
- Variant B: Showcase a success story from another player to inspire continued play.
- Variant C: Offer tips and strategies for improving gameplay performance.

### Macro Twist Timing

- Timing A: Introduce macro twists at the midpoint of each level (6 minutes).
- Timing B: Randomly introduce macro twists between the 3rd and 7th minute of each level.
- Timing C: Delay macro twist introduction until the final 2 minutes of each level for a more intense climax.

### Proof UI Timing

- Timing A: Display proof UI elements at the end of each successful level (12 minutes).
- Timing B: Showcase proof UI elements after every macro twist event.
- Timing C: Randomly display proof UI elements throughout gameplay to maintain player engagement.

## Edge Cases

- If a FUBAR event occurs during the introduction of proof UI elements, pause the UI display until the event resolves and then resume as normal.
- In case of a macro twist event coinciding with after-screen copy variant display, delay the copy variant display until the macro twist has been resolved.

# Vibe Protection Rules for Point Zero One Digital Games

## Overview

The Vibe Protection Rules are a set of guidelines designed to maintain the unique and engaging atmosphere of Point Zero One Digital games during development. These rules ensure that our games remain production-grade, deployment-ready, and adhere to strict TypeScript standards while providing an enjoyable and focused work environment for all team members.

## Non-Negotiables

1. **No lectures in run loop**: The game's run loop should be free from any lectures or explanatory text. All educational content should be presented during scenario selection, post-run debrief, or optional dashboards.

2. **No forced reading**: Players should never be forced to read lengthy texts or tutorials during gameplay. Information should be presented in a way that is engaging and seamlessly integrated into the game's mechanics.

3. **No tests**: The curriculum is a wrapper only, with no built-in testing functionality. This allows for a more streamlined and focused development process.

## Implementation Spec

1. All code should be written in strict TypeScript mode to ensure type safety and adherence to best practices.
2. Avoid using the word 'any' in TypeScript. Instead, use explicit types to maintain type safety throughout the codebase.
3. All effects in the game should be deterministic to ensure consistent results across different runs and platforms.
4. Educational content should be presented in a way that is engaging and seamlessly integrated into the game's mechanics. This can include interactive tutorials, contextual hints, and post-run debriefs.
5. Optional dashboards may be provided to allow players to review their performance, learn more about the game's mechanics, or access additional content.

## Edge Cases

1. In cases where it is necessary to provide explanatory text during gameplay (e.g., for complex mechanics), consider using interactive tutorials that guide the player through the process without interrupting the flow of the game.
2. If a scenario requires a lecture or extended explanation, consider breaking it up into smaller, more digestible chunks that can be presented during scenario selection or post-run debrief.
3. In cases where tests are necessary for debugging or performance optimization, consider using external tools or integrating them into the optional dashboards rather than the main curriculum.

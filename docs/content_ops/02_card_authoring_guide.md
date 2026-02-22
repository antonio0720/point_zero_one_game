# Point Zero One Digital Card Authoring Guide

## Overview

This guide outlines the syntax and usage of our custom Domain Specific Language (DSL) for card authoring in Point Zero One Digital's financial roguelike game. The DSL enables you to create cards with specific effects, adhere to budget limits, test patterns, and follow a review checklist.

## Non-negotiables

1. Strict TypeScript mode: All code must be written in strict mode (`--strict`) to ensure type safety and consistency.
2. No usage of 'any': Type annotations are mandatory for all variables to maintain type safety.
3. Deterministic effects: All game effects should be deterministic, ensuring reproducible results across different runs.
4. Balance budget limits: Each card must adhere to the predefined budget constraints to maintain a balanced game economy.
5. Test patterns: Implement test patterns for each card to ensure functionality and compatibility with other cards in the game.
6. Review checklist: Follow the provided review checklist to ensure quality and consistency across all cards.
7. Version pinning: Pin dependencies to specific versions to maintain stability and avoid unexpected changes.
8. Retirement process: Follow the retirement process for outdated or underperforming cards to keep the game fresh and engaging.

## Implementation Spec

### DSL Syntax

The DSL syntax consists of a series of key-value pairs, where each key represents a card property (e.g., name, cost, effect), and the corresponding value is the associated data (e.g., string, number, function).

```markdown
CardName: {
  "name": "Card Name",
  "cost": 5,
  "effect": EffectOp,
}
```

### EffectOp Reference

EffectOps are functions that define the game effects of a card. They take an input state and return the updated state after applying the effect.

```typescript
function EffectOp(state: GameState): GameState {
  // Implement the effect logic here
}
```

### Edge Cases

Edge cases should be handled explicitly in the card implementation to ensure that the game behaves predictably under unusual circumstances.

## Testing and Review

Follow the provided testing and review checklist to ensure your cards meet our quality standards before merging them into the main game.

### Testing

1. Write unit tests for each card using a testing framework like Jest or Mocha.
2. Ensure that all tests pass before submitting the card for review.

### Review Checklist

1. Code quality: Is the code clean, well-organized, and easy to understand?
2. Type safety: Are all variables properly typed, and is 'any' avoided?
3. Deterministic effects: Do the card effects produce consistent results across different runs?
4. Budget compliance: Does the card adhere to the predefined budget constraints?
5. Test coverage: Have you written sufficient tests to cover all possible scenarios?
6. Documentation: Is the card documentation clear and comprehensive?
7. Compatibility: Does the card interact correctly with other cards in the game?
8. Edge cases: Have edge cases been handled appropriately?
9. Version pinning: Are dependencies pinned to specific versions?
10. Retirement process: If applicable, has the retirement process been followed for outdated or underperforming cards?

## Conclusion

By following this card authoring guide, you can create high-quality, production-grade cards for Point Zero One Digital's financial roguelike game that adhere to our strict standards and contribute to an engaging and balanced gaming experience.

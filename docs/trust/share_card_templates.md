# Share Card Templates Documentation

## Overview

This document outlines the specifications for defining share card variants, copy rules, and rendering inputs/outputs in Point Zero One Digital's financial roguelike game. The focus is on strict-mode TypeScript code that ensures deterministic effects and anti-bureaucratic language usage.

## Non-negotiables

1. **Share Card Variants**: Each share card must have a unique identifier (ID) and associated properties such as name, value, and any additional attributes relevant to the game's mechanics.

2. **Copy Rules**: Define rules for copying share cards during gameplay, including conditions under which a player can acquire new share cards from existing ones.

3. **Rendering Inputs/Outputs**: Specify how share card information is displayed on the user interface, ensuring clarity and consistency across all card types.

## Implementation Spec

### Share Card Variants

- Each variant should be defined as an object with a unique ID and associated properties:

```typescript
const shareCardVariants = {
  "ID1": { name: "Stock A", value: 50 },
  // ... more share card variants
};
```

### Copy Rules

- Define copy rules as functions that take a source share card and return the new share card(s) created from it. These functions should check for any conditions specified in the game's mechanics:

```typescript
function copyShareCard(source: ShareCard): ShareCard[] {
  // Implement copy rules here
}
```

### Rendering Inputs/Outputs

- Create a function to render share card information on the user interface. This function should take a share card object and return the corresponding markdown formatted string:

```typescript
function renderShareCard(shareCard: ShareCard): string {
  // Implement rendering logic here
}
```

## Edge Cases

- Handle edge cases such as duplicate IDs, missing properties in share card variants, and invalid input for the copy rules function. Ensure that the game behaves predictably under these conditions.

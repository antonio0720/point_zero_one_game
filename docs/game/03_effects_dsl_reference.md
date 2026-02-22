# Point Zero One Digital Effect DSL Reference for Card Authors

This document provides a comprehensive reference for the Effect DSL (Domain Specific Language) used in the creation of cards within the 12-minute financial roguelike game by Point Zero One Digital.

## Overview

The Effect DSL is a set of predefined operations (EffectOps) that card authors can use to define the behavior and interactions of their cards. The DSL ensures strict-mode TypeScript, deterministic effects, and adherence to production-grade standards.

## Non-negotiables

1. **No 'any' in TypeScript**: All code must be explicitly typed to ensure type safety and maintainability.
2. **Strict-mode**: All files should be written in strict mode (`--strict`) to enforce type checking and prevent implicit any.
3. **Deterministic effects**: All effects must be deterministic, ensuring consistent gameplay outcomes for a given set of inputs.

## Implementation Spec

### EffectOps

#### `Income(amount: number, frequency: string)`

Generates a recurring income with the specified amount and frequency (either 'daily' or 'monthly').

Example:
```markdown
Income(100, 'daily')
```

#### `Expense(amount: number, frequency: string)`

Generates a recurring expense with the specified amount and frequency (either 'daily' or 'monthly').

Example:
```markdown
Expense(50, 'monthly')
```

#### `Investment(investment: CardRef, amount: number)`

Invests a specified amount into the given card.

Example:
```markdown
Investment('stock_A', 100)
```

#### `Divestment(investment: CardRef, amount: number)`

Sells a specified amount of an investment in the given card.

Example:
```markdown
Divestment('stock_A', 50)
```

#### `Action(action: ActionRef)`

Performs a specific action defined by the given action reference.

Example:
```markdown
Action('dividend_boost')
```

### Constraints

1. All EffectOps must be used within a card's `effects` array.
2. The sum of all recurring income and expenses must not exceed the game budget.
3. Investments and divestments must not exceed the available balance of the investment card.
4. Actions must be defined and registered in the game system before being referenced in a card's effects.

### Budget Impact

The budget impact of a card is calculated by summing the recurring income, expenses, investments, and divestments within its `effects` array.

Example:
```markdown
[
  Income(100, 'daily'),
  Expense(50, 'monthly'),
  Investment('stock_A', 100),
  Divestment('bond_B', 50)
]
```

This card would have a budget impact of `100 (income) - 50 (expense) + 100 (investment) - 50 (divestment) = 150`.

### Test Patterns

To test the effects of a card, create a new game instance with the card included and simulate a number of game cycles to observe the card's behavior.

Example:
```typescript
const game = new Game();
game.addCard(myCard); // myCard is an instance of your card class
game.simulateCycles(10);
console.log(game.getBudget()); // Outputs the budget after 10 cycles

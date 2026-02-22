# Generational Wealth Mode Specification

## Overview

Generational Wealth Mode is a feature in Point Zero One Digital's 12-minute financial roguelike game that introduces a persistent bloodline_state across runs, allowing choices made by the player to echo through subsequent generations. This mode aims to create a narrative of legacy and consequences, where your decisions not only impact your current run but also shape the future of your digital family.

## Non-negotiables

1. **Persistence**: The bloodline_state must be saved and loaded across runs, ensuring that each new generation starts with the assets, debt, reputation score, and family traits inherited from their predecessors.
2. **Determinism**: All effects of choices made by the player should be deterministic, ensuring a consistent outcome for each run given the same input.
3. **Narrative Coherence**: The narrative must reflect the impact of the player's decisions on their family's legacy, providing a compelling and immersive experience.
4. **Strict TypeScript**: All code related to Generational Wealth Mode should adhere to strict TypeScript standards, with 'any' being avoided in favor of explicit typing.

## Implementation Spec

### Bloodline_State

- `generation`: The current generation number.
- `year`: The current year within the game.
- `inheritedAssets`: The assets that were passed down from the previous generation.
- `inheritedDebt`: The debt that was passed down from the previous generation.
- `reputationScore`: A score representing the family's standing in society, influenced by past decisions and actions.
- `familyTraits`: A set of traits that define the characteristics of the current family, such as risk tolerance, business acumen, or charisma. These traits can influence the outcomes of certain events.

### Choice Echoing

When a player makes a significant decision (e.g., investing in a new venture, taking on debt, making a charitable donation), the impact of that choice should be reflected in the bloodline_state and carried forward to future generations. For example:

- Investments may generate returns that increase inherited assets.
- Debt accumulated may need to be paid off by subsequent generations.
- Charitable donations could improve reputation score, leading to better opportunities in the future.

### Edge Cases

1. **Bankruptcy**: If a family becomes bankrupt (i.e., their debts exceed their assets), they may lose some or all of their wealth and reputation, impacting the opportunities available to subsequent generations.
2. **Family Traits Mutation**: Over time, family traits may mutate slightly, introducing randomness into the system while maintaining a sense of continuity and legacy.
3. **Legacy Events**: Certain events (e.g., a family member's death or retirement) could trigger narrative-driven choices that significantly impact the bloodline_state, providing opportunities for memorable moments within the game.

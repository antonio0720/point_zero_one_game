# Point Zero One Digital - Monetization Governance: Product Taxonomy and Tags

## Overview

This document outlines the taxonomy and tagging system for our in-game products within Point Zero One Digital's 12-minute financial roguelike game. The taxonomy is divided into four categories: Cosmetic, ContentAccess, Convenience, and Forbidden. Each category has specific rules and examples to ensure clarity and consistency.

## Non-negotiables

1. Strict adherence to the defined taxonomy and tagging system is mandatory for all in-game products.
2. All product tags must be precise and unambiguous.
3. The use of 'any' in TypeScript is prohibited when defining product tags or any other code-related aspects.
4. All code is written in strict mode to maintain consistency and avoid potential errors.
5. All effects are deterministic, ensuring fairness and reproducibility across all game sessions.

## Implementation Spec

### Cosmetic

Cosmetic items do not provide any gameplay advantage but alter the visual appearance of characters or environments. Examples include:

- Unique character skins
- Exclusive emotes
- Customizable UI themes

### ContentAccess

ContentAccess items grant access to additional content, such as new levels, characters, or storylines. Examples include:

- Expansion packs
- Season passes
- Early access to upcoming content

### Convenience

Convenience items simplify gameplay by providing time-saving benefits or resources. Examples include:

- Premium currency bundles
- XP boosters
- Resource packs

### Forbidden

Forbidden items are not available for purchase and should never be implemented. These include:

- Pay-to-win items (items that provide significant gameplay advantages)
- Real-world currency transactions
- Exploits or cheats

## Edge Cases

In some cases, a product may fall into multiple categories. In such instances, prioritize the primary purpose of the item when assigning tags. For example, an item that grants access to new levels and includes cosmetic elements should be tagged as ContentAccess first, followed by Cosmetic if necessary.

Ensure all products are thoroughly reviewed before release to maintain the integrity of our game's monetization system and user experience.

# Revenue Ladder Unit Economics

This document outlines the revenue ladder math for Point Zero One Digital's 12-minute financial roguelike game. The focus is on the base game, Kickstarter tiers, classroom/church/employer kits, and B2B offerings, as well as the break-even model.

## Overview

The revenue ladder is a structure that outlines various pricing tiers for our game and additional offerings. The base game price is set at $49, with a weekly sales target of 20,408 units to reach $1M in revenue. Kickstarter tiers range from $49 to $999, while classroom/church/employer kits cost between $299 and $999. B2B offerings are priced at $5k–$25k per year.

## Non-negotiables

1. Strict TypeScript coding standards: Never use 'any' in TypeScript. All code is strict-mode.
2. Deterministic effects: All game and business effects are designed to be deterministic for predictable revenue streams.
3. Production-grade, deployment-ready infrastructure: Sovereign infrastructure architect design ensures scalability and reliability.

## Implementation Spec

### Base Game

- Price: $49
- Weekly sales target: 20,408 units to reach $1M in revenue

### Kickstarter Tiers

| Tier | Price |
|------|-------|
| Basic | $49   |
| Premium | $99   |
| Deluxe | $149  |
| Collector's Edition | $299  |
| Ultimate Edition | $999  |

### Classroom/Church/Employer Kits

- Pricing range: $299–$999
- Includes additional resources for educational and group settings.

### B2B Offerings

- Pricing range: $5k–$25k per year
- Customized solutions for businesses interested in integrating our game into their operations.

## Edge Cases

- If weekly sales of the base game exceed 20,408 units, revenue will surpass $1M and continue to grow proportionally.
- B2B offerings may require additional custom development work, which could impact pricing beyond the specified range.

# SKU Taxonomy Mapping for Packs in Point Zero One Digital

## Overview

This document outlines the SKU taxonomy mapping for packs within the game, ensuring a fair and balanced distribution of content without pay-to-win mechanics.

## Non-negotiables

1. All packs must contain a mix of items that are balanced in terms of rarity and utility.
2. Packs should not provide an unfair advantage to players who purchase them.
3. The mapping must be deterministic, ensuring reproducible results for each pack opening.
4. Strict TypeScript coding practices are to be followed, with 'any' avoided in all cases.

## Implementation Spec

### Packs Categorization

1. **Starter Pack**: Contains essential starting items such as basic weapons, resources, and a small amount of premium currency.
2. **Booster Pack**: Offers a mix of rare and common items, including powerful weapons, unique resources, and a moderate amount of premium currency.
3. **Elite Pack**: Includes high-rarity items like legendary weapons, exclusive resources, and a substantial amount of premium currency.

### Item Distribution

1. Each pack will contain a predefined number of items, with the distribution of rarities following a specific pattern to avoid pay-to-win scenarios.
2. Items within each pack are determined at the time of purchase and remain consistent for every opening.
3. Premium currency is distributed proportionally based on the pack's tier (Starter, Booster, Elite).

### Edge Cases

1. **Limited-time Packs**: These packs may contain exclusive items only available during specific events or promotions. The distribution of these items should still adhere to the non-negotiables outlined above.
2. **Seasonal Packs**: Seasonal packs may include items themed around a particular season or event. The rarity and utility of these items should be balanced within their respective pack tiers.
3. **Collaboration Packs**: Collaboration packs may contain items from partnered franchises or brands. These items should not provide an unfair advantage to players who purchase them, and their distribution should follow the non-negotiables outlined above.

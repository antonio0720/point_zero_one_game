# Remote-Config Policy Object Shape

This document outlines the structure and validation rules for the Remote-Config policy object in Point Zero One Digital's financial roguelike game. The policy object consists of four main components: `sku_catalog`, `offer_rules`, `ladder_policy`, and `experiment_rules`.

## Overview

The Remote-Config policy object is a JSON structure that defines the game's monetization rules, including in-game items (SKUs), offers, pricing ladders, and experiment configurations. The policy object is designed to be flexible, allowing for easy updates and customizations without requiring code changes.

## Non-negotiables

1. **Strict TypeScript**: All policy objects must adhere to strict TypeScript type definitions. This ensures type safety and reduces the likelihood of runtime errors.
2. **Deterministic Effects**: All effects resulting from the Remote-Config policy object should be deterministic, ensuring fairness and reproducibility.
3. **No 'any'**: The use of the `any` type is strictly prohibited to maintain type safety and readability.
4. **Deployment Ready**: Policy objects must be production-grade, meaning they are thoroughly tested and optimized for performance before deployment.

## Implementation Spec

### sku_catalog

The `sku_catalog` is a list of SKUs (in-game items) with their respective properties. Each SKU object should contain the following fields:

- `id`: A unique identifier for the SKU.
- `name`: The display name of the SKU.
- `description`: A brief description of the SKU.
- `price_tiers`: An array of price tiers associated with the SKU. Each tier should include a `currency` and `amount`.

### offer_rules

The `offer_rules` define discounts, bundles, or other promotional offers for specific SKUs. Each offer rule object should contain the following fields:

- `id`: A unique identifier for the offer rule.
- `sku_ids`: An array of SKU identifiers that this offer applies to.
- `discount_type`: The type of discount (percentage or fixed amount).
- `discount_value`: The value of the discount.
- `duration`: The duration of the offer in minutes.

### ladder_policy

The `ladder_policy` defines pricing ladders for SKUs based on the number of purchases. Each ladder policy object should contain the following fields:

- `id`: A unique identifier for the ladder policy.
- `sku_id`: The SKU that this ladder policy applies to.
- `tiers`: An array of pricing tiers, each containing a `quantity` and `price`.

### experiment_rules

The `experiment_rules` allow for A/B testing or other experimental configurations within the game. Each experiment rule object should contain the following fields:

- `id`: A unique identifier for the experiment rule.
- `sku_ids`: An array of SKU identifiers that this experiment applies to.
- `variants`: An array of variant objects, each containing a `name`, `probability`, and `offer_rules`.

## Edge Cases

1. **SKU Ids**: Ensure that all SKU ids are unique across the entire game to avoid conflicts or ambiguity.
2. **Offer Durations**: Offers with zero duration should be treated as permanent offers, while negative durations should result in an error.
3. **Experiment Probabilities**: The sum of probabilities for all variants within an experiment should equal 100%. Any experiment with non-summing probabilities should result in an error.

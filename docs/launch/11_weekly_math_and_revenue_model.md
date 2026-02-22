# Weekly Math and Revenue Model

This document outlines the weekly math and revenue model for Point Zero One Digital's 12-minute financial roguelike game. The model is designed to be strict, deterministic, and production-ready.

## Overview

The revenue model consists of base sales, deluxe mix, bulk kit contributions, subscription Annual Recurring Revenue (ARR), Business-to-Business Annual Contract Value (B2B ACV), and Kickstarter funding target math.

## Non-Negotiables

1. Strict TypeScript coding standards are enforced, with the 'any' keyword never used. All code is written in strict mode.
2. All effects are deterministic to ensure fairness and reproducibility.
3. The model aims for a weekly revenue target of $2M, achievable at 40,000 units sold.

## Implementation Spec

### Base Sales
- A base sale is priced at $49 per unit.
- To reach $1M in gross revenue, 20,408 units need to be sold.

### Deluxe Mix
- The deluxe mix price is not specified but should be factored into the weekly revenue target.

### Bulk Kit Contribution
- A bulk kit contribution is a discounted bundle of multiple game copies. Its impact on the weekly revenue will depend on the number and pricing of these bundles.

### Subscription ARR
- Subscription Annual Recurring Revenue (ARR) is calculated by multiplying the monthly subscription fee by 12. The exact subscription price is not specified but should be factored into the weekly revenue target.

### B2B ACV
- Business-to-Business Annual Contract Value (B2B ACV) represents agreements with other companies for game licenses or partnerships. Its impact on the weekly revenue will depend on the number and value of these contracts.

## Kickstarter Funding Target Math

The Kickstarter funding target can be calculated by estimating the total cost of development, marketing, and operational expenses, then dividing this amount by the desired duration of the campaign in weeks. For example, if the total budget is $5M and the campaign lasts for 10 weeks, the Kickstarter funding target would be $500,000 per week.

## Edge Cases

- If the number of base sales, deluxe mix, bulk kit contributions, subscriptions, or B2B contracts significantly deviates from the expected values, the weekly revenue may not meet the target of $2M at 40,000 units sold. In such cases, adjustments to pricing, marketing strategies, or development timeline may be necessary.

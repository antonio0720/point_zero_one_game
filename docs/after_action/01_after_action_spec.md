# After Action Plan Specification

## Overview

This document outlines the specifications for the After Action Plan (AAP) in Point Zero One Digital's 12-minute financial roguelike game. The AAP includes a failure mode taxonomy, strength mode taxonomy, libraries of actions, and a replay suggestion algorithm.

## Non-Negotiables

1. **Deterministic Execution**: All effects in the AAP must be deterministic to ensure fairness and reproducibility.
2. **Strict TypeScript**: All code adheres to strict TypeScript mode, avoiding the use of 'any'.
3. **Production-Grade**: The AAP is designed for production-grade deployment, ensuring robustness and scalability.

## Implementation Spec

### Failure Mode Taxonomy

The failure mode taxonomy categorizes potential failures during gameplay. Each failure type is associated with a set of recovery actions from the `one_tiny_action` library.

```markdown
| Failure Type | Description                                                                   | Recovery Actions (from one_tiny_action)                |
|-------------|-------------------------------------------------------------------------------|---------------------------------------------------------|
| F1          | Market crash due to excessive selling                                           | sell_slowly, diversify_portfolio                      |
| F2          | Insufficient funds for required investment                                     | borrow_funds, reduce_risk                              |
| F3          | Regulatory compliance violation                                                | review_compliance_regulations, hire_compliance_officer |
| ...         | ...                                                                            | ...                                                    |
```

### Strength Mode Taxonomy

The strength mode taxonomy categorizes the game's economic conditions. Each strength mode is associated with a set of actions from the `one_medium_action` library and the replay suggestion algorithm.

```markdown
| Strength Mode | Description                                                                   | Actions (from one_medium_action)                | Replay Suggestion Algorithm                     |
|--------------|-------------------------------------------------------------------------------|---------------------------------------------------------|--------------------------------------------------|
| S1           | Bull market with high liquidity and low volatility                             | invest_heavily, leverage_investments                | Suggest aggressive investment strategies         |
| S2           | Bear market with low liquidity and high volatility                              | hedge_positions, reduce_exposure                    | Suggest conservative investment strategies       |
| S3           | Market in transition between bull and bear                                     | diversify_portfolio, monitor_market_trends         | Suggest flexible investment strategies           |
| ...          | ...                                                                            | ...                                                    | ...                                              |
```

### One Tiny Action Library (100+ Entries)

The `one_tiny_action` library contains a large number of small, quick actions that can be used to recover from failures or adjust strategies in response to changing market conditions. Examples include:

- sell_slowly
- diversify_portfolio
- borrow_funds
- review_compliance_regulations
- hire_compliance_officer
- ...

### One Medium Action Library

The `one_medium_action` library contains a smaller set of larger, more impactful actions that can be used to capitalize on market opportunities or adjust strategies in response to changing market conditions. Examples include:

- invest_heavily
- leverage_investments
- hedge_positions
- reduce_exposure
- diversify_portfolio
- ...

### Replay Suggestion Algorithm

The replay suggestion algorithm analyzes past games and suggests strategies based on the current game's strength mode. The algorithm considers factors such as market trends, investment history, and failure modes to provide tailored suggestions for each player.

## Edge Cases

Edge cases may arise when a player encounters a combination of failure modes and strength modes that are not explicitly covered in the taxonomies. In these situations, the replay suggestion algorithm will prioritize strategies that minimize risk and maximize potential returns based on available data. Additionally, players can manually adjust their strategies using actions from the libraries as needed.

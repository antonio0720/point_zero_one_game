# Outcome Pack v0: Reserves Discipline

## Overview

The `ReservesDiscipline` outcome pack is a crucial component of Point Zero One Digital's financial roguelike game, designed to enforce strict fiscal discipline. This pack ensures that players maintain adequate reserves to sustain their economic growth and mitigate risks.

## Non-Negotiables

1. **Strict-mode TypeScript**: All code adheres to strict-mode TypeScript for type safety and consistency.
2. **Deterministic effects**: All game outcomes are deterministic, ensuring fairness and reproducibility.
3. **No 'any'**: The use of the `any` type is strictly prohibited to maintain type safety throughout the codebase.
4. **Production-grade**: The implementation is designed for production environments, with a focus on performance, scalability, and reliability.
5. **Deployment-ready**: The outcome pack is ready for deployment as soon as it's integrated into the game engine.

## Implementation Spec

### Player Reserves Calculation

The `ReservesDiscipline` outcome pack calculates the player's reserves based on their current assets, liabilities, and investment strategies. The calculation is performed at each game tick to ensure real-time updates of the player's reserve status.

#### Assets and Liabilities

The pack considers all the player's assets (e.g., cash, investments) and liabilities (e.g., loans, debts) when calculating their reserves. The assets are subtracted from the liabilities to determine the net worth, which serves as the basis for reserve calculations.

#### Investment Strategies

The pack takes into account the player's investment strategies, such as risk tolerance and diversification, to adjust the reserve requirements accordingly. For instance, a more aggressive investor may require less reserves due to higher expected returns, while a conservative investor may need more reserves for safety.

### Reserve Thresholds

The pack defines minimum and maximum reserve thresholds that the player must maintain to avoid penalties or game over scenarios. The thresholds are customizable based on the desired level of difficulty and can be adjusted during game development.

#### Minimum Reserves

If the player's reserves fall below the minimum threshold, they may face penalties such as reduced investment returns, increased interest rates on loans, or temporary gameplay restrictions.

#### Maximum Reserves

On the other hand, if the player's reserves exceed the maximum threshold, they may miss out on potential investment opportunities or face unnecessary holding costs.

### Edge Cases

#### Zero Reserves

In the event that a player's reserves reach zero, the game should trigger an emergency scenario, such as bankruptcy or nationalization of assets, depending on the game's design.

#### Negative Reserves

If a player's liabilities exceed their assets (resulting in negative reserves), the pack should handle this edge case gracefully, perhaps by triggering a debt restructuring process or forcing the player to liquidate some of their assets.

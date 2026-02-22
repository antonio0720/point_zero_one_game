Live Macro Shock Spec
=======================

Overview
--------

The Live Macro Shock feature simulates real-world macroeconomic events and triggers corresponding in-game shocks to create a more immersive financial roguelike experience. This spec outlines the implementation of key macro events, their impact on gameplay, and configuration options.

Non-negotiables
----------------

1. **Deterministic effects**: All macro events must have predictable and consistent in-game consequences to maintain fairness and reproducibility.
2. **Strict TypeScript**: Adhere to strict mode and avoid using the `any` type for improved type safety and code quality.
3. **Production-grade**: The implementation should be robust, scalable, and deployment-ready.

Implementation Spec
--------------------

### Fed Rate

- When the Federal Reserve adjusts interest rates, it will impact leveraged asset cash flows in the game.
- The severity of the effect is determined by the magnitude of the rate change and the assets' sensitivity to interest rates.

### Unemployment Spike

- An unemployment spike triggers a W-2 layoff risk check for all employed characters.
- The probability of layoffs increases with the size of the unemployment spike, affecting characters' income and overall financial stability.

### 15-min News Monitor Cron

- A cron job runs every 15 minutes to fetch real-world macroeconomic news from trusted sources.
- If a significant event is detected, the corresponding in-game shock will be triggered according to the specified rules.

### Severity Threshold Config

- Developers can configure severity thresholds for each macro event to control the frequency and intensity of shocks within the game.
- Adjustable parameters include interest rate change thresholds, unemployment spike sizes, and news event impact levels.

Edge Cases
----------

1. **Rare macro events**: Developers should consider implementing a mechanism to handle rare but significant real-world events that may not have been accounted for in the initial severity threshold configurations.
2. **Compounding shocks**: In situations where multiple macro events occur close together, it's essential to ensure that the game handles the compounding effects gracefully without causing unintended consequences or crashes.
3. **News source reliability**: Developers should implement a system to verify and prioritize news sources based on their reputation and accuracy to minimize false positives and maintain the integrity of the in-game shocks.

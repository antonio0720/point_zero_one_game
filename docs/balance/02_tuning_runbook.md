Balance Tuning Runbook
=======================

Overview
--------

This runbook outlines the process for adjusting card weights, deck compositions, and profile starting states in Point Zero One Digital's financial roguelike game. It also covers A/B testing procedures, rollback processes, and communication strategies for major rebalances.

Non-negotiables
----------------

1. **Never use 'any' in TypeScript.** Strict mode is enforced across all codebases to maintain type safety and prevent runtime errors.
2. All effects are deterministic to ensure fairness and reproducibility.
3. Changes must be thoroughly tested before deployment to minimize the impact on players.

Implementation Spec
--------------------

### Card Weights Adjustment

1. Identify cards requiring adjustments based on game data analysis, player feedback, or design goals.
2. Calculate new weights using statistical methods and considerations for game balance.
3. Implement the changes in the codebase, ensuring strict TypeScript type safety.
4. Test the changes extensively to verify that they do not negatively impact the game experience.
5. Deploy the updated card weights to the live environment.

### Deck Composition Adjustment

1. Identify decks requiring adjustments based on game data analysis, player feedback, or design goals.
2. Modify deck compositions by changing card weights, adding or removing cards, or altering synergies between cards.
3. Test the changes extensively to verify that they do not negatively impact the game experience.
4. Deploy the updated deck compositions to the live environment.

### Profile Starting States

1. Identify profiles requiring adjustments based on game data analysis, player feedback, or design goals.
2. Modify starting states by changing card distributions, resource amounts, or other relevant factors.
3. Test the changes extensively to verify that they do not negatively impact the game experience.
4. Deploy the updated profile starting states to the live environment.

### A/B Testing Procedures

1. Define clear test hypotheses and objectives.
2. Split the player base into control and treatment groups using a randomized allocation method.
3. Implement the changes for the treatment group only.
4. Collect and analyze game data from both groups to determine the effectiveness of the changes.
5. Compare the results with the test hypotheses and objectives.
6. If the results are statistically significant, consider rolling out the changes to the entire player base.
7. If the results are not statistically significant or if negative impacts are observed, revert the changes and iterate on the testing process.

### Rollback Process

1. In case of unexpected issues or negative player impact, initiate a rollback procedure as soon as possible.
2. Revert the codebase to the previous stable version.
3. Communicate the issue and the rollback action to players, if necessary.
4. Investigate the cause of the issue and take corrective measures to prevent similar occurrences in the future.

### Communication to Players on Major Rebalances

1. Notify players about major rebalances well in advance, providing details about the changes and their expected impact.
2. Offer incentives or compensation for any negative impacts caused by the rebalance, if necessary.
3. Provide clear and concise communication channels for player feedback and concerns.
4. Monitor player feedback and adjust further rebalances as needed based on the feedback received.

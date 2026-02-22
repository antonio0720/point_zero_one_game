# Forensic AI Autopsy Spec

## Overview

The Forensic AI Autopsy is a decision tree analysis tool integrated into Point Zero One Digital's financial roguelike game. It provides a comprehensive review of the entire run, identifying critical fork moments, and simulating alternate timelines for both free and premium users.

## Non-Negotiables

1. Deterministic: All effects in the Forensic AI Autopsy must be deterministic to ensure accurate analysis.
2. Strict TypeScript: Adherence to strict TypeScript mode is mandatory for all code related to this feature.
3. No 'any': The use of 'any' type in TypeScript is strictly prohibited.
4. Fork Moment Identification: The system must accurately identify and mark critical fork moments, such as the condo purchase on Turn 4.
5. Counterfactual Simulation: The tool should simulate alternate timelines based on the identified fork moments.
6. Free Tier: Offer a limited counterfactual simulation for free users.
7. Premium Tier: Provide unlimited counterfactual simulations and Fork Explorer for premium subscribers at $4.99/mo.

## Implementation Spec

1. Decision Tree Construction: Build a decision tree based on the game's events, including financial transactions, investment decisions, and strategic choices.
2. Fork Moment Detection: Develop algorithms to identify critical fork moments in the game, such as the condo purchase on Turn 4.
3. Counterfactual Simulation: Implement a system that simulates alternate timelines based on the identified fork moments.
   - Free Tier: Limit counterfactual simulations to a specific number of events per run.
   - Premium Tier: Offer unlimited counterfactual simulations and access to Fork Explorer, which visualizes the decision tree and its outcomes.
4. Integration with Game Engine: Seamlessly integrate the Forensic AI Autopsy with the game engine to ensure real-time analysis of the player's decisions and their impact on the game's outcome.

## Edge Cases

1. Incomplete Data: Handle edge cases where not all data is available for analysis, such as when a player quits early or encounters technical issues during gameplay.
2. Non-Deterministic Events: Account for non-deterministic events, like random encounters or market fluctuations, by averaging their impact over multiple runs or using statistical models to predict their outcomes.
3. Premium User Limitations: Implement measures to prevent premium users from abusing the unlimited counterfactual simulations, such as limiting the number of simulations per hour or day.

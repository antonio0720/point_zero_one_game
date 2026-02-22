# Daily Operations Board Metrics Specification for Point Zero One Digital

## Overview

This document outlines the key metrics to be tracked and displayed on the daily operations board for our game, a 12-minute financial roguelike. The metrics are designed to provide insights into player behavior, game balance, and overall health of the game economy.

## Non-Negotiables

1. **Run Funnels (Run1/2/3)**: Track the number of players who start, complete, and continue beyond each run. This helps us understand player retention and progression.

2. **Time-to-First-Death/Survival**: Measure the average time a player survives in the game and their chances of dying. This provides insights into game difficulty and player skill level.

3. **Guest→Account After Run3**: Track the percentage of guests who convert to accounts after completing three runs. This helps us understand user acquisition and retention.

4. **Death-Cause Distribution**: Identify the most common causes of death to help balance game mechanics and improve player experience.

5. **Lethal Content**: Monitor content that leads to frequent deaths to ensure it is appropriately marked or adjusted for player safety.

6. **Verification Health**: Measure the success rate of verification processes, such as age or location checks, to maintain compliance and user trust.

7. **Economy Sink Pressure**: Analyze the rate at which in-game currency is being spent or lost to ensure a healthy economy and player engagement.

## Implementation Spec

The metrics will be collected using various tracking methods, such as server logs, client-side analytics, and user surveys. The data will be processed and visualized on the daily operations board for easy interpretation by the team.

## Edge Cases

1. **Guest→Account After Run3**: Account creation may be influenced by promotions or events, so it's important to consider these factors when analyzing conversion rates.

2. **Death-Cause Distribution**: Some deaths may occur due to rare or unintended game events. These should be tracked and addressed separately to maintain game balance.

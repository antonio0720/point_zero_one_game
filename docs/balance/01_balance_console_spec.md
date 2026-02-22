# Balance Console Spec

## Overview

This document outlines the specifications for the balance console, a tool designed to analyze and optimize gameplay metrics in Point Zero One Digital's 12-minute financial roguelike game. The balance console will provide insights into win-rates per profile, death-cause distribution, most lethal cards ranking, most overpowered deals ranking, average time-to-first-asset, and retention by scenario pack.

## Non-Negotiables

1. **Output Format**: The balance console must output data in a clear and concise Markdown format for easy interpretation and further analysis.
2. **Deterministic Results**: All effects in the game should be deterministic to ensure consistent and reproducible results when analyzing gameplay data.
3. **Strict TypeScript**: All code written for the balance console must adhere to strict TypeScript standards, with no usage of 'any'.
4. **Production-Grade**: The balance console should be production-ready, capable of handling large volumes of gameplay data and providing accurate results in a timely manner.
5. **Deployment Ready**: The balance console must be easily deployable across various environments, including local development, staging, and production.

## Implementation Spec

### Win-Rates Per Profile

The win-rates per profile will be calculated by dividing the number of victories for each player profile by the total number of games played with that profile. The data will be presented in a tabular format, with each row representing a unique player profile and columns displaying the win-rate percentage.

### Death-Cause Distribution

The death-cause distribution will show the frequency of different reasons for game over events. This information can help identify potential balance issues or areas where players may struggle more frequently. The data will be presented in a pie chart, with each slice representing a specific cause of death.

### Most Lethal Cards Ranking

The most lethal cards ranking will list the cards that have caused the most game over events when played. This information can help identify overpowered or underpowered cards and guide future balance adjustments. The data will be presented in a sorted table, with each row representing a card and columns displaying relevant statistics such as the number of game overs caused by that card.

### Most Overpowered Deals Ranking

The most overpowered deals ranking will list the combinations of cards that have led to the highest win-rates when played together. This information can help identify powerful synergies and guide future balance adjustments. The data will be presented in a sorted table, with each row representing a deal (a combination of cards) and columns displaying relevant statistics such as the win-rate percentage associated with that deal.

### Average Time-To-First-Asset

The average time-to-first-asset metric measures how long it takes for players to acquire their first asset in a game. This information can help identify potential balance issues or areas where players may struggle more frequently. The data will be presented as an average value, with lower numbers indicating faster acquisition of assets.

### Retention by Scenario Pack

Retention by scenario pack will show the percentage of players who continue to play the game after completing each scenario pack. This information can help identify which scenario packs are more engaging and potentially guide future content development decisions. The data will be presented in a bar chart, with each bar representing a different scenario pack and the height of the bars indicating the retention rate for that pack.

## Edge Cases

1. **Incomplete Data**: If there is insufficient data available to calculate certain metrics (e.g., win-rates per profile), the balance console should display a notice indicating that the data is incomplete or not available.
2. **Tie Breakers**: In cases where multiple cards, deals, or scenarios have identical statistics (e.g., equal win-rates), the balance console should implement a consistent tie breaker method to ensure accurate rankings and comparisons.
3. **Data Aggregation**: The balance console may need to aggregate data across multiple game sessions or players to provide more robust and meaningful insights. In such cases, it is important to ensure that the aggregated data remains representative of the overall player base and gameplay experience.

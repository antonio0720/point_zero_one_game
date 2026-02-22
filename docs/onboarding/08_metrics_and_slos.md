# Metrics for PZ1D Game Development

This document outlines the key metrics to be tracked during the development and deployment of Point Zero One Digital's 12-minute financial roguelike game. Strict adherence to these metrics ensures a data-driven approach, enabling continuous improvement and optimization.

## Non-negotiables

1. **Run1→Run2 Completion**: Measures the percentage of players who complete Run1 and proceed to Run2. A high completion rate indicates player engagement and satisfaction with the game's initial experience.

2. **Run2→Run3 Progression**: Tracks the percentage of players who progress from Run2 to Run3. This metric helps gauge the difficulty level and player retention across different stages of the game.

3. **D1/D7 Retention Uplift**: Measures the percentage of daily active users (DAUs) that return on the following day and after a week. A higher retention rate indicates a more engaging and addictive game experience.

4. **Conversion Trigger Rates**: Monitors the probability of players reaching specific in-game milestones or completing certain tasks, such as making a purchase or achieving a high score. This metric helps identify areas for monetization and player engagement optimization.

5. **Time-to-First-Proof**: Records the time it takes for players to complete their first successful financial transaction within the game. A shorter time indicates quicker player monetization and increased revenue potential.

6. **Share Impulse Rate**: Quantifies the frequency at which players share their in-game achievements or progress on social media platforms. This metric helps assess the game's virality and potential for organic growth.

## Implementation Spec

1. Utilize analytics tools such as Google Analytics, Mixpanel, or Amplitude to track user behavior and collect data on the aforementioned metrics.

2. Set up event tracking for key in-game actions, including level completions, purchases, and social media shares.

3. Regularly analyze the collected data to identify trends, patterns, and areas for improvement.

4. Use A/B testing to experiment with different game elements (e.g., difficulty levels, reward structures) and measure their impact on the metrics outlined above.

## Edge Cases

1. Incomplete or inconsistent data collection may lead to inaccurate metric calculations and misguided optimization efforts. Ensure that all analytics tools are properly configured and functioning correctly.

2. Seasonal fluctuations, such as holidays or promotional events, can temporarily affect some metrics (e.g., share impulse rate). Account for these factors when interpreting the data and making decisions based on the results.

3. Players may manipulate certain metrics (e.g., time-to-first-proof) through unintended means (e.g., using multiple accounts or exploiting game mechanics). Implement measures to prevent such manipulation and maintain the integrity of the data.

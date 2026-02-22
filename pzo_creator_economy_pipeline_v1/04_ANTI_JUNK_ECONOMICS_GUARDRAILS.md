# Sovereign Economy Guardrails v1.0 - Anti-Junk Economics

## Overview

This document outlines the design and implementation of the anti-junk economics guardrails for the financial roguelike game, Point Zero One Digital (PZOD). The guardrails are designed to maintain a balanced and fair economic system by enforcing submission quotas based on level, managing budget across five dimensions, implementing anti-spam scoring, and providing economic alignment UX.

## Non-Negotiables

1. **Submission Quotas**: Players must adhere to the specified submission limits based on their current game level to prevent exploitation and maintain a fair playing field.
2. **Budget Balance**: The budget must be balanced across five dimensions: Complexity, Volatility, Reward, Disruption, and ModerationRisk. This ensures a diverse and engaging economic landscape without overwhelming the player or causing unintended consequences.
3. **Anti-Spam Scoring**: Implement an anti-spam scoring system to penalize players who engage in repetitive or automated actions that disrupt the game's intended economy.
4. **Economic Alignment UX**: Provide a user interface (UI) that clearly communicates the economic implications of each action, helping players make informed decisions and understand the impact on their game progress.

## Implementation Spec

### Submission Quotas

1. Define quotas based on level:
   - Level 1-5: 5 submissions per day
   - Level 6-10: 10 submissions per day
   - Level 11+: 20 submissions per day

2. Implement a cooldown period for each submission to prevent players from exceeding their daily limit.
3. Monitor player behavior and adjust quotas as needed based on game data analysis.

### Budget Balance

1. Assign a budget value to each action based on its complexity, volatility, reward, disruption, and moderation risk.
2. Ensure that the total budget spent by a player does not exceed their available funds at any given time.
3. Adjust budget values dynamically based on game data analysis and player feedback.

### Anti-Spam Scoring

1. Implement an anti-spam scoring system that penalizes players who engage in repetitive or automated actions.
2. Score each action based on its frequency, complexity, and impact on the game economy.
3. If a player's score exceeds a predetermined threshold, impose penalties such as reduced submission quotas, temporary account lockouts, or economic sanctions.

### Economic Alignment UX

1. Design a clear and intuitive UI that displays the budget available for each action, the cost of each action, and the potential impact on the game economy.
2. Provide real-time feedback to players as they make decisions, helping them understand the consequences of their actions and make informed choices.
3. Continuously gather player feedback and iterate on the UI design to improve usability and effectiveness.

## Edge Cases

1. **Account Sharing**: Implement measures to prevent account sharing, as it can lead to players exceeding submission quotas or manipulating the game economy.
2. **Bots and Automation**: Develop methods to detect and penalize the use of bots or automated scripts that exploit the game's economic system.
3. **Game Balance Adjustments**: Regularly review and adjust the economic guardrails based on game data analysis, player feedback, and updates to the game mechanics.

# Card Scan Companion Specification

## Overview

The Card Scan Companion is a feature within Point Zero One Digital's 12-minute financial roguelike game. This companion utilizes QR/NFC scanning technology to provide players with information about the consequences of acquiring various cards in the game. The primary goal is to educate players about real-life financial principles while tracking key metrics such as cashflow, risk, burn rate, stability, and deal quality. Post-game action plans are also generated, along with links to free resources for further learning.

## Non-Negotiables

1. **Deterministic Effects**: All card consequences must be predictable and reproducible, ensuring fairness and consistency across all game sessions.
2. **Real-Life Principle Explanation**: Each card consequence should clearly illustrate a relevant real-life financial principle.
3. **Metrics Tracking**: The companion must accurately track cashflow, risk, burn rate, stability, and deal quality for each card acquired.
4. **Post-Game Action Plan**: After each game session, the companion should generate an action plan based on the player's performance and the cards they have acquired.
5. **Free Resource Linking**: The companion should provide links to free resources that further explain the real-life financial principles illustrated by the card consequences.

## Implementation Spec

1. **QR/NFC Scanning**: Implement a QR/NFC scanner within the game interface that allows players to scan cards for information.
2. **Card Consequence Database**: Create a database of all possible card consequences, including their real-life financial principle explanations and associated metrics.
3. **Metrics Tracking**: Develop a system for tracking cashflow, risk, burn rate, stability, and deal quality for each card acquired by the player.
4. **Post-Game Action Plan Generation**: Generate an action plan based on the player's performance and the cards they have acquired at the end of each game session.
5. **Free Resource Linking**: Include links to free resources that further explain the real-life financial principles illustrated by the card consequences.

## Edge Cases

1. **Multiple Scans**: Handle situations where a player scans multiple cards in quick succession, ensuring that each scan is processed correctly and that metrics are updated accordingly.
2. **Card Database Updates**: Implement a system for updating the card database with new cards or changes to existing cards' consequences.
3. **Error Handling**: Ensure robust error handling for situations such as failed scans, network issues, or database errors.

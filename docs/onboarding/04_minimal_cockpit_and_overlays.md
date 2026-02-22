# Minimal Cockpit and Overlays for Run 1

This document outlines the minimal cockpit configuration and progressive disclosure overlays for the initial run (Run 1) of Point Zero One Digital's financial roguelike game. The focus is on Cash, Burn, Risk, and TickClock elements, along with guidelines for hiding/showing components based on each run.

## Overview

The minimal cockpit provides a streamlined interface for players to manage their financial resources during the initial run. As the game progresses, additional overlays will be introduced to enhance the user experience and provide more detailed information.

## Non-negotiables

1. **Cash**: Display the current cash balance in an easily readable format.
2. **Burn**: Show the rate at which cash is being spent (burn) per unit of time.
3. **Risk**: Indicate the level of risk associated with the player's financial decisions.
4. **TickClock**: Display a countdown timer to represent the passage of time in the game.

## Implementation Spec

### Base Cockpit

- Cash: `$CashBalance` - Displays the current cash balance.
- Burn: `$BurnRate` - Shows the rate at which cash is being spent per second.
- Risk: `$RiskLevel` - Represents the level of risk associated with the player's financial decisions, using a color-coded system (e.g., green for low risk, yellow for medium risk, and red for high risk).
- TickClock: `$TimeRemaining` - Displays the remaining time in seconds for the current run.

### Progressive Disclosure Overlays

As the game progresses, additional overlays will be introduced to provide more detailed information about the player's financial situation. These overlays will be hidden by default and revealed based on specific conditions or user interaction.

1. **Income Overlay**: Shows the sources of income for the player, such as interest, dividends, or rewards from completed tasks.
2. **Expenses Overlay**: Displays a breakdown of the player's expenses, including fixed costs (e.g., rent) and variable costs (e.g., utilities).
3. **Investment Overlay**: Provides information about the player's investments, including their current value, potential returns, and associated risks.
4. **Goal Overlay**: Displays the player's financial goals and progress towards achieving them.

## Edge Cases

1. If the cash balance reaches zero, the game will end, and the "Game Over" overlay will be displayed.
2. If the player achieves a financial goal during the current run, the "Congratulations" overlay will be shown, along with an option to continue playing or restart the game.
3. If the risk level exceeds a predefined threshold, a warning message will be displayed to alert the player of the increased risk associated with their financial decisions.
4. If the time remaining for the current run reaches zero, the game will progress to the next run, and the base cockpit will be updated accordingly.

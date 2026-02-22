# Cause-of-Death Card Specification

## Overview

The Cause-of-Death card is a game element in Point Zero One Digital's 12-minute financial roguelike game. It provides players with a one-line failure mode, last three deltas ledger strip, and an 'if you had X, you survive' hint, all delivered in a share-safe tone.

## Non-Negotiables

1. **One-line Failure Mode**: The failure mode must be concise and easily understandable within a single line of text.
2. **Last 3 Deltras Ledger Strip**: The ledger strip should display the last three financial states (deltas) of the player's game.
3. **'If You Had X, You Survive' Hint**: The hint should provide a clear condition that, if met by the player, would have prevented the failure mode from occurring.
4. **Share-Safe Tone**: The language and content of the card must be suitable for sharing with others without revealing sensitive or proprietary information about the game or its players.

## Implementation Spec

1. **Failure Mode**: The failure mode should be generated based on the current state of the player's game, ensuring a high degree of randomness and unpredictability.
2. **Ledger Strip**: The ledger strip should display the last three financial states (deltas) in a clear and easy-to-read format. This information can help players understand how their financial situation changed leading up to the failure.
3. **'If You Had X, You Survive' Hint**: The hint should be generated based on the current state of the player's game and the specific failure mode that occurred. It should provide a clear condition that, if met by the player, would have prevented the failure from occurring.
4. **Share-Safe Tone**: All text on the card should be written in a tone that is suitable for sharing with others without revealing sensitive or proprietary information about the game or its players.

## Edge Cases

1. **Empty Ledger Strip**: In cases where the player has not played long enough to have three deltas, the ledger strip should display placeholder text or a visual indicator that there is insufficient data.
2. **Vague Failure Mode**: If the failure mode cannot be accurately summarized in a single line of text, it may be necessary to provide additional context or explanation on the card. However, this should still be kept concise and easy to understand.
3. **Complex 'If You Had X, You Survive' Hint**: In cases where the condition for survival is complex or requires multiple factors, the hint should be broken down into simpler steps to help players understand how they could have avoided the failure.

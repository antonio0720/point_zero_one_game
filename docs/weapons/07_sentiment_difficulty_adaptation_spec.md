# Sentiment-based Difficulty Adaptation Specification

## Overview

The Sentiment-based Difficulty Adaptation (SDA) is a real-time Natural Language Processing (NLP) system designed for Point Zero One Digital's 12-minute financial roguelike game. This feature analyzes multiplayer text reactions to dynamically adjust the game difficulty, providing a more immersive and responsive gaming experience.

## Non-negotiables

1. Strict TypeScript adherence, avoiding the use of 'any'. All code is written in strict mode.
2. Deterministic effects to ensure fairness and reproducibility.
3. Minimal latency for real-time NLP processing.
4. Compatibility with Point Zero One Digital's production-grade, deployment-ready infrastructure.

## Implementation Specification

The SDA system will analyze player text inputs in real-time using advanced NLP techniques. The system will categorize player sentiment into three categories: high_frustration, overconfident, and neutral.

### High Frustration

When a player exhibits signs of high frustration, the next FUBAR event (a game-defining negative event) will be softened by 20%. This aims to reduce player frustration and provide a more balanced gaming experience.

### Overconfident

If a player shows signs of overconfidence, the next Opportunity (a game-defining positive event) will have a hidden trap with an additional +20% difficulty. This encourages strategic thinking and risk management.

### Neutral

In cases where the sentiment is neutral, no adjustments will be made to the game difficulty.

### Invisible Calibration

The SDA system will maintain an invisible calibration to ensure a seamless gaming experience for all players. This calibration will adapt over time based on player behavior and feedback.

### Empathy Mode ($2.99/mo)

Empathy Mode is an optional feature that enhances the SDA system by providing more granular sentiment analysis, leading to a more personalized gaming experience. This feature is available for $2.99 per month.

## Edge Cases

1. **Player silence:** If a player does not input text, the system will consider their sentiment as neutral.
2. **Ambiguous sentiment:** In cases where the sentiment is ambiguous or difficult to categorize, the system will default to considering it as neutral.
3. **Multiple players:** The SDA system will analyze all player inputs simultaneously and adjust the game difficulty accordingly.

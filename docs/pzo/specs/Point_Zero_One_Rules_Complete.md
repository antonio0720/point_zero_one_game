# Point Zero One Rules Complete

## Overview

This document outlines the complete ruleset for the game Point Zero One Digital, a 12-minute financial roguelike experience. The rules are designed to ensure production-grade, deployment-ready sovereign infrastructure architect design with strict TypeScript adherence and deterministic effects.

## Non-Negotiables

1. **Output**: All output must be in the form of Markdown.
2. **Language**: Precise, execution-grade language is required throughout this document. Avoid bureaucratic or fluffy language.
3. **TypeScript**: Strict TypeScript mode is mandatory for all code. Never use 'any'.
4. **Determinism**: All game effects must be deterministic to ensure fairness and reproducibility.

## Implementation Spec

### Gameplay

1. The game lasts exactly 12 minutes.
2. Players start with a predefined amount of starting capital.
3. Players can make investment decisions in various financial markets.
4. Each market has its own set of rules and potential returns.
5. Players can also engage in strategic actions such as borrowing, selling short, or hedging.
6. The game ends when the 12 minutes are up, or if a player goes bankrupt.
7. Scoring is based on the remaining capital at the end of the game.

### Code Structure

1. All code should be organized in a modular and scalable manner.
2. Each module should have a clear purpose and minimal dependencies.
3. Use TypeScript interfaces to define data structures and functions.
4. Implement unit tests for all functions to ensure correctness.
5. Use version control (e.g., Git) to manage changes and collaborate effectively.

### Game State Management

1. The game state should be managed in a centralized manner.
2. All changes to the game state should be made through designated update functions.
3. Implement an event system for notifying other parts of the game about state changes.
4. Use immutable data structures where possible to ensure determinism.

## Edge Cases

1. **Investment Limitations**: Some markets may have investment limits or restrictions that players must adhere to.
2. **Bankruptcy Rules**: If a player goes bankrupt, there should be rules for handling their assets and debts.
3. **Market Volatility**: Markets may experience volatility, which could impact the game's difficulty and strategy.
4. **Network Issues**: The game should handle network issues gracefully, such as temporary connection loss or latency.
5. **User Interface**: Edge cases related to user interface interactions (e.g., invalid input) should be handled appropriately to ensure a smooth player experience.

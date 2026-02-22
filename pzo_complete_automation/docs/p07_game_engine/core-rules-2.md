Title: Deterministic Run Engine - Core Rules-2

## Overview

The Deterministic Run Engine (DRE) is a key component of the game engine, ensuring consistent and predictable outcomes for all game runs. This document outlines the core rules and functionalities of DRE version 2.

## Components

1. **State Machine**: Manages the game's state, including the current state, transition functions, and event triggers.

2. **Event Handler**: Processes incoming events, updating the game state accordingly.

3. **Action Manager**: Executes actions based on the current game state and event triggers.

## Rules

1. **State Transition**: The state machine will transition from one state to another based on specific event triggers and action executions. Each state has associated conditions for transitioning to other states.

2. **Event Processing**: The Event Handler processes events in the FIFO (First In, First Out) order. Events that can't be processed due to current game state are stored until the state changes.

3. **Action Execution**: The Action Manager executes actions based on the current game state and event triggers. If an action cannot be executed due to state constraints, it is queued and executed when the state transitions allow it.

4. **Determinism**: All actions, events, and state transitions are deterministic. This means that given the same initial state and input sequence, the engine will always produce the same output.

## Limitations

1. The DRE does not handle concurrent events or actions unless explicitly designed to do so.

2. Complex game mechanics requiring non-deterministic elements may require additional modules or custom logic.

3. Due to its deterministic nature, the engine may not accurately simulate certain types of randomness found in some games.

## Future Improvements

1. Implementing concurrent event handling and action execution mechanisms.
2. Enhancing support for non-deterministic game mechanics.
3. Optimizing the engine for performance in complex games.

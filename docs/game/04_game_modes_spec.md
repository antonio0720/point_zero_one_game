# Game Modes Specification

## Overview

This document outlines the specifications for the various game modes in Point Zero One Digital's 12-minute financial roguelike game, including Solo, Household, Ghost, and Episode modes. It also covers UX entry flows, session management, reconnect handling, and maximum players per mode.

## Non-negotiables

- All game modes must adhere to strict TypeScript coding standards with 'any' being avoided in all cases.
- Code must be written in strict mode.
- All effects within the game are deterministic.

## Implementation Spec

### Solo Mode

- Single player mode where the user controls a single character.
- UX entry flow: User selects 'Solo' from the main menu, then chooses a character and starts the game.
- Session management: A new session is created for each solo game.
- Reconnect handling: Not applicable as it is a single-player mode.
- Max players per mode: 1.

### Household Mode

- Multiplayer mode where multiple users control characters within the same household.
- UX entry flow: Users select 'Household' from the main menu, then create or join a household and start the game.
- Session management: A new session is created for each household game.
- Reconnect handling: If a player disconnects during a household game, they can rejoin by reconnecting to the same session.
- Max players per mode: Up to 4 players.

### Ghost Mode

- Multiplayer mode where users can play against AI-controlled characters (ghosts).
- UX entry flow: Users select 'Ghost' from the main menu, then choose a character and start the game.
- Session management: A new session is created for each ghost game.
- Reconnect handling: Not applicable as it is not a multiplayer mode.
- Max players per mode: 1 human player + up to 4 AI-controlled characters (ghosts).

### Episode Mode

- Special mode where users play through predefined scenarios or episodes.
- UX entry flow: Users select 'Episode' from the main menu, then choose an episode and start the game.
- Session management: A new session is created for each episode game.
- Reconnect handling: Not applicable as it is not a multiplayer mode.
- Max players per mode: 1.

## Edge Cases

- If the maximum number of players is reached in Household or Ghost modes, users will be prompted to either wait for another player to leave or create a new game.
- In Episode Mode, if a user disconnects during a scenario, the game will continue and save progress so that the user can rejoin and pick up where they left off.

Co-op Tables (Version 7)
=========================

This document describes the latest version of the Co-op Tables, which are essential for matchmaking and session management in multiplayer games.

**Table Structure**

Each table consists of the following columns:

1. `GameID`: Unique identifier for each game.
2. `SessionID`: Identifier for the specific session within a game.
3. `MapName`: Name of the map being played.
4. `GameMode`: Type of game (e.g., Deathmatch, Capture the Flag, etc.).
5. `MaxPlayers`: Maximum number of players per game.
6. `CurrentPlayers`: Number of players currently in a session.
7. `FreeSlots`: Number of available slots for new players to join.
8. `PlayerNames`: List of player names currently in the session, separated by commas.
9. `SessionStartTime`: Time when the session started.
10. `SessionEndTime`: Estimated time when the session will end (if applicable).
11. `GameStatus`: Status of the game (e.g., In Progress, Paused, Ended, etc.).

**Example Table**

```markdown
| GameID | SessionID | MapName          | GameMode   | MaxPlayers | CurrentPlayers | FreeSlots | PlayerNames                                | SessionStartTime     | SessionEndTime       | GameStatus    |
|--------|-----------|------------------|------------|------------|-----------------|-----------|------------------------------------------|---------------------|-------------------|--------------|
| 123456 | A1        | Desert_Base      | Deathmatch  | 16         | 8               | 8         | Player1, Player2, Player3, Player4, Player5, Player6, Player7, Player8 | 2022-12-12 12:00:00 | 2022-12-12 13:00:00 | In Progress   |
| 987654 | B2        | Castle_Siege     | Capture the Flag | 16 | 12 | 4 | Player9, Player10, Player11, Player12, Player13, Player14, Player15, Player16 | 2022-12-12 13:05:00 | 2022-12-12 14:00:00 | In Progress   |
```

**Matchmaking Process**

The matchmaking process uses the following steps:

1. Query available games (based on player preferences for game mode, map, and player count).
2. Find open sessions that meet the criteria.
3. If no suitable session is found, create a new one if there are enough free slots.
4. Add the player to the selected session and update the `PlayerNames`, `CurrentPlayers`, and `FreeSlots` columns accordingly.
5. Notify the player of their new session details.

**Session Management**

During gameplay, the system continuously monitors the number of players in each session. When a player leaves or disconnects:

1. Update the `PlayerNames`, `CurrentPlayers`, and `FreeSlots` columns accordingly.
2. If the session reaches the minimum player count (as specified during game setup), end the session and update the `GameStatus`.
3. Notify other players in the session of any changes, such as a player leaving or the game ending.

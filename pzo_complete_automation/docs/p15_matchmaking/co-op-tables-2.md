Co-op Tables (v2)
===================

This document outlines the version 2 implementation of the cooperative matchmaking tables, detailing the table structure and behavior for multiplayer experiences in games.

### Tables Structure

The co-op tables v2 are structured around three main components:

1. **Session** - Represents a unique instance of a multiplayer game that allows multiple players to join and play together. Each session is identified by its `session_id`.

2. **Table** - Represents an individual group or room within a session, with a maximum capacity for the number of players that can join. A table is uniquely identified by its `table_id` within a session.

3. **Player** - Represents an active player participating in a multiplayer game. Each player has a unique identifier known as the `player_id`.

### Session Lifecycle

Sessions follow the following lifecycle:

1. **Creation**: A session is created when a host initiates a new game. At this point, the session becomes visible to other players for joining.

2. **Joining**: Players can join an existing session through matchmaking services or by directly entering a session's `session_id`. The number of available tables within the session determines how many players can join initially.

3. **Start**: Once all necessary players have joined, the session moves into the game state, and the game begins for everyone in the session.

4. **In-game**: Players interact with each other during the gameplay phase. The game master ensures that all player actions are synchronized across the network to maintain consistency.

5. **Completion/End**: A session ends when either all players complete the game, a predefined time limit is reached, or an unexpected disconnection occurs. At this point, the session is removed from the matchmaking services and becomes unavailable for new players.

6. **Leave**: Players can leave the session at any point during its lifecycle, either by being disconnected or by choosing to quit. If a player leaves, the game master will attempt to fill their spot with another player if possible.

### Table Lifecycle

Tables within each session follow a similar lifecycle:

1. **Creation**: When a new table is created, it becomes available for players to join. Tables are created whenever there is room for more players within the session's capacity.

2. **Joining**: Players can join tables by either choosing an open table or requesting to create one when no open tables are available. If a player joins a full table, the game master may split the table and redistribute the players as necessary.

3. **In-game**: The table functions identically to the session during the in-game phase, with all players interacting with each other according to the game rules.

4. **Completion/End**: A table ends when all its players complete a round or leave the table. When there are no remaining players in a table, it is removed from the session.

### Player Lifecycle

Players follow the following lifecycle:

1. **Joining**: Players join sessions and tables either through matchmaking services or by entering the session and table `id`.

2. **In-game**: Active players participate in gameplay, sending their actions to the game master for synchronization.

3. **Leaving**: Players can leave a session or table at any time by choosing to quit or experiencing disconnection issues. If a player leaves, the game master will attempt to fill their spot if possible.

4. **Rejoining**: Players who experience disconnections may reconnect and return to the game by re-entering the session's `session_id`. They will be placed back into an open table or join an existing one, depending on availability.

### Table Splitting

When a table reaches its maximum capacity and another player attempts to join, the game master may split the table into two equal halves if necessary to accommodate the new player. The splitting process follows these steps:

1. **Determine Split Point**: The game master calculates the midpoint of the current players in the table and splits the table at that point.

2. **Form New Table**: A new table is created with half of the players from the original table, including any newly-joined player if applicable.

3. **Assign Players**: The remaining players on the original table are reassigned to the newly formed table or remain in their current table depending on the number of available seats and player distribution.

### Player Disconnection Handling

The game master monitors all active players during a session, and upon detecting a disconnection, the following actions occur:

1. **Detect**: The game master detects that a player has been disconnected from the network due to internet issues or other unexpected events.

2. **Inform Players**: Other active players in the session are notified of the disconnected player's departure.

3. **Attempt Reconnection**: If possible, the game master will attempt to reconnect the disconnected player by sending them a notification and providing options for rejoining the session or table.

4. **Fill Empty Seat**: If the disconnected player does not return within a reasonable amount of time, the game master attempts to fill their empty seat with another player from the waiting queue or through matchmaking services.

5. **Continue Game**: The game continues for all remaining active players in the session and tables, with any changes to player counts or seating adjustments happening as necessary.

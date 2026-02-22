Title: Session Management (v5)

Session management in the matchmaking system handles the creation, management, and deletion of gaming sessions. This document outlines the v5 implementation of session management.

## Key Concepts
- **Session ID**: A unique identifier assigned to each gaming session.
- **Session Creator**: The user who initiates a new session.
- **Minimum Players**: The minimum number of players required to start a session.
- **Maximum Players**: The maximum number of players allowed in a single session.
- **In-progress Session**: A session that is currently being played by one or more users.
- **Full Session**: A session that has reached its maximum player count and no longer accepts new players.
- **Available Session**: A session with vacant slots for new players to join.

## Functionalities

### Creating a New Session
1. The session creator initiates the process, specifying the game type, difficulty level, and the minimum/maximum player count (if not predefined).
2. Once the required number of players has joined, the session becomes in-progress. If not, the session remains available for more players to join.
3. The system assigns a unique Session ID to each newly created session.

### Joining an Existing Session
1. Users can browse available sessions and choose one that fits their preferences (game type, difficulty level, and player count).
2. Once the user clicks "Join," they are added as a participant in the chosen session, and the session moves from "Available" to "In-Progress."

### Leaving a Session
1. A participating user can leave a session at any time, reducing the total number of players in the session.
2. If the session has fewer players than the minimum requirement, it reverts back to an "Available" status to allow new players to join.
3. The system updates the player count and session information accordingly.

### Deleting a Session
1. A session can be deleted if it is empty (i.e., all participants have left).
2. When a session is deleted, the Session ID is also deactivated, and its data may be archived for future reference.

## Error Handling
The system will handle errors such as:
- Trying to join an in-progress or full session with a maximum player count.
- Trying to create a new session with invalid input (e.g., negative player counts).
- Attempting to leave a session when there are no players left.
- Deleting an empty session that has not been idle for the predefined time limit.

## Notifications
Users will receive real-time notifications on their actions and the status of sessions, such as:
- When they successfully join or leave a session.
- When a session they have created or joined reaches its minimum player count.
- When a session they are in transitions from "Available" to "In-Progress."
- Any relevant error messages due to unsuccessful actions (e.g., joining a full session).

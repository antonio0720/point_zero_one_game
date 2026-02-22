async function example() {
// Create a new session
const userId = 1;
const sessionData: SyncData = {
sessionId: uuidv4(),
userId,
data: {},
};
await sessionHandoffService.saveSession(sessionData);

// Get all sessions
const sessions = await sessionHandoffService.getSessions();
console.log("All sessions:", sessions);

// Update a session
const newData = { key: "newValue" };
await sessionHandoffService.updateSession(sessionData.sessionId, newData);

// Remove a session
await sessionHandoffService.removeSession(sessionData.sessionId);
}

example();
```

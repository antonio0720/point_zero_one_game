async function main() {
// Add a new player with Newbie badge
const newPlayerId = "new_player";
const newPlayer = { id: newPlayerId, score: 0, badges: new Set([Badge.Newbie]) };
await setPlayer(newPlayerId, newPlayer);

// Increment player score and add TopPlayer badge if needed
await incrementScore(newPlayerId);
const updatedPlayer = await getPlayer(newPlayerId);
if (updatedPlayer) {
if (!updatedPlayer.badges.has(Badge.TopPlayer)) {
await addBadge(newPlayerId, Badge.TopPlayer);
}
}
}

main();
```

if (!clients.has(data.tableId)) {
clients.set(data.tableId, new Set());
}
clients.get(data.tableId).add(ws);
break;

case 'ready':
clients.get(data.tableId)?.forEach((client) => {
if (client !== ws && !client.readyState === ws.READYSTATE.CLOSED) {
client.send(JSON.stringify({ type: 'ready', fromId: ws.id }))
}
});
break;

case 'start':
// Once all players are ready, start the game and remove the table from clients map
if (clients.get(data.tableId)?.size === clients.get(data.tableId)?.size - 1) {
// Start game logic here
clients.delete(data.tableId);
}
break;
}
});

ws.on('close', () => {
console.log('Client disconnected');
clients.forEach((players, tableId) => {
if (players.has(ws)) {
players.delete(ws);
if (players.size === 0) {
clients.delete(tableId);
}
}
});
});
});

app.listen(port, () => console.log(`Server is running on port ${port}`));
```

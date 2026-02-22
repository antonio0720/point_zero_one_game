```sh
npm install express socket.io @socket.io/core socket.io-redis redis
```

This code sets up a WebSocket server that allows clients to join rooms and send tick data, which is then broadcasted to all clients in the same room. The session management is handled using Redis sessions.

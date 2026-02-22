import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

class Matchmaking {
private sessions: Map<string, Set<string>> = new Map();

constructor(private io: Server) {}

public start() {
this.io.on('connection', (socket: Socket) => {
socket.on('join-match', () => {
const sessionId = uuidv4();
this.sessions.set(sessionId, new Set());
this.sessions.get(sessionId)!.add(socket.id);
socket.join(sessionId);
});

socket.on('send-tick', (data: any) => {
this.sessions.forEach((players, sessionId) => {
if (!players.has(socket.id)) return;
players.forEach((playerId) => {
if (playerId === socket.id) return;
const otherSocket = this.io.sockets.connected[playerId];
if (otherSocket) otherSocket.emit('receive-tick', data);
});
});
});
});
}
}

const server = require('http').createServer();
const io = new Server(server);
const matchmaking = new Matchmaking(io);
matchmaking.start();

server.listen(3000, () => console.log('Matchmaking server running on port 3000'));

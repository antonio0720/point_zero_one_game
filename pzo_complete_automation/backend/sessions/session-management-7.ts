import express from 'express';
import { Session, SessionDocument } from '../models/sessionModel';
import { Player, PlayerDocument } from '../models/playerModel';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Create a new session with initial players and start matchmaking
router.post('/create', async (req, res) => {
try {
const sessionId = uuidv4();
const newSession = new Session({ _id: sessionId });
await newSession.save();

for (let i = 0; i < req.body.playersCount; i++) {
const newPlayer = new Player();
newPlayer._id = uuidv4();
await newPlayer.save();
newSession.players.push(newPlayer._id);
}

await newSession.save();
res.status(201).json({ sessionId });
} catch (error) {
console.error(error);
res.status(500).send('Error creating session');
}
});

// Join an existing session with a player
router.post('/join', async (req, res) => {
try {
const { sessionId } = req.body;
const session = await Session.findOne({ _id: sessionId });

if (!session) {
return res.status(404).send('Session not found');
}

if (session.players.length >= req.body.maxPlayers) {
return res.status(403).send('Session is full');
}

const newPlayer = new Player();
newPlayer._id = uuidv4();
await newPlayer.save();
session.players.push(newPlayer._id);
await session.save();

res.status(201).json({ playerId: newPlayer._id });
} catch (error) {
console.error(error);
res.status(500).send('Error joining session');
}
});

// Start matchmaking for a session
router.post('/startMatchmaking', async (req, res) => {
try {
const session = await Session.findOne({ _id: req.body.sessionId });

if (!session) {
return res.status(404).send('Session not found');
}

// Implement your matchmaking logic here
// For this example, we'll just randomly pair the players
const players = await Player.find({ _id: { $in: session.players } });
const playerPairs = [];

for (let i = 0; i < Math.floor(players.length / 2); i++) {
const firstPlayerIndex = Math.floor(Math.random() * players.length);
const secondPlayerIndex = (firstPlayerIndex + 1) % players.length;
playerPairs.push({ player1: players[firstPlayerIndex]._id, player2: players[secondPlayerIndex]._id });
}

session.matchResults = playerPairs;
await session.save();

res.status(200).json({ matchResults: playerPairs });
} catch (error) {
console.error(error);
res.status(500).send('Error starting matchmaking');
}
});

export default router;

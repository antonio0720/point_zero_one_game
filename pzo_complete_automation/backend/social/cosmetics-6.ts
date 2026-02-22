import * as firebase from 'firebase';
import * as express from 'express';
import * as http from 'http';
import * as socketIo from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Initialize Firebase and setup the database
firebase.initializeApp({
// Your Firebase configuration here
});
const db = firebase.firestore();

// Create a leaderboard collection in Firestore
db.collection('leaderboards').doc('global');

io.on('connection', (socket) => {
socket.on('join', (username: string) => {
// Save the user's username to Firestore when they join
db.collection('users').doc(socket.id).set({ username });

// Update the user's score every time they score in the game
socket.on('score', (points: number) => {
const userRef = db.collection('users').doc(socket.id);
userRef.update({ score: firebase.firestore.FieldValue.increment(points) });

// Update the global leaderboard with the new score
db.collection('leaderboards').doc('global').onSnapshot((snapshot) => {
const leaderboardData = snapshot.data();
let newLeaderboard: any = {};

// Merge the existing data and the user's new score (to maintain the original order)
Object.assign(newLeaderboard, leaderboardData);
newLeaderboard[socket.id] = { score: points };

// Sort the new leaderboard by score in descending order
const sortedLeaderboard = Object.entries(newLeaderboard).sort((a, b) => b[1].score - a[1].score);

// Save the updated leaderboard to Firestore (for persistence and real-time updates)
db.collection('leaderboards').doc('global').set({ ...Object.fromEntries(sortedLeaderboard) });
});
});
});
});

server.listen(3000, () => console.log('Server started on port 3000'));

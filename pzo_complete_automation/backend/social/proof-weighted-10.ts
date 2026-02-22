import express from 'express';
import mongoose from 'mongoose';
import { Leaderboard } from './models/leaderboard';
import { User } from './models/user';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/social-game', { useNewUrlParser: true, useUnifiedTopology: true })
.then(() => console.log('Connected to database'))
.catch(err => console.error(`Failed to connect to database: ${err}`));

// Define the Leaderboard schema
const leaderboardSchema = new mongoose.Schema({
name: String,
users: [User.schema],
});

// Define the User schema
const userSchema = new mongoose.Schema({
id: String, // unique user identifier (e.g., Discord ID)
score: Number, // the user's current score
});

// Compile and export the models
export const Leaderboard = mongoose.model('Leaderboard', leaderboardSchema);
export const User = mongoose.model('User', userSchema);

app.get('/leaderboards/:name', async (req, res) => {
try {
const leaderboardName = req.params.name;
const leaderboard = await Leaderboard.findOne({ name: leaderboardName }).populate('users.id', 'id score');

if (!leaderboard) return res.status(404).json({ error: 'Leaderboard not found' });

const sortedUsers = leaderboard.users.sort((a, b) => b.score - a.score); // reverse order for higher scores first

res.json(sortedUsers);
} catch (err) {
console.error(`Error retrieving leaderboard: ${err}`);
res.status(500).json({ error: 'Internal Server Error' });
}
});

app.post('/leaderboards/:name', async (req, res) => {
try {
const leaderboardName = req.params.name;
const { users } = req.body; // expect an array of user objects with ids and scores

// Find or create the leaderboard
let leaderboard = await Leaderboard.findOne({ name: leaderboardName });
if (!leaderboard) leaderboard = new Leaderboard({ name: leaderboardName });

// Update or add users to the leaderboard
for (const user of users) {
const existingUser = leaderboard.users.id(user.id);

if (existingUser) { // update an existing user's score
existingUser.score += user.score;
} else { // add a new user to the leaderboard
leaderboard.users.push(new User({ id: user.id, score: user.score }));
}
}

await leaderboard.save();
res.json({ message: 'Leaderboard updated successfully' });
} catch (err) {
console.error(`Error updating leaderboard: ${err}`);
res.status(500).json({ error: 'Internal Server Error' });
}
});

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server started on port ${port}`));

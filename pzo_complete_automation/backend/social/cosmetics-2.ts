import express, { Request, Response } from 'express';
import mongoose from 'mongoose';

// Leaderboard schema
const leaderboardSchema = new mongoose.Schema({
username: String,
score: Number,
});

// Initialize the model and export it
export const Leaderboard = mongoose.model('Leaderboard', leaderboardSchema);

const app = express();
app.use(express.json());

// Connect to MongoDB
mongoose.connect('<YOUR_MONGODB_CONNECTION_STRING>', { useNewUrlParser: true, useUnifiedTopology: true });

app.get('/leaderboard', async (req: Request, res: Response) => {
try {
const leaderboards = await Leaderboard.find().sort({ score: -1 }).limit(10);
res.json(leaderboards);
} catch (err) {
console.error(err);
res.status(500).send('Error fetching leaderboards');
}
});

app.post('/submit-score', async (req: Request, res: Response) => {
const { username, score } = req.body;

try {
// Check if the user already exists in the leaderboard
const existingUser = await Leaderboard.findOne({ username });

if (existingUser) {
// Update the user's score and save it
existingUser.score += score;
await existingUser.save();
} else {
// Create a new entry in the leaderboard
const newLeaderboard = new Leaderboard({ username, score });
await newLeaderboard.save();
}

res.status(201).send('Score submitted');
} catch (err) {
console.error(err);
res.status(500).send('Error submitting score');
}
});

app.listen(3000, () => console.log(`Server is running on port 3000`));

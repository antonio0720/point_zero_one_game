import express from 'express';
import mongoose from 'mongoose';

// Player schema
const PlayerSchema = new mongoose.Schema({
username: String,
score: Number
});

const Player = mongoose.model('Player', PlayerSchema);

const app = express();
app.use(express.json());

// Connect to MongoDB
mongoose.connect('mongodb://localhost/social-game', { useNewUrlParser: true, useUnifiedTopology: true })
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('Failed to connect to MongoDB', err));

// Add player route
app.post('/players', async (req, res) => {
const newPlayer = new Player({ username: req.body.username });
await newPlayer.save();
res.send(newPlayer);
});

// Update player score route
app.put('/players/:id', async (req, res) => {
const { id } = req.params;
const updatedScore = req.body.score;

await Player.findByIdAndUpdate(id, { score: updatedScore }, { new: true });
res.send('Player score updated');
});

// Get leaderboard route
app.get('/leaderboard', async (req, res) => {
const players = await Player.find().sort({ score: -1 }).limit(10);
res.json(players);
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server started on port ${port}`));

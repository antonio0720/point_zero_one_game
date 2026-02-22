import express from 'express';
import mongoose, { Schema, Document } from 'mongoose';

const ContestantProfileSchema: Schema = new Schema({
name: { type: String, required: true },
age: Number,
country: String,
bio: String,
});

interface IContestantProfile extends Document {
name: string;
age: number;
country: string;
bio: string;
}

const ContestantProfile = mongoose.model<IContestantProfile>('ContestantProfile', ContestantProfileSchema);

const app = express();
app.use(express.json());

// Routes for handling CRUD operations on contestant profiles
app.get('/profiles', async (req, res) => {
const profiles = await ContestantProfile.find({});
res.status(200).json(profiles);
});

app.post('/profiles', async (req, res) => {
const profile = new ContestantProfile(req.body);
await profile.save();
res.status(201).json(profile);
});

app.put('/profiles/:id', async (req, res) => {
const updatedProfile = await ContestantProfile.findByIdAndUpdate(req.params.id, req.body, { new: true });
if (!updatedProfile) return res.status(404).json({ message: 'Profile not found' });
res.status(200).json(updatedProfile);
});

app.delete('/profiles/:id', async (req, res) => {
const deletedProfile = await ContestantProfile.findByIdAndDelete(req.params.id);
if (!deletedProfile) return res.status(404).json({ message: 'Profile not found' });
res.status(200).json(deletedProfile);
});

// Connection to MongoDB
const mongoURL = process.env.MONGODB_URI || 'mongodb://localhost/contestantdb';
mongoose.connect(mongoURL, { useNewUrlParser: true, useUnifiedTopology: true })
.then(() => console.log('Connected to MongoDB'))
.catch((error) => console.error(`Error connecting to MongoDB: ${error}`));

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
console.log(`Server is running on port ${port}`);
});

import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const uri = process.env.MONGODB_URI;

// Connect to MongoDB
mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
mongoose.connection.once('open', () => {
console.log('Connected to MongoDB');
});

const userSchema = new mongoose.Schema({
email: String,
password: String,
});

const User = mongoose.model('User', userSchema);

app.post('/recover-account', async (req, res) => {
const { email } = req.body;
const user = await User.findOne({ email });

if (!user) return res.status(404).send('User not found');

// Generate a token with user's id and email
const token = jwt.sign(
{ userId: user._id, email: user.email },
process.env.JWT_SECRET,
{ expiresIn: '24h' }
);

res.status(200).json({ token });
});

app.listen(port, () => {
console.log(`Server is running on port ${port}`);
});

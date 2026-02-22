import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// User schema and model
const userSchema = new mongoose.Schema({
username: String,
password: String,
scores: [{ value: Number, weight: Number }],
});
const User = mongoose.model('User', userSchema);

// JWT secret and expiration time
const jwtSecret = 'your_jwt_secret';
const jwtExpiryMS = 60 * 60 * 24 * 7; // 7 days

// Initialize Express app
const app = express();
app.use(express.json());

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/leaderboard', { useNewUrlParser: true, useUnifiedTopology: true })
.then(() => console.log('Connected to database'))
.catch((err) => console.error(err));

// Hash password before saving it to the database
userSchema.pre('save', function (next) {
const user = this;
if (!user.isModified('password')) return next();
bcrypt.hash(user.password, 10, (err, hash) => {
if (err) return next(err);
user.password = hash;
next();
});
});

// User authentication middleware
function authenticate(req, res, next) {
const token = req.header('x-auth-token');
jwt.verify(token, jwtSecret, (err, decoded) => {
if (err) return res.status(401).send('Invalid token');
req.user = decoded;
next();
});
}

// Routes for user registration and login
app.post('/api/register', async (req, res) => {
const newUser = new User(req.body);
try {
await newUser.save();
res.send(newUser);
} catch (err) {
res.status(400).send(err.message);
}
});

app.post('/api/login', async (req, res) => {
const user = await User.findOne({ username: req.body.username });
if (!user) return res.status(400).send('Invalid username or password');

const validPassword = await bcrypt.compare(req.body.password, user.password);
if (!validPassword) return res.status(400).send('Invalid username or password');

const token = jwt.sign({ _id: user._id }, jwtSecret, { expiresIn: jwtExpiryMS });
res.header('x-auth-token', token).send(token);
});

// Route for score submission
app.post('/api/submitScore', authenticate, async (req, res) => {
req.user.scores.push({ value: req.body.value, weight: req.body.weight });
await req.user.save();
res.send(req.user);
});

// Route for retrieving top N users based on their scores
app.get('/api/topUsers/:n', async (req, res) => {
const n = parseInt(req.params.n);
const users = await User.find().sort({ score: -1 }).limit(n);
res.send(users);
});

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));

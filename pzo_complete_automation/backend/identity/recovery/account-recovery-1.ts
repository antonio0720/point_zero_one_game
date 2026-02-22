import express from 'express';
import passport from 'passport';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
app.use(passport.initialize());

// Assuming you have User and LocalStrategy defined elsewhere
const LocalStrategy = require('passport-local').Strategy;
const User = require('./models/User');

passport.use(new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
const user = await User.findOne({ email });

if (!user) return done(null, false);

bcrypt.compare(password, user.password, (err, res) => {
if (res) return done(null, user);
else return done(null, false);
});
}));

passport.serializeUser((user: any, done) => {
done(null, user.id);
});

passport.deserializeUser(async (id: number, done) => {
const user = await User.findOne({ where: { id } });
done(null, user);
});

app.post('/recover', async (req, res) => {
const email = req.body.email;
const user = await User.findOne({ where: { email } });

if (!user) return res.status(404).send('User not found');

// Generate a recovery token and save it to the user
const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
await User.update({ recoveryToken: token }, { where: { id: user.id } });

res.status(200).json({ message: 'Recovery email sent', token });
});

// ... other routes and configurations

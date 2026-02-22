import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import passport from 'passport';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Import Passport strategies and User model
import { Strategy as LocalStrategy } from 'passport-local';
import { ExtractJwt, Strategy as JwtStrategy } from 'passport-jwt';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from './models/User';

// Import Postmortem schema and model
import Postmortem from './models/Postmortem';

const app = express();
app.use(bodyParser.json());
app.use(cors());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI as string, { useNewUrlParser: true, useUnifiedTopology: true });

// Configure Passport strategies
passport.use(
new LocalStrategy((username, password, done) => {
User.findOne({ username }, (err, user) => {
if (err) return done(err);
if (!user) return done(null, false);

bcrypt.compare(password, user.password, (err, res) => {
if (res) return done(null, user);
else return done(null, false);
});
});
})
);
passport.use(
new JwtStrategy({
jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
secretOrKey: process.env.SECRET_KEY,
}, (jwtPayload, done) => {
User.findById(jwtPayload._id, (err, user) => {
if (err) return done(err);
if (user) return done(null, user);
else return done(null, false);
});
})
);
passport.serializeUser((user: any, done) => done(null, user._id));
passport.deserializeUser((id: string, done) => User.findById(id, (err, user) => done(err, user)));

// Define routes
app.post('/login', passport.authenticate('local'), (req, res) => {
// Generate JWT and send it as a response
});

app.post('/logout', passport.authenticate('jwt', { session: false }), (req, res) => {
req.logout();
res.sendStatus(200);
});

app.get('/profile', passport.authenticate('jwt', { session: false }), (req, res) => {
// Send authenticated user data as a response
});

app.post('/postmortems', passport.authenticate('jwt', { session: false }), (req, res) => {
const postmortem = new Postmortem(req.body);
postmortem.user = req.user; // Set the user who created the postmortem
postmortem.save((err) => {
if (err) return res.status(500).send(err);
res.status(201).send(postmortem);
});
});

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));

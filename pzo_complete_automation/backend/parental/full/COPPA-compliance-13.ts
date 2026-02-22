import express from 'express';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcryptjs';
import { User } from './models/User';

const app = express();
app.use(express.json());
app.use(passport.initialize());

passport.use(new LocalStrategy((username, password, done) => {
User.findOne({ username }, async (err, user) => {
if (err) return done(err);
if (!user) return done(null, false, { message: 'Incorrect username.' });

const validPassword = await bcrypt.compare(password, user.password);
if (!validPassword) return done(null, false, { message: 'Incorrect password.' });

return done(null, user);
});
}));

app.post('/login', passport.authenticate('local'), (req, res) => {
const { userId } = req.user;
if (!userId) return res.status(401).send({ error: 'Unauthorized' });

// Implement parental controls and age-gating logic here.
// For example, you might check the user's age or specific permission levels.

res.json({ message: 'Logged in successfully.' });
});

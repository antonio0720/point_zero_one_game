import express from 'express';
import passport from 'passport';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();
const saltRounds = Number(process.env.SALT_ROUNDS) || 10;

// User model (Mongoose or any ORM you prefer)
interface User {
email: string;
password: string;
}

const router = express.Router();

// Define strategies for authentication and registration with Passport
passport.use(new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
const user = await User.findOne({ email });
if (!user) return done(null, false);

const isMatch = await bcrypt.compare(password, user.password);
if (!isMatch) return done(null, false);

return done(null, user);
}));

passport.use('local-register', new LocalStrategy({ passReqToCallback: true }, async (req, email, password, done) => {
const existingUser = await User.findOne({ email });
if (existingUser) return done(null, false);

const hashedPassword = await bcrypt.hash(password, saltRounds);
const newUser = await User.create({ email, password: hashedPassword });

return done(null, newUser);
}));

// Routes for login and registration
router.post('/login', passport.authenticate('local'), (req, res) => {
res.json(req.user);
});

router.post('/register', passport.authenticate('local-register'), (req, res) => {
res.json(req.user);
});

// Routes for account recovery like email verification and password reset
router.get('/recover-password', async (req, res) => {
// Send an email with a link to reset the password
});

router.post('/reset-password', async (req, res) => {
const user = await User.findOne({ email: req.body.email });
if (!user) return res.status(404).json({ error: 'User not found' });

// Check the token and update the password
});

export default router;

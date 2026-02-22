import express from 'express';
import passport from 'passport';
import LocalStrategy from 'passport-local';
import bcrypt from 'bcryptjs';
import { User } from '../models/user.model';

const router = express.Router();
const saltRounds = 10;

// Initialize Passport and strategy
passport.use(new LocalStrategy({ usernameField: 'email' }, (email, password, done) => {
User.findOne({ email })
.then((user) => {
if (!user) return done(null, false);

bcrypt.compare(password, user.password, (err, res) => {
if (res) return done(null, user);
else return done(null, false);
});
})
.catch((err) => done(err));
}));

passport.serializeUser((user: any, done) => {
done(null, user.id);
});

passport.deserializeUser((id: number, done) => {
User.findById(id)
.then((user) => done(null, user))
.catch((err) => done(err));
});

router.post('/login', (req, res, next) => {
passport.authenticate('local', (err, user, info) => {
if (err) return next(err);
if (!user) return res.status(401).send(info);

req.login(user, { session: false }, (error) => {
if (error) return next(error);
res.json({ user });
});
})(req, res, next);
});

router.post('/logout', (req, res) => {
req.logout();
res.status(200).send('Logged out');
});

export default router;

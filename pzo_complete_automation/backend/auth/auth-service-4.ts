import express from 'express';
import passport from 'passport';
import LocalStrategy from 'passport-local';
import { Strategy as JWTStrategy, ExtractJwt } from 'passport-jwt';
import { secretOrKey } from './config';
import * as jwt from 'jsonwebtoken';
import User from '../models/user.model';

const authRouter = express.Router();
const LocalLoginStrategy = new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
try {
const user = await User.findOne({ email });
if (!user || !user.validatePassword(password)) return done(null, false);
return done(null, user);
} catch (err) {
return done(err);
}
});

const jwtOptions = {
jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
secretOrKey,
};

const jwtLoginStrategy = new JWTStrategy(jwtOptions, async (payload, done) => {
try {
const user = await User.findById(payload.id);
if (!user) return done(null, false);
return done(null, user);
} catch (err) {
return done(err);
}
});

passport.use('local', LocalLoginStrategy);
passport.use('jwt', jwtLoginStrategy);

authRouter.post('/login', passport.authenticate('local'), async (req, res) => {
const { email, _id } = req.user;
res.json({ email, id: _id });
});

authRouter.get('/logout', (req, res) => {
req.logout();
res.redirect('/');
});

authRouter.post(
'/jwt-login',
passport.authenticate('jwt', { session: false }),
async (req, res) => {
const { email, _id } = req.user;
const token = jwt.sign({ id: _id }, secretOrKey, { expiresIn: '1h' });
res.json({ email, id: _id, token });
}
);

export default authRouter;

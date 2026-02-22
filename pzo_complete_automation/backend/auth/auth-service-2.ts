import * as express from 'express';
import passport from 'passport';
import LocalStrategy from 'passport-local';
import { Strategy as JWTStrategy, ExtractJwt } from 'passport-jwt';
import { Secret } from 'constants';
import mongoose from 'mongoose';
import User, { IUser } from '../models/user.model';

const authRouter = express.Router();
const LocalAuthenticationStrategy = new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
try {
const user = await User.findOne({ email });
if (!user || !user.validatePassword(password)) return done(null, false);
return done(null, user);
} catch (err) {
return done(err);
}
});

const JWTAuthenticationStrategy = new JWTStrategy({
jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
secretOrKey: Secret.jwt,
}, async (payload, done) => {
try {
const user = await User.findById(payload.id);
if (!user) return done(null, false);
return done(null, user);
} catch (err) {
return done(err);
}
});

passport.use('local', LocalAuthenticationStrategy);
passport.use('jwt', JWTAuthenticationStrategy);

authRouter.post('/login', passport.authenticate('local'), async (req, res) => {
const { _id, email } = req.user;
res.json({ id: _id, email });
});

authRouter.get('/logout', async (req, res) => {
// handle session/token deletion
});

authRouter.post(
'/refresh-token',
passport.authenticate('jwt', { session: false }),
async (req, res) => {
const refreshToken = req.body.refreshToken;
// Verify the token and issue a new one if valid
}
);

export default authRouter;

import * as express from 'express';
import * as passport from 'passport';
import * as LocalStrategy from 'passport-local';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { jwtSecret } from '../config/constants';
import { User } from '../models/user.model';

const authRouter = express.Router();

// Configure Passport strategies
passport.use(new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
try {
const user = await User.findOne({ email });

if (!user || !user.validatePassword(password)) {
return done(null, false);
}

return done(null, user);
} catch (err) {
return done(err);
}
}));

passport.use(new JwtStrategy({
jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
secretOrKey: jwtSecret
}, async (jwtPayload, done) => {
try {
const user = await User.findById(jwtPayload._id);

if (!user) {
return done(null, false);
}

return done(null, user);
} catch (err) {
return done(err);
}
}));

authRouter.post('/login', passport.authenticate('local'), (req, res) => {
res.json({ success: true, user: req.user });
});

authRouter.get('/profile', passport.authenticate('jwt', { session: false }), async (req, res) => {
res.json({ success: true, user: req.user });
});

export default authRouter;

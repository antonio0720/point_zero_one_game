import * as passport from 'passport';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import { User } from '../models/user.model';
import { Strategy as LocalStrategy } from 'passport-local';
import config from '../../config';

declare module 'passport' {
export interface StrategyOptions {
usernameField?: string;
passwordField?: string;
}
}

const localStrategy = new LocalStrategy<User, any>({
usernameField: 'email',
passwordField: 'password'
}, async (email, password, done) => {
try {
const user = await User.findOne({ email }).select('+password');

if (!user) return done(null, false, { message: 'Incorrect email.' });

const isMatch = await bcrypt.compare(password, user.password);

if (isMatch) return done(null, user);
else return done(null, false, { message: 'Incorrect password.' });
} catch (err) {
return done(err);
}
});

passport.use(localStrategy);

const signJwt = (userId: string) => {
return jwt.sign({ userId }, config.jwtSecret, { expiresIn: config.jwtExpirationInterval });
};

const createToken = async (user: User) => {
const token = await signJwt(user._id);
user.token = token;
await user.save();
return token;
};

const authenticate = (req, res, next) => {
passport.authenticate('local', (err, user, info) => {
if (err) return next(err);
if (!user) return res.status(401).json({ message: info?.message });

req.login(user, { session: false }, async (err) => {
if (err) return next(err);
try {
const token = await createToken(user);
res.status(200).json({ token });
} catch (err) {
res.status(500).json({ message: err.message });
}
});
})(req, res, next);
};

export { authenticate };

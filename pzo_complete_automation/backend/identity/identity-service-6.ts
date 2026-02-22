import * as express from 'express';
import * as passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { ExtractJwt, Strategy as JwtStrategy } from 'passport-jwt';
import { Secret } from 'jsonwebtoken';
import User, { IUser } from './models/user.model';

const jwtOptions = {
jwtFromRequest: ExtractJwt.fromAuthHeaderWithScheme('JWT'),
secretOrKey: process.env.SECRET as Secret,
};

const localStrategy = new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
try {
const user = await User.findOne({ email });
if (!user || !(await user.validatePassword(password))) return done(null, false);
return done(null, user);
} catch (err) {
return done(err);
}
});

const jwtStrategy = new JwtStrategy(jwtOptions, async (payload, done) => {
try {
const user: IUser = await User.findById(payload.id).exec();
if (!user) return done(null, false);
return done(null, user);
} catch (err) {
return done(err);
}
});

passport.use(localStrategy);
passport.use(jwtStrategy);

const app = express();
app.use(passport.initialize());

app.post('/login', passport.authenticate('local'), (req, res) => {
res.json({ token: req.user.generateToken() });
});

app.get('/profile', passport.authenticate('jwt', { session: false }), (req, res) => {
res.json(req.user);
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Identity Service running on port ${port}`));

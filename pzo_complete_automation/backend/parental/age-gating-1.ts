import express from 'express';
import passport from 'passport';
import LocalStrategy from 'passport-local';
import { Strategy as JWTStrategy, ExtractJwt } from 'passport-jwt';
import _ from 'lodash';
import jwt from 'jsonwebtoken';
import moment from 'moment';

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Set up Passport strategies and serialization
passport.use(
new LocalStrategy((username, password, done) => {
// Authenticate the user with your database or API
User.findOne({ username }, (err, user) => {
if (err) return done(err);
if (!user) return done(null, false, { message: 'Incorrect username.' });
if (!user.validatePassword(password))
return done(null, false, { message: 'Incorrect password.' });
return done(null, user);
});
})
);

passport.use(
new JWTStrategy(
{
jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
secretOrKey: 'your-secret-key',
},
(jwt_payload, done) => {
User.findById(jwt_payload.id, (err, user) => {
if (err) return done(err, false);
if (!user) return done(null, false);
return done(null, user);
});
}
)
);

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => User.findById(id, done));

app.post('/login', (req, res, next) => {
passport.authenticate('local', (err, user, info) => {
if (err) return next(err);
if (!user) return res.status(401).json({ error: info.message });

// Check the user's age and handle accordingly
const birthDate = new Date(user.birthdate);
const now = new Date();
const age = moment().diff(moment(birthDate), 'years');

if (age < 18) {
return res.status(403).json({ error: 'You are under 18. Access denied.' });
}

// Issue a JWT token and send it back in the response
const token = jwt.sign(
{ id: user._id, username: user.username },
'your-secret-key',
{ expiresIn: 60 * 60 * 24 } // Token expires in 1 day
);

res.json({ token });
})(req, res);
});

import * as express from 'express';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { User } from './user.model';

const router = express.Router();
const app = express();
app.use(passport.initialize());

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

passport.serializeUser((user: User, done) => {
done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
try {
const user = await User.findById(id);
done(null, user);
} catch (err) {
done(err);
}
});

router.post('/login', passport.authenticate('local'), (req, res) => {
// Successful login, send JWT or other authentication token here
res.send({ success: true });
});

app.use('/api/auth', router);

export default app;

done(null, false);
}));

passport.use('jwt', new JwtStrategy({
jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
secretOrKey: 'your_secret'
}, (payload, done) => {
User.id === payload.id ?
done(null, User) :
done(null, false);
}));

function generateAccessToken(user: any): string {
return jwt.sign({ id: user.id }, 'your_secret', { expiresIn: '24h' });
}

app.post('/login', (req, res) => {
passport.authenticate('local', (err, user, info) => {
if (err) return res.status(500).send({ message: err.message });
if (!user) return res.status(401).send({ message: 'Invalid username or password' });

req.login(user, { session: false }, (error) => {
if (error) return res.status(500).send({ message: error.message });

const accessToken = generateAccessToken(user);
res.json({ user, accessToken });
});
})(req, res);
});

app.get('/profile', passport.authenticate('jwt'), (req, res) => {
res.json(req.user);
});
```

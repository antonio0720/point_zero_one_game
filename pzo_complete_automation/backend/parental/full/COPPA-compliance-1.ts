import express from 'express';
import passport from 'passport';
import cookieSession from 'cookie-session';
import bodyParser from 'body-parser';
import mongoose from 'mongoose';
import User from './models/User';

const app = express();

// Connect to MongoDB (replace <your_connection_string> with your actual connection string)
mongoose.connect('<your_connection_string>', { useNewUrlParser: true, useUnifiedTopology: true });

app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieSession({ keys: ['secret'] }));
app.use(passport.initialize());
app.use(passport.session());

// Define strategies and local authentication strategy setup
passport.serializeUser((user: any, done) => {
done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
const user = await User.findById(id);
done(null, user);
});

// Define routes for age verification and parental controls
app.get('/signup', (req, res) => {
// Show signup form
});

app.post('/signup', async (req, res) => {
const { dob } = req.body;
const user = new User({ ...req.body, age: calculateAge(dob) });

if (user.age < 13) {
return res.status(403).send('Access denied - User must be at least 13 years old');
}

await user.save();
passport.authenticate('local')(req, res, () => {
res.redirect('/dashboard');
});
});

app.get('/login', (req, res) => {
// Show login form
});

app.post('/login', passport.authenticate('local'), (req, res) => {
res.redirect('/dashboard');
});

// Add more routes for parental controls

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));

function calculateAge(birthdate: string) {
const today = new Date();
const birthDate = new Date(birthdate);
let age = today.getFullYear() - birthDate.getFullYear();
const m = today.getMonth() - birthDate.getMonth();

if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
age--;
}

return age;
}

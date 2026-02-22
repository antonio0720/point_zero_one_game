import express from 'express';
import { validate } from 'express-validation';
import Joi from 'joi';

const app = express();
const MIN_AGE = 13; // Minimum age to access the service (you can adjust this as needed)

app.use(express.json());

// Define a validation schema for the user's birthdate
const birthdateValidationSchema = Joi.object({
birthdate: Joi.date().required()
});

// Middleware to check if the user meets the age requirement
function isUserOldEnough(req, res, next) {
const now = new Date();
const userBirthdate = req.body.birthdate;

// Calculate user's age in years
const userAge = Math.floor((now - userBirthdate) / (365 * 24 * 60 * 60)) + 1;

if (userAge >= MIN_AGE) {
next();
} else {
res.status(403).json({ error: 'User is not old enough to access the service.' });
}
}

// Validate the user's birthdate and check if they meet the age requirement
app.post('/check-age', validate({
body: {
birthdate: birthdateValidationSchema
}
}), isUserOldEnough, (req, res) => {
res.json({ message: 'You are old enough to access the service.' });
});

app.listen(3000, () => {
console.log('Server started on port 3000');
});

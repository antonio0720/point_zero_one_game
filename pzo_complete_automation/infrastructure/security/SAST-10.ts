import express from 'express';
import { body, checkSchema } from 'express-validator';

const app = express();

// Define validation schema and rules
const validationSchema = {
username: body('username').isAlphanumeric().withMessage('Username must contain only alphanumeric characters.'),
password: body('password')
.isLength({ min: 8 })
.withMessage('Password must be at least 8 characters long.')
.matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/)
.withMessage('Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character.'),
};

app.post('/login', checkSchema(validationSchema), (req, res) => {
const { error } = req;

if (error) {
return res.status(400).json({ error: error.toString() });
}

// Process the validated input data
const { username, password } = req.body;

// ... perform login logic here
});

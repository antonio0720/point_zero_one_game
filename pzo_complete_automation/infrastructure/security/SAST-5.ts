import express from 'express';
import { SanitizeHTML } from 'sanitize-html';

const app = express();
const sanitizer = new SanitizeHTML();

app.use(express.json());

// Example endpoint for user input validation and sanitization
app.post('/message', (req, res) => {
const message = req.body.message;

// Validate input
if (!message || typeof message !== 'string') {
return res.status(400).send('Invalid request');
}

// Sanitize input using the sanitize-html library
const safeMessage = sanitizer.sanitize(message, {
allowedTags: [],
allowedAttributes: {},
});

// Store or display the safe message
console.log(safeMessage);
res.send('Your safe message: ' + safeMessage);
});

app.listen(3000, () => {
console.log('Server started on port 3000');
});

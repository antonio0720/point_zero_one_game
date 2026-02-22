import express from 'express';
import { createSanitizer } from 'sanitize-html';
const sanitizer = createSanitizer();

const app = express();

app.use(express.json());

app.post('/processInput', (req, res) => {
const userInput = req.body.input;

const safeHTML = sanitizer.sanitize(userInput);
res.send(`You entered: ${safeHTML}`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
console.log(`Server is running on port ${PORT}`);
});

import express from 'express';
import bodyParser from 'body-parser';

const app = express();
app.use(bodyParser.json());

app.post('/api/execute', (req, res) => {
const { functionName } = req.body;

// Assuming you have functions in a separate module
const functions = require('./functions');

try {
const result = functions[functionName](req.body);
res.status(200).json({ result });
} catch (error) {
console.error(error);
res.status(500).json({ error: 'An error occurred while executing the function.' });
}
});

app.listen(3000, () => {
console.log('Server started on port 3000');
});

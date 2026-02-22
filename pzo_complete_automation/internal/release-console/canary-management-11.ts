import express from 'express';
import bodyParser from 'body-parser';
import { canaries } from './canaries.js';

const app = express();
app.use(bodyParser.json());

// List all Canaries
app.get('/canaries', (req, res) => {
res.status(200).json(canaries);
});

// Add a new Canary
app.post('/canaries', (req, res) => {
const canary = req.body;
canaries.push(canary);
res.status(201).json(canary);
});

// Replace an existing Canary by id
app.put('/canaries/:id', (req, res) => {
const id = parseInt(req.params.id);
const index = canaries.findIndex((c) => c.id === id);

if (index !== -1) {
canaries[index] = req.body;
res.status(200).json(canaries[index]);
} else {
res.status(404).send('Canary not found');
}
});

// Remove a Canary by id
app.delete('/canaries/:id', (req, res) => {
const id = parseInt(req.params.id);
const index = canaries.findIndex((c) => c.id === id);

if (index !== -1) {
canaries.splice(index, 1);
res.status(204).send();
} else {
res.status(404).send('Canary not found');
}
});

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));

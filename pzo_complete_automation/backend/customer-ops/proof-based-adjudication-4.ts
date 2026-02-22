import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';

// Proof Schema
const ProofSchema = new mongoose.Schema({
customerId: String,
proofType: String,
proofData: Buffer,
});

// Customer Schema
const CustomerSchema = new mongoose.Schema({
name: String,
email: String,
});

mongoose.connect('mongodb://localhost/customer-ops', { useNewUrlParser: true, useUnifiedTopology: true });
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
console.log('Connected to MongoDB');
});

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.post('/adjudicate-proof', async (req, res) => {
const { customerId, proofType, proofData } = req.body;

// Find the customer
const customer = await Customer.findOne({ _id: customerId });
if (!customer) return res.status(404).send('Customer not found');

// Save the proof
const proof = new Proof({ customerId, proofType, proofData });
await proof.save();

// Adjudicate the proof based on your business logic
// ...

res.send('Proof adjudicated successfully');
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
console.log(`Server running on port ${port}`);
});

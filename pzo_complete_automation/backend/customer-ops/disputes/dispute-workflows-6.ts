import express from 'express';
import mongoose from 'mongoose';

// Dispute model schema (define your own schema according to the database structure)
const DisputeSchema = new mongoose.Schema({
// Add fields as per your requirements
});

const Dispute = mongoose.model('Dispute', DisputeSchema);

const router = express.Router();

router.get('/:disputeId', async (req, res) => {
try {
const dispute = await Dispute.findById(req.params.disputeId);
if (!dispute) return res.status(404).send('Dispute not found.');
res.send(dispute);
} catch (err) {
console.error(err);
res.status(500).send('Internal Server Error.');
}
});

router.put('/:disputeId', async (req, res) => {
try {
const dispute = await Dispute.findByIdAndUpdate(req.params.disputeId, req.body, { new: true });
if (!dispute) return res.status(404).send('Dispute not found.');
res.send(dispute);
} catch (err) {
console.error(err);
res.status(500).send('Internal Server Error.');
}
});

// Connect to MongoDB, initialize the app and configure it to use the dispute workflows router
const dbUrl = 'mongodb://localhost/dispute-workflow';
mongoose.connect(dbUrl, { useNewUrlParser: true, useUnifiedTopology: true })
.then(() => console.log(`Connected to ${dbUrl}`))
.catch((err) => console.error('Failed to connect', err));

const app = express();
app.use('/api/disputes', router);
app.listen(3000, () => console.log('App is listening on port 3000!'));

import express from 'express';
import mongoose from 'mongoose';
import Dispute, { DisputeDocument } from './dispute.model';

const router = express.Router();

router.post('/', async (req, res) => {
try {
const dispute = new Dispute(req.body);
await dispute.save();
res.status(201).json(dispute);
} catch (error) {
res.status(400).json({ error: error.message });
}
});

router.get('/:id', async (req, res) => {
try {
const dispute = await Dispute.findById(req.params.id);
if (!dispute) return res.status(404).json({ error: 'Dispute not found' });
res.json(dispute);
} catch (error) {
res.status(500).json({ error: error.message });
}
});

router.patch('/:id', async (req, res) => {
try {
const dispute = await Dispute.findByIdAndUpdate(req.params.id, req.body, { new: true });
if (!dispute) return res.status(404).json({ error: 'Dispute not found' });
res.json(dispute);
} catch (error) {
res.status(400).json({ error: error.message });
}
});

router.delete('/:id', async (req, res) => {
try {
const dispute = await Dispute.findByIdAndDelete(req.params.id);
if (!dispute) return res.status(404).json({ error: 'Dispute not found' });
res.json({ message: 'Dispute deleted successfully' });
} catch (error) {
res.status(500).json({ error: error.message });
}
});

export default router;

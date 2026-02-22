import express from 'express';
import mongoose from 'mongoose';
import { Schema, model } from 'mongoose';

const app = express();
app.use(express.json());

// Feature flag schema
const FeatureFlagSchema = new Schema({
name: String,
isEnabled: Boolean,
});

const FeatureFlag = model('FeatureFlag', FeatureFlagSchema);

mongoose.connect('mongodb://localhost/feature-flags', { useNewUrlParser: true, useUnifiedTopology: true })
.then(() => console.log('Connected to database'))
.catch((err) => console.error(err));

app.get('/api/feature/:name', async (req, res) => {
try {
const feature = await FeatureFlag.findOne({ name: req.params.name });
if (!feature) return res.status(404).json({ error: 'Feature not found' });
res.json({ isEnabled: feature.isEnabled });
} catch (err) {
console.error(err);
res.status(500).json({ error: 'Internal server error' });
}
});

app.listen(3000, () => console.log('Server listening on port 3000'));

import express from 'express';
import mongoose from 'mongoose';
import { Request, Response } from 'express';
import { PolicyDocument, PolicyModel } from './policy.model';

const app = express();

// Replace <YOUR_MONGODB_URI> with your MongoDB connection URI
const mongoUri = '<YOUR_MONGODB_URI>';

mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true })
.then(() => console.log('Connected to MongoDB'))
.catch((err) => console.error(`Error connecting to MongoDB: ${err}`));

app.use(express.json());

// Policy Routes
const policyRoute = express.Router();
policyRoute.get('/', async (req: Request, res: Response) => {
const policies = await PolicyModel.find({});
res.send(policies);
});
policyRoute.post('/', async (req: Request, res: Response) => {
const policy = new PolicyModel(req.body);
await policy.save();
res.send(policy);
});
// Add more routes as needed
app.use('/api/policies', policyRoute);

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));

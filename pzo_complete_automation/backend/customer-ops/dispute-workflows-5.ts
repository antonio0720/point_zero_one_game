import express from 'express';
import { MongoClient } from 'mongodb';
import bodyParser from 'body-parser';

const app = express();
app.use(bodyParser.json());

let db;

(async () => {
const client = await MongoClient.connect('mongodb://localhost:27017', { useNewUrlParser: true, useUnifiedTopology: true });
db = client.db('customerOps');
})();

const disputeRoutes = express.Router();
disputeRoutes.post('/openDispute', async (req, res) => {
const disputeCollection = db.collection('disputes');
try {
const result = await disputeCollection.insertOne(req.body);
res.status(201).send(result.ops[0]);
} catch (error) {
console.error(error);
res.sendStatus(500);
}
});

app.use('/api/disputes', disputeRoutes);
app.listen(3000, () => console.log('Dispute workflows server started on port 3000'));

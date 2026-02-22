import * as express from 'express';
import { Client } from '@elastic/elasticsearch';

const app = express();
const esClient = new Client({ node: 'http://localhost:9200' });

app.use(express.json());

// Endpoint to index logs
app.post('/logs', async (req, res) => {
try {
const { index } = req.body;
await esClient.index({
index,
body: req.body,
});
res.status(200).send();
} catch (error) {
console.error(error);
res.status(500).send();
}
});

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
console.log(`Log aggregation service is running on port ${port}`);
});

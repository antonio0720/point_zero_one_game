import * as express from 'express';
import { Client } from '@elastic/elasticsearch';
import bodyParser from 'body-parser';

const app = express();
app.use(bodyParser.json());

// Initialize Elasticsearch client
const esClient = new Client({
node: 'http://localhost:9200',
});

// Index route to send logs to Elasticsearch
app.post('/logs', async (req, res) => {
try {
const logData = req.body;

await esClient.index({
index: 'my-logs-index',
body: logData,
});

res.status(201).send();
} catch (error) {
console.error(error);
res.status(500).send();
}
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Log aggregation service listening on port ${PORT}`));

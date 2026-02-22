import * as express from 'express';
import * as bodyParser from 'body-parser';
import { Client } from '@elastic/elasticsearch';

const app = express();
app.use(bodyParser.json());

const client = new Client({
node: 'http://localhost:9200',
});

// Index logs in Elasticsearch
async function indexLog(index: string, doc: object) {
await client.index({
index,
body: doc,
});
}

// Route to receive logs and send them to Elasticsearch
app.post('/logs', async (req, res) => {
try {
const index = 'application-logs';
await indexLog(index, req.body);
res.status(200).send('Log received.');
} catch (error) {
console.error(error);
res.status(500).send('Error indexing log.');
}
});

app.listen(3000, () => {
console.log('Server listening on port 3000');
});

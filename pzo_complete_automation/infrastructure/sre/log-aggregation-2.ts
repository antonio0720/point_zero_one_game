import * as express from 'express';
import * as bodyParser from 'body-parser';
import axios from 'axios';

const app = express();
app.use(bodyParser.json());

const port = process.env.PORT || 3000;

// Replace the below URL with your Elasticsearch endpoint and index name
const elasticUrl = 'http://localhost:9200/logs-index';

app.post('/logs', async (req, res) => {
try {
const logData = req.body;
await axios.post(elasticUrl, logData);
res.status(200).send('Log data received and sent to Elasticsearch.');
} catch (error) {
console.error(`Error sending log data to Elasticsearch: ${error}`);
res.status(500).send('Failed to send log data to Elasticsearch.');
}
});

app.listen(port, () => {
console.log(`Log aggregator is listening on port ${port}`);
});

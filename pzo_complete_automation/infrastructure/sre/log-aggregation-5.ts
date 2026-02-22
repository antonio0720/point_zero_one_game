import { Client } from '@elastic/elasticsearch';
import * as express from 'express';
import { Request, Response } from 'express';

const app = express();
const port = process.env.PORT || 3000;
const esClient = new Client({ node: 'http://localhost:9200' });

app.get('/logs', async (req: Request, res: Response) => {
const { index, start, end } = req.query;

if (!index || !start || !end) {
return res.status(400).json({ error: 'Missing required query parameters' });
}

try {
const response = await esClient.search({
index,
body: {
query: {
range: {
'@timestamp': {
gte: start,
lte: end,
},
},
},
},
});

return res.json(response.hits);
} catch (error) {
console.error(error);
return res.status(500).json({ error: 'Error fetching logs' });
}
});

app.listen(port, () => {
console.log(`Log aggregation service is running on port ${port}`);
});

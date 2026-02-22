import axios from 'axios';
import express, { Request, Response } from 'express';

const app = express();
const PORT = process.env.PORT || 3000;
const ANALYTICS_URL = 'https://your-analytics-service-url/api/telemetry';

app.use(express.json());

app.post('/api/metrics', async (req: Request, res: Response) => {
try {
const metricsData = req.body;
await axios.post(ANALYTICS_URL, metricsData);

res.status(200).send('Telemetry data sent to analytics service.');
} catch (error) {
console.error(`Error sending telemetry data: ${error}`);

res.status(500).send('Failed to send telemetry data to analytics service.');
}
});

app.listen(PORT, () => {
console.log(`Metrics pipeline listening on port ${PORT}`);
});

import express from 'express';
import axios from 'axios';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { Logger } from 'winston';

dotenv.config();
const app = express();
app.use(cors());
app.use(bodyParser.json());

const port = process.env.PORT || 3001;
const apiKey = process.env.API_KEY;
const analyticsUrl = 'https://analytics-api.example.com';
const logger: Logger = winston.createLogger({
level: 'info',
format: winston.format.json(),
});

app.post('/telemetry', async (req, res) => {
try {
const telemetryData = req.body;
if (!apiKey || !telemetryData.eventId || !telemetryData.userId) {
return res.status(400).json({ error: 'Missing required parameters' });
}

const response = await axios.post(`${analyticsUrl}/track`, {
event_id: telemetryData.eventId,
user_id: telemetryData.userId,
data: telemetryData,
}, {
headers: { Authorization: `Bearer ${apiKey}` },
});

if (response.status === 200) {
logger.info(`Telemetry event "${telemetryData.eventId}" collected for user "${telemetryData.userId}"`);
return res.sendStatus(200);
} else {
logger.error(`Failed to send telemetry event: ${response.status}`);
return res.status(500).json({ error: 'Internal server error' });
}
} catch (error) {
logger.error(`Error processing telemetry data: ${error}`);
return res.status(500).json({ error: 'Internal server error' });
}
});

logger.info(`Analytics Collector started on port ${port}`);
app.listen(port, () => console.log(`App listening on port ${port}`));

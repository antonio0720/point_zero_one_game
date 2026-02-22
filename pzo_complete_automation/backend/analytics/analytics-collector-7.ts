```typescript
import express from 'express';
import bodyParser from 'body-parser';
import { Router } from 'express';
import { analyticsService } from './analytics-service';

const app = express();
app.use(bodyParser.json());

const router = Router();

router.post('/track', async (req, res) => {
try {
const eventData = req.body;

await analyticsService.trackEvent(eventData);

res.status(200).send('Success');
} catch (error) {
console.error(error);
res.status(500).send('Error tracking event');
}
});

app.use('/api/analytics', router);

export default app;
```

This code creates an Express application with a single endpoint for receiving analytics events, handles JSON requests and sends a response accordingly based on the success or failure of the analytics service (which should be implemented separately).

You'll also need to implement `analyticsService.ts`:

```typescript
import { AnalyticsEvent } from './analytics-event';
import axios from 'axios';

export async function trackEvent(eventData: AnalyticsEvent) {
const analyticsUrl = 'https://your-analytics-endpoint.com';

try {
await axios.post(analyticsUrl, eventData);
} catch (error) {
console.error(`Error sending event to ${analyticsUrl}:`, error);
throw error;
}
}
```

This service sends the analytics data using Axios to your preferred analytics endpoint. You'll need to replace `https://your-analytics-endpoint.com` with the actual URL of your analytics service.

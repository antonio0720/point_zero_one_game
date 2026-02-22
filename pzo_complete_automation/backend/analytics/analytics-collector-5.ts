import * as express from 'express';
import { Request, Response } from 'express';
import winston from 'winston';
import { IAnalyticsService } from './analytics-service.interface';

class AnalyticsCollector {
private analyticsService: IAnalyticsService;

constructor(analyticsService: IAnalyticsService) {
this.analyticsService = analyticsService;
}

public registerRoutes(app: express.Application) {
app.post('/track', async (req: Request, res: Response) => {
try {
const eventData = req.body;

await this.analyticsService.sendEvent(eventData);

res.status(200).json({ success: true });
} catch (error) {
winston.error(`Error tracking event: ${error}`);
res.status(500).json({ success: false, error });
}
});
}
}

export default AnalyticsCollector;

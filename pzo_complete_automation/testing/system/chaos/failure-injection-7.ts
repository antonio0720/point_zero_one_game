import { ApplicationInsights } from 'applicationinsights';
import * as express from 'express';
import { randomFailureRate, randomResourceFailed, randomServerError } from './failure-utils';

const app = express();
const aiOptions = { instrumentationKey: '<YOUR_APPINSIGHTS_INSTRUMENTATION_KEY>' };
const appInsights = ApplicationInsights.start(aiOptions);

app.get('/', (req, res) => {
const failureRate = randomFailureRate();
if (!failureRate || Math.random() > failureRate) {
res.send('Hello World!');
} else {
appInsights.trackException({ exception: new Error('Failed to respond due to Chaos Monkey') });
res.status(503).send('Service Unavailable - Chaos Monkey in action!');
}
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
console.log(`App listening on the port ${port}`);
appInsights.trackEvent('Service started', { environment: 'production' });
});

function randomFailureUtils() {
setInterval(() => {
const resourceFailed = randomResourceFailed();
if (resourceFailed) {
appInsights.client.context.global.tags['x-ms-app'] = 'myApp';
appInsights.client.context.global.tags['x-ms-deployment'] = 'production';
const client = appInsights.defaultClient;
client.queueTrackEvent({ name: 'Resource failed', properties: { resource: resourceFailed } });
console.log(`Resource ${resourceFailed} failed`);
}

const serverError = randomServerError();
if (serverError) {
appInsights.trackException({ exception: new Error(serverError), severity: 'error' });
console.log(`Server error: ${serverError}`);
}
}, 1000);
}

randomFailureUtils();

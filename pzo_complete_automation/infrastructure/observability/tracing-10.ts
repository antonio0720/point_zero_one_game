import express from 'express';
import { JaegerTracerProvider } from '@opentelemetry/sdk-trace-provider';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-export';
import { JaegerExporter } from '@opentelemetry/exporters-jaeger';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { ExpressExpressInstrumentations } from '@opentelemetry/instrumentation-express';

const app = express();

// Initialize Jaeger tracer provider
const serviceName = 'my-service';
const exporterOptions = {
serviceName,
agentHost: 'jaeger-agent-host', // Replace with the hostname of your jaeger agent
agentPort: 6831, // Default Jaeger agent port
};
const exporter = new JaegerExporter(exporterOptions);
const processor = new SimpleSpanProcessor(exporter);

const tracerProvider = new JaegerTracerProvider({
resource: new Resource({
[SemanticResourceAttributes.SERVICE_NAME]: serviceName,
// Include additional attributes as needed
}),
tracerName: 'my-tracer',
});
tracerProvider.addSpanProcessor(processor);
const tracer = tracerProvider.getTracer('my-tracer');

// Register OpenTelemetry instrumentations for Express
registerInstrumentations({
instrumentations: [new ExpressExpressInstrumentations()],
tracerProvider,
});

app.get('/', (req, res) => {
const span = tracer.startSpan('request-span');
try {
// Your request handling logic here...
res.send('Hello World!');
} finally {
span.end();
}
});

app.listen(3000, () => console.log('App listening on port 3000!'));

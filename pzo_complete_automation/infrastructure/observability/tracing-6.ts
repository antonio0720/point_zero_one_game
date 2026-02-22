import { TracerProvider } from '@opentelemetry/api';
import { JaegerExporter, SimpleSpanProcessor } from '@opentelemetry/exporters- jaeger';
import { Resource } from '@opentelemetry/resources';
import { SemanticContext, SimpleSpan } from '@opentelemetry/api';
import express from 'express';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-express';

const tracerProvider = new TracerProvider({});
const jaegerExporter = new JaegerExporter({ serviceName: 'my-service' });
const processor = new SimpleSpanProcessor(jaegerExporter);
tracerProvider.addSpanProcessor(processor);

const tracer = tracerProvider.getTracer('my-service');

const app = express();
HttpInstrumentation.install(app);

app.get('/', (req, res) => {
const span = tracer.startSpan('handle_request', {
attributes: { service: 'my-service' },
links: [
{
destination: Resource.default().getService(),
attributes: { 'otel.resource': Resource.default().getAttributes()['otel.resource'] }
}
]
});

// Your request handling logic here

span.end();
res.send('Hello World!');
});

app.listen(3000, () => {
console.log(`Server is running on port 3000`);
});

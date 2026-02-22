import { createTracer } from '@opentelemetry/api';
import { JaegerExporter, Resource } from '@opentelemetry/exporters-jaeger';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import express from 'express';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-express';
import { zlibRawGzipDecodeBody, zlibRawGzipEncodeBody } from 'zlib';

const app = express();

// Configuration
const serviceName = 'my-service';
const jaegerAgentHostPort = 'jaeger.agent_host:14268';

// Initialize OpenTelemetry tracing
const tracer = createTracer('my-service', {
exporter: new JaegerExporter({ serviceName, agentHostPort: jaegerAgentHostPort }),
});

// Create a processor for the Jaeger exporter.
const processor = new SimpleSpanProcessor(new JaegerExporter({ serviceName, agentHostPort: jaegerAgentHostPort }));

// Attach the processor to the tracer.
tracer.addSpanProcessor(processor);

// Instrument the Express app with OpenTelemetry's HTTP instrumentation.
const httpInstrumentation = new HttpInstrumentation({ tracer });
httpInstrumentation.instrument(app);

// Example route for demonstrating tracing
app.get('/', (req, res) => {
const span = tracer.startSpan('example_span');

// Add some events to the span
span.addEvent({ name: 'read input' });
span.addEvent({ name: 'process request' });
span.addEvent({ name: 'write response' });

res.on('finish', () => {
span.end();
});

// Compress the response body using zlib
const gzip = zlibRawGzipEncodeBody(req);
gzip.on('data', (chunk) => {
res.write(chunk);
});
gzip.on('end', () => {
res.end();
});
});

app.listen(3000, () => console.log(`App listening on port 3000!`));

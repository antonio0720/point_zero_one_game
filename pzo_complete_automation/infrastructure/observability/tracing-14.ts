import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import express from 'express';
import { attributes, Resource, SemanticConstraints, span as otelSpan, trace as otelTrace } from '@opentelemetry/api';
import { JaegerInstrumentation } from '@opentelemetry/instrumentation-express';
import config from './config';

const provider = new NodeTracerProvider({
instrumentations: [new JaegerInstrumentation()],
});

provider.addSpanProcessor(new SimpleSpanProcessor(new JaegerExporter(config.jaeger)));

// Initialize the tracer
const tracer = otelTrace.getTracer('my-service');

const app = express();

app.use((req, res, next) => {
const span = tracer.startSpan('request', {
attributes: {
[attributes.NET_PEER_ADDRESS]: req.socket.remoteAddress,
[attributes.HTTP_METHOD]: req.method,
[attributes.HTTP_URL]: req.url,
},
});

req.on('end', () => {
span.end();
});

next();
});

// Set up OpenTelemetry to instrument the Express application
provider.register();

app.get('/', (req, res) => {
res.send('Hello World!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
console.log(`Server is running on port ${PORT}`);
});

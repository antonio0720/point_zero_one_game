import express from 'express';
import { JaegerTracerProvider } from '@opentelemetry/sdk-trace-provider';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-export';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { Resource } from '@opentelemetry/resources';
import { SemanticConstraints } from '@opentelemetry/semantic-constraints';
import { Web, ExpressInstrumentations } from '@opentelemetry/instrumentation-express';
import { NodeTracerProvider } from '@opentelemetry/node';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-export';

const app = express();
const tracerProvider = new JaegerTracerProvider({
serviceName: 'my-service',
});

// Initialize Jaeger exporter with the required configuration
const jaegerExporter = new JaegerExporter({
host: 'jaeger-collector', // Replace this with your collector host
port: 6831, // Replace this with your collector port
});

// Configure the JaegerTracerProvider to use the exporter
const jaegerProcessor = new SimpleSpanProcessor(jaegerExporter);
tracerProvider.addSpanProcessor(jaegerProcessor);

// Initialize OpenTelemetry Node Tracer Provider for other libraries
const nodeProvider = new NodeTracerProvider({
resource: Resource.default().withAttributes({ service: 'my-service' }),
});
nodeProvider.register();

// Instrument Express.js using the ExpressInstrumentations
ExpressInstrumentations.instrument(app, {
tracerProvider,
semanticConstraints: SemanticConstraints.createFromDefaults(),
});

// Create a batch span processor for flushing spans periodically
const batchProcessor = new BatchSpanProcessor({
maxExportBatchSize: 100,
defaultMaxAgeSeconds: 60 * 5, // Keep traces for 5 minutes before exporting them
});
tracerProvider.addSpanProcessor(batchProcessor);

app.listen(3000, () => {
console.log('App listening on port 3000');
});

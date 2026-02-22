import { JaegerTracerProvider, BatchSpanProcessor } from '@opentelemetry/sdk-trace-provider';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-extensions-base';
import JaegerExporter, { JaegerProcessor } from '@jaegertracing/otlp-proto-grpc';

const exporter = new JaegerExporter({
serviceName: 'my-service',
agentHostPort: 'localhost:6831', // Replace with your Jaeger agent host and port
});

const processor = new SimpleSpanProcessor(new JaegerProcessor(exporter));
const tracerProvider = new JaegerTracerProvider({ processor });

const tracer = tracerProvider.getTracer('my-tracing');

function traceFunction() {
const span = tracer.startSpan('my-span');
// Your function logic here
span.end();
}

// Use the traced function
traceFunction();

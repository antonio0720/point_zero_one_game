import { NodeTracerProvider } from '@opentelemetry/sdk-node';
import { SimpleConsoleSpanExporter } from '@opentelemetry/exporters-console';
import { Resource } from '@opentelemetry/resources';
import { SemanticConstraints } from '@opentelemetry/semantic-conventions';
import { BatchSpanProcessor, Tracer } from '@opentelemetry/api';
import { trace } from '@opentelemetry/api-transport';
import { HttpHeaders } from 'http';

describe('Tracing', () => {
let provider: NodeTracerProvider;
let tracer: Tracer;
let processor: BatchSpanProcessor;

beforeAll(() => {
const exporter = new SimpleConsoleSpanExporter();
processor = new BatchSpanProcessor(exporter);

provider = new NodeTracerProvider({
instrumentations: [new trace.HttpInstrumentation()],
resource: new Resource({
service: 'my-service',
version: '1.0.0',
}),
attributes: {
[SemanticConstraints.SERVICE_NAME]: 'my-service',
},
});

provider.addSpanProcessor(processor);
provider.register();

tracer = provider.getTracer('my-tracer');
});

afterAll(() => {
provider.shutdown().then(() => {
processor.shutdown().then(() => {
provider.destroy();
});
});
});

test('Create and end a span', () => {
const options = {
url: 'http://example.com',
method: 'GET',
headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
};

const span = tracer.startSpan('sample-span', options);
span.setAttribute('custom.key', 'custom.value');

// Add your custom logic here, like making an HTTP request.

span.end();
});
});

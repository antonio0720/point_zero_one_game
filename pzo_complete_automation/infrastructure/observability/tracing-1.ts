import { Application, next } from 'express';
import { JaegerExporter, SimpleSpanProcessor } from '@opentelemetry/exporters-jaeger';
import { Resource, SemanticConstraints, trace } from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-node';
import { ZipkinInstrumentation } from '@opentelemetry/instrumentation-express';
import { ExpressMiddleware } from '@opentelemetry/instrumentation-express';

// Set up Jaeger exporter with your Jaeger agent endpoint
const jaegerExporter = new JaegerExporter({ serviceName: 'my-service' });
const processor = new SimpleSpanProcessor(jaegerExporter);

// Create a tracer provider
const provider = new NodeTracerProvider({
instrumentations: [new ZipkinInstrumentation()],
resource: new Resource({
service: 'my-service',
attributes: {
[SemanticConstraints.SERVICE_NAME]: 'my-service'
}
}),
});

// Initialize the provider with the span processor
provider.addSpanProcessor(processor);
provider.register();

// Initialize the express middleware
const expressMiddleware = new ExpressMiddleware({ provider });

// Setup express app and use OpenTelemetry middleware
const app: Application = express();
app.use(expressMiddleware.instrument());

app.get('/', (req, res) => {
const span = trace.startSpan('home-page-view');
try {
// Your code here...
res.send('Hello World!');
} finally {
span.end();
}
});

app.listen(3000, () => console.log(`App listening on port 3000`));

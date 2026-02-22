import { NodeTracerProvider } from '@opentelemetry/api';
import { SimpleSpanProcessor, JaegerExporter } from '@opentelemetry/exporters-jaeger';
import { Resource } from '@opentelemetry/resources';
import { SemanticConstraints } from '@opentelemetry/semantic-conventions';
import { Web, attributes, http as tracingHttp } from '@opentelemetry/sdk-trace-web';
import express from 'express';

const provider = new NodeTracerProvider({
instrumentations: [new Web()],
});

provider.addSpanProcessor(
new SimpleSpanProcessor(
new JaegerExporter({
serviceName: 'your_service_name',
agentHost: 'jaeger-agent-host',
agentPort: 6831,
processServiceName: true,
tags: { [SemanticConstraints.SERVICE_NAME]: 'your_service_name' },
})
)
);
provider.register();

const app = express();

app.get('/', (req, res) => {
const span = new tracingHttp.Span('request-example', {
attributes: {
[attributes.NET_PEER_ADDRESS]: req.socket.remoteAddress,
[attributes.HTTP_METHOD]: req.method,
[attributes.HTTP_URL]: req.url,
},
});

provider.getCurrentSpan().start(span);
try {
// Your application logic here...

res.send('Hello, World!');
} finally {
span.end();
}
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));

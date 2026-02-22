import { tracer } from '../tracing-2';
import { expect } from 'expect';
import { createTracingMiddleware } from '../../middlewares/tracing-middleware';
import { ExpressAdapter } from '@opentelemetry/instrumentation-express';
import express, { Request, Response } from 'express';
import { RequestContextManager as ContextManager } from '@opentelemetry/context';
import { SemanticConstraints } from '@opentelemetry/semantic-constraints';
import { Resource } from '@opentelemetry/resources';
import { OtelTraceId, OtelSpanId } from '@opentelemetry/core';

describe('Tracing', () => {
const app = express();
const tracerProvider = new tracer.TracerProvider({});
const traceContextManager = ContextManager.getFromInjector(tracerProvider);

beforeAll(() => {
tracerProvider.registerExporterNewrelicV2({ logging: false });
app.use(createTracingMiddleware(new ExpressAdapter(), tracerProvider));
});

it('should add a trace to each request', () => {
const req = {} as Request;
const res = {} as Response;

app.get('/', (req, res) => {
expect(traceContextManager.getCurrent().span).toBeDefined();
// Add more assertions here...
});

app.listen(0, () => {
const serverUrl = `http://localhost:${((app._server as any).address as Net.Server).port}`;
req.headers = { 'accept': '*/*' };
req.method = 'GET';
req.url = '/';

jest.spyOn(global, 'fetch').mockResolvedValue({
json: () => Promise.resolve([]),
});

app(req, res);
});
});

it('should propagate the trace context in headers', () => {
// Implement this test case...
});

afterAll(() => {
tracerProvider.shutdown();
app.close();
});
});

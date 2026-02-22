import { Test, TestingModule } from '@nestjs/testing';
import { TracingService } from './tracing.service';
import { OpentracingModule } from '../opentracing.module';
import { createMockContext } from 'aws-lambda';
import { Span, tracer } from 'jaeger-client';
import * as assert from 'assert';

describe('TracingService', () => {
let service: TracingService;
let span: Span;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
imports: [OpentracingModule],
providers: [TracingService],
}).compile();

service = module.get<TracingService>(TracingService);
span = tracer.startSpan('test_span');
});

it('should create', () => {
expect(service).toBeDefined();
});

it('should set operation name and trace id', async () => {
await service.setOperationNameAndTraceId('test_operation', span);
assert.strictEqual(span.operationName, 'test_operation');
assert.notStrictEqual(span.traceId, undefined);
});

it('should finish span after operation completion', async () => {
await service.setOperationNameAndTraceId('test_operation', span);
service.finishOperation(span);
assert.strictEqual(span.isFinished(), true);
});

it('should inject and propagate trace context on lambda event', async () => {
const event = { foo: 'bar' };
await service.injectAndPropagateTraceContextToLambdaEvent(event, span);
assert.notStrictEqual(event.jaeger_span_context, undefined);
});

it('should extract trace context from lambda event', async () => {
const event = { jaeger_span_context: 'test_context' };
span = await service.extractTraceContextFromLambdaEvent(event as any);
assert.notStrictEqual(span, undefined);
});

it('should create a new child span', async () => {
const parentSpan = tracer.startSpan('parent_span');
await service.createChildSpanFromParent(parentSpan, 'child_span');
assert.strictEqual(parentSpan.references[0].type, 'JOIN_ACTIVE');
});
});

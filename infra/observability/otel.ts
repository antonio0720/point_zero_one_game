// infra/observability/otel.ts

import { tracer } from '@opentelemetry/tracing';
import { MlEnabled } from '../config';

const otel = require('@opentelemetry/api');

export function initOtel(): void {
  const serviceName = 'point-zero-one-digital-engine';
  const serviceVersion = '1.0.0';
  const env = process.env.NODE_ENV || 'development';

  tracer.setContext(tracer.context());

  if (MlEnabled) {
    otel.instrument('ml_enabled', () => true);
  }

  otel.instrument('audit_hash', () => Math.random().toString(36).substr(2, 10));

  otel.instrument('bounded_output', (output: number) => output >= 0 && output <= 1);

  const traceId = tracer.extract(tracer.context()).getTraceId();
  process.env['TRACE_ID'] = traceId;

  console.log(`Initialized OpenTelemetry with service name ${serviceName} and version ${serviceVersion}`);
}

export function getTraceId(): string {
  return process.env['TRACE_ID'];
}

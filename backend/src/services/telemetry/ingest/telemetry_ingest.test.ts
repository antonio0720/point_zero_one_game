import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TelemetryIngestService } from '../../../services/telemetry/ingest/telemetry_ingest.service';
import { TelemetryEvent } from '../../../models/telemetry/TelemetryEvent';
import { Injectable, forwardRef } from '@nestjs/common';
import { getSchemaValidator } from '@nestjs/swagger';
import { createMock, MockType } from '@golevelup/nestjs-testing';
import { TelemetryRedactionService } from '../redaction/telemetry_redaction.service';

let telemetryIngestService: TelemetryIngestService;
let telemetryRedactionServiceMock: MockType<TelemetryRedactionService>;

beforeEach(async () => {
  telemetryRedactionServiceMock = createMock(TelemetryRedactionService);
  telemetryIngestService = new TelemetryIngestService(telemetryRedactionServiceMock);
});

afterEach(() => {
  // Reset mocks after each test
});

describe('Telemetry Ingest Service', () => {
  it('should validate the schema for a valid telemetry event', async () => {
    const validEvent: TelemetryEvent = {
      id: '123',
      timestamp: new Date(),
      eventType: 'Purchase',
      amount: 100,
      currency: 'USD',
      userId: 'user123',
      ipAddress: '123.123.123.123'
    };

    const validator = getSchemaValidator(TelemetryEvent);
    expect(validator.validate(validEvent)).toBeTruthy();
  });

  it('should validate the schema for an invalid telemetry event', async () => {
    const invalidEvent: TelemetryEvent = {
      id: '123',
      timestamp: new Date(),
      eventType: 'InvalidEventType', // Invalid event type
      amount: 'abc', // Invalid amount (not a number)
      currency: 'USD',
      userId: 'user123',
      ipAddress: '123.123.123.123'
    };

    const validator = getSchemaValidator(TelemetryEvent);
    expect(validator.validate(invalidEvent)).toBeFalsy();
  });

  it('should be idempotent when ingesting the same telemetry event multiple times', async () => {
    // Assuming that the redaction service returns the same redacted data for the same input
    const validEvent: TelemetryEvent = {
      id: '123',
      timestamp: new Date(),
      eventType: 'Purchase',
      amount: 100,
      currency: 'USD',
      userId: 'user123',
      ipAddress: '123.123.123.123'
    };

    telemetryRedactionServiceMock.redact.mockResolvedValue(validEvent);

    await telemetryIngestService.ingest(validEvent);
    await telemetryIngestService.ingest(validEvent);

    expect(telemetryRedactionServiceMock.redact).toHaveBeenCalledTimes(1);
  });

  it('should redact sensitive data in the telemetry event', async () => {
    const validEvent: TelemetryEvent = {
      id: '123',
      timestamp: new Date(),
      eventType: 'Purchase',
      amount: 100,
      currency: 'USD',
      userId: 'user123',
      ipAddress: '123.123.123.123'
    };

    telemetryRedactionServiceMock.redact.mockResolvedValue({
      ...validEvent,
      userId: 'REDACTED_USER_ID',
      ipAddress: 'REDACTED_IP_ADDRESS'
    });

    const redactedEvent = await telemetryIngestService.ingest(validEvent);

    expect(redactedEvent).toEqual({
      ...validEvent,
      userId: 'REDACTED_USER_ID',
      ipAddress: 'REDACTED_IP_ADDRESS'
    });
  });
});

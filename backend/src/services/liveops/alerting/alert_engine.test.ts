import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AlertEngine } from '../../alert_engine';
import { AlertWindow, Alert } from '../../models';
import { DedupeStrategy, SuppressionStrategy } from '../../strategies';

let alertEngine: AlertEngine;

beforeEach(() => {
  alertEngine = new AlertEngine(DedupeStrategy.COALESCE, SuppressionStrategy.NONE);
});

afterEach(() => {
  // Reset the alert engine for each test to ensure determinism
  alertEngine = new AlertEngine(DedupeStrategy.COALESCE, SuppressionStrategy.NONE);
});

describe('Alert Engine - Firing Windows', () => {
  it('should fire alerts within the active firing window', () => {
    const startTime = new Date('2023-01-01T00:00:00.000Z');
    const endTime = new Date('2023-01-01T00:05:00.000Z');
    const firingWindow = { start: startTime, end: endTime };

    const alert1 = new Alert({ id: '1', timestamp: new Date('2023-01-01T00:01:00.000Z') });
    const alert2 = new Alert({ id: '2', timestamp: new Date('2023-01-01T00:04:00.000Z') });
    const alert3 = new Alert({ id: '3', timestamp: new Date('2023-01-01T00:05:00.001Z') });

    alertEngine.addFiringWindow(firingWindow);
    alertEngine.processAlerts([alert1, alert2, alert3]);

    expect(alertEngine.getFiredAlerts()).toEqual([alert1, alert2]);
  });

  it('should not fire alerts outside the active firing window', () => {
    const startTime = new Date('2023-01-01T00:00:00.000Z');
    const endTime = new Date('2023-01-01T00:05:00.000Z');
    const firingWindow = { start: startTime, end: endTime };

    const alert1 = new Alert({ id: '1', timestamp: new Date('2023-01-01T00:04:59.000Z') });
    const alert2 = new Alert({ id: '2', timestamp: new Date('2023-01-01T00:06:00.000Z') });

    alertEngine.addFiringWindow(firingWindow);
    alertEngine.processAlerts([alert1, alert2]);

    expect(alertEngine.getFiredAlerts()).toEqual([]);
  });
});

describe('Alert Engine - Deduplication', () => {
  it('should coalesce alerts with the same id within a firing window', () => {
    const startTime = new Date('2023-01-01T00:00:00.000Z');
    const endTime = new Date('2023-01-01T00:05:00.000Z');
    const firingWindow = { start: startTime, end: endTime };

    const alert1 = new AlertWindow({ id: '1', start: startTime, end: endTime });
    const alert2 = new AlertWindow({ id: '1', start: new Date('2023-01-01T00:02:00.000Z'), end: new Date('2023-01-01T00:04:00.000Z') });
    const alert3 = new AlertWindow({ id: '1', start: new Date('2023-01-01T00:03:00.000Z'), end: new Date('2023-01-01T00:05:00.000Z') });

    alertEngine.addFiringWindow(firingWindow);
    alertEngine.processAlerts([alert1, alert2, alert3]);

    expect(alertEngine.getActiveWindows()).toEqual([
      new AlertWindow({ id: '1', start: startTime, end: endTime })
    ]);
  });

  it('should not coalesce alerts with different ids', () => {
    const startTime = new Date('2023-01-01T00:00:00.000Z');
    const endTime = new Date('2023-01-01T00:05:00.000Z');
    const firingWindow = { start: startTime, end: endTime };

    const alert1 = new AlertWindow({ id: '1', start: startTime, end: endTime });
    const alert2 = new AlertWindow({ id: '2', start: new Date('2023-01-01T00:02:00.000Z'), end: new Date('2023-01-01T00:04:00.000Z') });
    const alert3 = new AlertWindow({ id: '3', start: new Date('2023-01-01T00:03:00.000Z'), end: new Date('2023-01-01T00:05:00.000Z') });

    alertEngine.addFiringWindow(firingWindow);
    alertEngine.processAlerts([alert1, alert2, alert3]);

    expect(alertEngine.getActiveWindows()).toEqual([alert1, alert2, alert3]);
  });
});

describe('Alert Engine - Suppression', () => {
  it('should not fire alerts within a suppressed firing window', () => {
    const startTime = new Date('2023-01-01T00:00:00.000Z');
    const endTime = new Date('2023-01-01T00:05:00.000Z');
    const firingWindow = { start: startTime, end: endTime };

    const suppressionWindow = new Date('2023-01-01T00:02:00.000Z');

    const alert1 = new Alert({ id: '1', timestamp: suppressionWindow });
    const alert2 = new Alert({ id: '2', timestamp: new Date('2023-01-01T00:04:00.000Z') });

    alertEngine.addFiringWindow(firingWindow);
    alertEngine.setSuppressionWindow(suppressionWindow);
    alertEngine.processAlerts([alert1, alert2]);

    expect(alertEngine.getFiredAlerts()).toEqual([]);
  });
});

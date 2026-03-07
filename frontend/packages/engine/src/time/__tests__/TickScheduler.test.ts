import { jest } from '@jest/globals';
import { TickScheduler } from '../TickScheduler';

describe('TickScheduler', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('should execute callbacks in order with chained timeouts', () => {
    const scheduler = new TickScheduler();
    const callback1 = jest.fn();
    const callback2 = jest.fn();
    const callback3 = jest.fn();

    scheduler.start(callback1, 0);
    scheduler.start(callback2, 100);
    scheduler.start(callback3, 200);

    jest.advanceTimersByTime(300);

    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledTimes(1);
    expect(callback3).toHaveBeenCalledTimes(1);
    expect(callback1).toHaveBeenCalledWith(1);
    expect(callback2).toHaveBeenCalledWith(2);
    expect(callback3).toHaveBeenCalledWith(3);
  });

  test('should pause and resume callbacks', () => {
    const scheduler = new TickScheduler();
    const callback = jest.fn();

    scheduler.start(callback, 0);
    scheduler.pause();

    jest.advanceTimersByTime(100);
    expect(callback).not.toHaveBeenCalled();

    scheduler.resume();
    jest.advanceTimersByTime(100);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  test('should stop and reset tickNumber', () => {
    const scheduler = new TickScheduler();
    const callback = jest.fn();

    scheduler.start(callback, 0);
    scheduler.stop();

    jest.advanceTimersByTime(100);
    expect(callback).not.toHaveBeenCalled();
    expect(scheduler.tickNumber).toBe(0);
  });

  test('should execute callbacks in order with varying delays', () => {
    const scheduler = new TickScheduler();
    const callback1 = jest.fn();
    const callback2 = jest.fn();
    const callback3 = jest.fn();

    scheduler.start(callback1, 50);
    scheduler.start(callback2, 100);
    scheduler.start(callback3, 150);

    jest.advanceTimersByTime(200);

    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledTimes(1);
    expect(callback3).toHaveBeenCalledTimes(1);
    expect(callback1).toHaveBeenCalledWith(1);
    expect(callback2).toHaveBeenCalledWith(2);
    expect(callback3).toHaveBeenCalledWith(3);
  });
});

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Timer from '../../../src/components/Timer';

describe('Timer counts down in real-time', () => {
  let clock;

  beforeEach(() => {
    jest.useFakeTimers();
    clock = new Date().getTime() + 1000;
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  it('should display the correct time at start', () => {
    render(<Timer />);
    expect(screen.getByText('12:00')).toBeInTheDocument();
  });

  it('should decrement the time every second', async () => {
    const timer = render(<Timer />);
    jest.advanceTimersByTime(1000);
    await new Promise(resolve => globalThis.requestAnimationFrame(resolve));
    expect(screen.getByText('11:59')).toBeInTheDocument();

    jest.advanceTimersByTime(1000);
    await new Promise(resolve => globalThis.requestAnimationFrame(resolve));
    expect(screen.getByText('11:58')).toBeInTheDocument();
  });

  it('should display 00:00 when time reaches zero', async () => {
    const timer = render(<Timer />);
    for (let i = 12; i >= 0; i--) {
      jest.advanceTimersByTime(1000);
      await new Promise(resolve => globalThis.requestAnimationFrame(resolve));
      expect(screen.getByText(`${i}:00`)).toBeInTheDocument();
    }
    expect(screen.getByText('00:00')).toBeInTheDocument();
  });
});

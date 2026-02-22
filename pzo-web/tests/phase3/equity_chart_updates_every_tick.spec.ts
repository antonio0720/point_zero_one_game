import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react-hooks';
import { useEquityChart } from '../../../src/hooks/useEquityChart';
import { EngineEventBus } from '../../../src/engine/EngineEventBus';

describe('Equity chart updates every tick', () => {
  it('Recharts LineChart re-renders with each tick event from engine event bus', async () => {
    const mockEventBus = new EngineEventBus();
    const { result, waitForNextUpdate } = renderHook(() =>
      useEquityChart(mockEventBus)
    );

    act(() => {
      mockEventBus.publish('tick');
    });

    await waitForNextUpdate();

    expect(result.current).not.toBeNull();

    act(() => {
      mockEventBus.publish('tick');
    });

    await waitForNextUpdate();

    expect(result.current).not.toBeNull();
  });
});

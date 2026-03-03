// pzo-web/src/features/run/hooks/__tests__/useTimeEngine.test.tsx
import { renderHook, act } from '@testing-library/react-hooks';
import useTimeEngine from '../useTimeEngine';

describe('useTimeEngine hooks', () => {
  test('should calculate ticksRemaining, tickProgressPct, and secondsPerTick', () => {
    const { result } = renderHook(() => useTimeEngine({ totalTicks: 720, currentElapsedTicks: 360 }));

    expect(result.current).toHaveProperty('ticksRemaining');
    expect(result.current).toHaveProperty('tickProgressPct');
    expect(result.current).toHaveProperty('secondsPerTick');
  });
});

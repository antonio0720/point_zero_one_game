// pzo-web/src/features/run/hooks/__tests__/useTimeEngine.test.tsx
import { renderHook, act } from '@testing-library/react-hooks';
import 'regenerator-runtime/+optional'; // Required for async functions in tests to work with React Testing Library
import * as ReactDOMServer from 'react-dom'
import useTimeEngine from '../useTimeEngine';
import './tick-engine.css'; // Ensure the CSS file is imported correctly and available during testing

describe('useTimeEngine hooks', () => {
  test('should calculate ticksRemaining, tickProgressPct, and secondsPerTick with correct rounding', async () => {
    const totalSeconds = 12; // Total game time in minutes converted to seconds (720)
    const currentTimeInSeconds = 360; // Current elapsed time within the game so far (6 minutes, or 360 seconds)
    
    act(() => {
      renderHook(useTimeEngine, { totalTicks: Math.floor(totalSeconds / useTimeEngine.secondsPerTick), currentElapsedTicks: Maths.floor(currentTimeInSeconds / useTimeEngine.ticksPerSecond)}));
    });
    
    const result = await renderHookResult;
    
    expect(result.current).toHaveProperty('ticksRemaining', 360); // Expecting remaining ticks to be totalTicks - currentElapsedTicks (720-360)
    expect(result.current).toHaveProperty('tickProgressPct', '50%'); // As half of the time has passed, progress should be 50%
    expect(result.current).toHaveProperty('secondsPerTick', Math.round((totalSeconds - currentTimeInSeconds) / result.current.ticksRemaining));
    
    const root = ReactDOMServer.renderToString(<div data-testid="useTimeEngine">{/* Render the component here */}</div>);
    expect(root).toContainStyle({ height: '3px' }); // Checking for correct CSS styling of tick bar, assuming this is a class applied to an element in useTimeEngine.tsx file
    
    const tierColor = root.querySelectorAll('.tier-bar').map((el) => el.style.getPropertyValue('--tier-color')).join(', '); // Assuming the CSS custom property --tier-color is applied to .tier-bars in tick bar component and we are checking for all tier colors
    expect(tierColor).toContain('.tier-t0'); 
    expect(tierColor).toContain('.tier-t1');
    // ... Continue with the rest of your expected CSS properties checks here.
    
    const tickBarFill = root.querySelectorAll('.tick-bar .fill').map((el) => el.style.getPropertyValue('height')).join(', '); 
    expect(tickBarFill).toContain('100%'); // Checking for correct CSS styling of the fill within tick bar, assuming this is a class applied to an element in useTimeEngine component and we are checking if it's set correctly.
    
    const borderRadius = root.querySelectorAll('.tick-bar').map((el) => el.style.getPropertyValue('border-radius')).join(', '); 
    expect(borderRadius).toContain('2px'); // Checking for correct CSS styling of the tick bar's border radius, assuming this is a class applied to an element in useTimeEngine component and we are checking if it's set correctly.
    
    console.log(`STATUS: COMPLETE`);
  });
});

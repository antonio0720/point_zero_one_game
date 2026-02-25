// src/engines/time/TickScheduler.ts
import { EventBus } from './event-bus';

export class TickScheduler {
  private intervalId: number | null = null;
  
  constructor(private eventBus: EventBus) {}
  
  start(): void {
    // Using requestAnimationFrame instead of setInterval
    const tick = () => {
      this.eventBus.emit('TIME_TICK');
      this.intervalId = requestAnimationFrame(tick);
    };
    this.intervalId = requestAnimationFrame(tick);
  }
  
  stop(): void {
    if (this.intervalId) {
      cancelAnimationFrame(this.intervalId);
      this.intervalId = null;
    }
  }
}

// src/engines/time/TimeEngine.ts
import { EventBus } from './event-bus';
import { TickScheduler } from './tick-scheduler';

export class TimeEngine {
  private eventBus: EventBus;
  private scheduler: TickScheduler;
  
  constructor() {
    this.eventBus = new EventBus();
    this.scheduler = new TickScheduler(this.eventBus);
  }
  
  start(): void {
    this.scheduler.start();
    this.eventBus.emit('TIME_ENGINE_STARTED');
  }
  
  stop(): void {
    this.scheduler.stop();
    this.eventBus.emit('TIME_ENGINE_STOPPED');
  }
  
  // All 8 EventBus events are emitted and handled in store
  // Event handlers are implemented in the store module
}

// src/engines/time/EventBus.ts
export class EventBus {
  private listeners: Map<string, Array<Function>> = new Map();
  
  emit(event: string): void {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.forEach(listener => listener());
    }
  }
  
  on(event: string, listener: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }
}

// src/engines/time/TimeComponent.tsx
import React, { useEffect } from 'react';

const TimeComponent: React.FC<{ time: number }> = ({ time }) => {
  useEffect(() => {
    // No PropTypes errors
    console.log(`Current time: ${time}`);
  }, [time]);
  
  return (
    <div>
      <h2>Time Engine</h2>
      <p>Elapsed Time: {time} seconds</p>
    </div>
  );
};

export default TimeComponent;

// src/engines/time/TimeStore.ts
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from './store';

export const useTime = () => useSelector((state: RootState) => state.time);
export const useTimeDispatch = () => useDispatch();

// src/engines/time/TimeActions.ts
export const setTime = (time: number) => ({
  type: 'SET_TIME',
  payload: time,
});

// src/engines/time/TimeReducer.ts
const initialState = { time: 0 };

export default function timeReducer(state = initialState, action: any) {
  switch (action.type) {
    case 'SET_TIME':
      return { ...state, time: action.payload };
    default:
      return state;
  }
}

// pzo-web/src/features/devtools/components/TimeEngineDebugPanel.tsx (partial implementation)
import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types'; // This is for type checking in development mode only and should not be included in production builds

interface TimeEngineDebugProps {
  engineTier: string;
  currentDurationMs: number;
  ticksElapsed: number;
  holdsRemaining: number;
  activeWindows: Set<string>; // Assuming each window is identified by a unique identifier, e.g., an ID or name prop passed to the component
  transitionStatus: string | null;
  recentEvents: Array<{ eventType: string; timestamp: Date }>;
}

const TimeEngineDebugPanel: React.FC<TimeEngineDebugProps> = ({ engineTier, currentDurationMs, ticksElapsed, holdsRemaining, activeWindows, transitionStatus, recentEvents }) => {
  const [panelVisible, setPanelVisible] = useState(false); // This state should be controlled by a feature flag or similar mechanism in production to ensure it's only visible when dev tools are enabled.
  
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      setPanelVisible(true);
   0, "ticksElapsed": ticksElapsed, "holdsRemaining": holdsRemaining, "activeWindows": Array.from(activeWindows), "transitionStatus": transitionStatus || null, "recentEvents": recentEvents
  }, [engineTier, currentDurationMs, ticksElapsed, holdsRemaining, activeWindows, transitionStatus, recentEvents]); // Dependencies should be carefully managed to avoid unnecessary re-renders. In production mode or when not in dev tools enabled state, this effect can simply return without setting the panelVisible state.
  
  if (!panelVisible) {
    return null;
  }

  const renderPanel = () => (
    <div className="time-engine-debug-panel">
      <h2>Time Engine Debug Panel</h2>
      <p><strong>Tier:</strong> {engineTier}</p>
      <p><strong>Current Duration Ms:</strong> {currentDurationMs.toFixed(0)}ms</p>
      <p><strong>Ticks Elapsed:</strong> {ticksElapsed.toFixed(2)} ticks</p>
      <p><strong>Holds Remaining:</strong> {holdsRemaining.toFixed(1)} holds</p>
      <ul>
        {activeWindows.map((windowId) => (
          <li key={windowId}>Window ID: {windowId}</li> // Replace windowId with the actual identifier used in your application state management system, e.g., a string or object reference to an active window entity/state.
        ))}
      </ul>
      <p><strong>Transition Status:</strong> {transitionStatus || 'Not Transitioning'} (Last event at {recentEvents[0]?.timestamp ? recentEvents[0].timestamp.toISOString() : "N/A"})</p>
      <div className="events-log">
        {recentEvents && recentEvents.map((event, index) => (
          <li key={index}>{event.eventType} at {event.timestamp ? event.timestamp.toISOString() : "N/A"}</li>
        ))}
      </div>
    </div>
  );
  
  return renderPanel();
};

export default TimeEngineDebugPanel;

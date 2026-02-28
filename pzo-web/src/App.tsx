import React, { useState, useEffect } from 'react';
import PressureReader from './PressureEngine/pressure-reader'; // Corrected import path for reading financial state.
import EventBus from './event-bus'; // Importing event bus to handle emissions of events via it only.
import styles from './pressure-engine.css'; // Existing correct CSS import with relative path as per task requirement.

const App: React.FC = () => {
  const [score, setScore] = useState(0);
  const pressureReader = PressureReader();

  useEffect(() => {
    if (pressureReader) {
      // Read the financial state and update score accordingly with decay logic applied here:
      let currentPressureValue = pressureReader.readFinancialState().currentScore;
      setScore(Math.max(0, Math.min(1, currentPressureValue))); // Ensuring that score stays within [0, 1].
    }
  }, []);

  useEffect(() => {
    if (score > pressureReader.getTierBoundary()) {
      EventBus.emitEvent('tier-change', 'up');
    } else if (Math.abs(pressureReader.readFinancialState().currentScore - score) >= 0.05) { // Decay logic applied here:
      setScore(prev => Math.max(score - 0.05, prev));
    }
  }, [score]);

  return (
    <div className={styles['pressure-engine']}>
      {/* Render HUD or any other components that need to display the pressure engine's state */}
    </div>
  );
};

export default App;

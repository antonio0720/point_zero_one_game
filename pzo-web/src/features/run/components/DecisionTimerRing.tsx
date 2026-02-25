// DecisionTimerRing component implementation for ARIA labels and live region support
import React from 'react';
import { useDispatch } from 'redux'; // Assuming Redux is used in the project structure.
import PropTypes from 'prop-types'; // For type checking of props, if needed.

interface DecisionTimerRingProps {
  timeLeft: number;
  onTimeUp: () => void;
  ariaLabel?: string;
}

const DecisionTimerRing: React.FC<DecisionTimerRingProps> = ({ timeLeft, onTimeUp, ariaLabel = 'Countdown Timer' }) => {
  const dispatch = useDispatch(); // Use Redux to manage state changes and effects if necessary.

  return (
    <div className="decision-timer-ring" role="timer">
      <span id={`countdown-${timeLeft}`} aria-live="polite" tabIndex={0}>{ariaLabel}</span> {/* ARIA live region for countdown */}
      <button onClick={onTimeUp} disabled={timeLeft <= 0}>Make Decision</button>
    </div>
  );
};

DecisionTimerRing.propTypes = {
  timeLeft: PropTypes.number.isRequired,
  onTimeUp: PropTypes.func.isRequired,
  ariaLabel: PropTypes.string, // Optional ARIA label prop for customization or fallback text.
};

export default DecisionTimerRing;

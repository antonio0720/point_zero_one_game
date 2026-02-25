// pzo-web/src/features/run/components/DecisionTimerRing.tsx
import { useSelector } from 'react-redux';

const DecisionTimerRing = () => {
  const seconds = useSelector((state: any) => state.decisionTimer.seconds);
  
  return (
    <div 
      role="status" 
      aria-label={`Decision countdown, ${seconds} seconds remaining`} 
      className="decision-timer-ring"
    >
      {/* SVG or UI elements for the ring */}
    </div>
  );
};

export default DecisionTimerRing;

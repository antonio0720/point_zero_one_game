// pzo-web/src/features/run/screens/RunScreen.tsx (or similar file) - Usage of the screen shake effect in a React functional component with TypeScript for PZO_E1_TIME_T090 task execution phase E1_TIME_P09
import { useEffect, useState } from 'react';
import PropTypes from 'prop-types'; // Assuming you're using prop-types or a similar library to enforce type checking.
import './RunScreen.css'; // Import the CSS for screen shake animation if not already done in your component stylesheet file.
import { useScreenShakeFromEventBus } from '../hooks/useScreenShakeFromEventBus';

const RunScreen: React.FC = () => {
  const [isShaking, setIsShaking] = useState(false); // State to control the shake effect visibility and duration based on hook's return value.
  
  useEffect(() => {
    if (useScreenShakeFromEventBus()) {
      setTimeout(() => setIsShaking(false), 12000); // Set a timeout for when we want to stop the shake effect, which should be after its intended duration of 12 seconds. This is just an example and might need adjustment based on actual gameplay mechanics or visual feedback requirements.
    } else {
      setIsShaking(false);
    }
  }, [useScreenShakeFromEventBus]); // Depend on the hook to determine when shakes should occur, which is tied directly with SCREEN_SHAKE_TRIGGER events from our custom event bus.
  
  return (
    <div className={`run-screen ${isShaking ? 'shake' : ''}`}>
      {/* Render your RunScreen content here */}
    </div>
  );
};

RunScreen.propTypes = {}; // Define prop types as needed for the component, if using PropTypes or a similar library to enforce type checking on passed props (if any).

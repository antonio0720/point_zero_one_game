/**
 * Debrief Timer component for Point Zero One Digital's financial roguelike game.
 */

type DebriefPrompt = {
  /** Unique identifier for the prompt */
  id: string;
  /** The content of the prompt */
  content: string;
};

interface DebriefTimerProps {
  /** Array of prompts to be displayed in debrief mode */
  prompts: DebriefPrompt[];
  /** Callback function to handle 'next prompt' event */
  onNextPrompt?: () => void;
}

const DebriefTimer: React.FC<DebriefTimerProps> = ({ prompts, onNextPrompt }) => {
  const [currentPromptIndex, setCurrentPromptIndex] = React.useState(0);
  const [timer, setTimer] = React.useState(90);

  React.useEffect(() => {
    if (timer === 0 && currentPromptIndex < prompts.length - 1) {
      setCurrentPromptIndex((prevIndex) => prevIndex + 1);
      setTimer(90);
      if (onNextPrompt) onNextPrompt();
    } else if (currentPromptIndex === prompts.length - 1 && timer === 0) {
      // Show 'close debrief' instead of next prompt
    }
  }, [timer, currentPromptIndex, onNextPrompt]);

  React.useEffect(() => {
    if (currentPromptIndex < prompts.length) {
      setTimer(90);
    }
  }, [currentPromptIndex, prompts]);

  return (
    <div>
      {prompts[currentPromptIndex] && (
        <>
          <h1>{prompts[currentPromptIndex].content}</h1>
          {timer > 0 && <p>Time remaining: {timer} seconds</p>}
        </>
      )}
      {timer > 0 && (
        <button onClick={() => setTimer((prevTimer) => prevTimer - 1)}>
          Skip
        </button>
      )}
    </div>
  );
};

export default DebriefTimer;

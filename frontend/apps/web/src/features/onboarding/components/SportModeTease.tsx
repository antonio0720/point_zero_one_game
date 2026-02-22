/**
 * SportModeTease component for Verified ladder onboarding.
 * Displays a non-blocking tease as a goal, not a rejection.
 */

type Props = {
  /** Callback function to handle the user clicking the 'Start' button */
  onStart: () => void;
};

const SportModeTease: React.FC<Props> = ({ onStart }) => (
  <div className="sport-mode-tease">
    <h2>Welcome to Verified Ladder</h2>
    <p>
      Compete in real-time financial roguelike games against other players.
      Your goal is to outperform the market and climb the leaderboard.
    </p>
    <button onClick={onStart}>Start Now</button>
  </div>
);

export default SportModeTease;

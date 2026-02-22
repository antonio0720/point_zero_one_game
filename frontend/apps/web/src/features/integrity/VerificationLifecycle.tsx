/**
 * VerificationLifecycle component for Point Zero One Digital's financial roguelike game.
 * Represents a visual timeline of verification states (Pending, Verified, Quarantined, Appeal Resolved).
 */

type State = 'PENDING' | 'VERIFIED' | 'QUARANTINED' | 'APPEAL_RESOLVED';

interface Props {
  state: State;
  microcopy?: Record<State, string>;
}

const VerificationLifecycle: React.FC<Props> = ({ state, microcopy }) => {
  const microcopyMap = microcopy || {
    PENDING: 'Pending Verification',
    VERIFIED: 'Verified',
    QUARANTINED: 'Quarantined',
    APPEAL_RESOLVED: 'Appeal Resolved',
  };

  return (
    <div className="verification-lifecycle">
      <div className={`state state-${state}`}>{microcopyMap[state]}</div>
      {/* Add additional states as needed */}
      <div className="timeline" />
    </div>
  );
};

export default VerificationLifecycle;

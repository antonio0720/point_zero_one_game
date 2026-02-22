import React from 'react';
import { useProof } from '../hooks/useProof';
import { useLeaderboardPosition } from '../hooks/useLeaderboardPosition';
import { useShareableImageExport } from '../hooks/useShareableImageExport';
import { useAuditHash } from '../hooks/useAuditHash';

const ProofCard: React.FC = () => {
  const proof = useProof();
  const leaderboardPosition = useLeaderboardPosition(proof.id);
  const shareableImageExport = useShareableImageExport(proof.id);
  const auditHash = useAuditHash();

  if (!proof) return null;

  return (
    <div className="proof-card">
      <h2>Proof ID: {proof.id}</h2>
      <p>SHA256 Hash: {auditHash}</p>
      <p>Score: {proof.score.toFixed(2)}</p>
      <p>ROI: {(proof.roi * 100).toFixed(2)}%</p>
      <p>Drawdown: {(proof.drawdown * 100).toFixed(2)}%</p>
      <div className="moment-stamps">
        <h3>Moment Stamps:</h3>
        <ul>
          {proof.momentStamps.map((stamp, index) => (
            <li key={index}>
              <span>Timestamp: {new Date(stamp.timestamp).toLocaleString()}</span>
              <span>Value: {stamp.value.toFixed(2)}</span>
            </li>
          ))}
        </ul>
      </div>
      <button onClick={() => shareableImageExport()}>Shareable Image Export</button>
      <p>Leaderboard Position: {leaderboardPosition}</p>
    </div>
  );
};

export default ProofCard;

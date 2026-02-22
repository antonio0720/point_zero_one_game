import React from 'react';
import { useGameContext } from '../game-context';
import { useMLModel } from '../ml-model';
import { useAuditHash } from '../audit-hash';

interface M14Props {
  mlEnabled?: boolean;
}

const M14: React.FC<M14Props> = ({ mlEnabled }) => {
  const gameContext = useGameContext();
  const mlModel = useMLModel();
  const auditHash = useAuditHash();

  if (!mlEnabled) return null;

  const output = mlModel.runStartDisadvantageDraft(gameContext);

  return (
    <div>
      <h2>Disadvantage Draft (Run Start)</h2>
      <p>Output: {output.toFixed(4)}</p>
      <pre>{auditHash}</pre>
    </div>
  );
};

export default M14;

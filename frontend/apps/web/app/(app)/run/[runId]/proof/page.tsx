/**
 * Proof Page Component for Point Zero One Digital's Financial Roguelike Game
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';

type ProofData = {
  status: string;
  runId: string;
  proofHash: string;
};

/**
 * ProofPage component displays the details of a proof for a given run.
 */
const ProofPage: React.FC<{ data: ProofData }> = ({ data }) => {
  const [copiedRunId, setCopiedRunId] = useState(false);
  const [copiedProofHash, setCopiedProofHash] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(true);
  };

  return (
    <div>
      <h1>Proof Details</h1>
      <div className="status-chip">{data.status}</div>
      <h2>Run ID: {data.runId}</h2>
      <button onClick={() => copyToClipboard(data.runId)} disabled={copiedRunId}>
        Copy Run ID
      </button>
      {copiedRunId && <p>Run ID copied to clipboard!</p>}
      <h2>Proof Hash: {data.proofHash}</h2>
      <button onClick={() => copyToClipboard(data.proofHash)} disabled={copiedProofHash}>
        Copy Proof Hash
      </button>
      {copiedProofHash && <p>Proof Hash copied to clipboard!</p>}
      <Link to={`/runs/${data.runId}`}>View Run in Run Explorer</Link>
    </div>
  );
};

export default ProofPage;

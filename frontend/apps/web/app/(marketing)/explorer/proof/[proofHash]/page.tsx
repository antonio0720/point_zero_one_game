/**
 * Proof Page Component for Run Explorer by Proof Hash
 */

import React from 'react';
import { Link } from 'gatsby';
import { useProofHash } from '../../hooks/useProofHash';

/**
 * ProofPage component
 * @param proofHash - The hash of the proof to display
 */
const ProofPage: React.FC<{ proofHash: string }> = ({ proofHash }) => {
  const { data, loading, error } = useProofHash(proofHash);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h1>Run Explorer by Proof Hash: {proofHash}</h1>
      <p>Game State:</p>
      <pre>{JSON.stringify(data, null, 2)}</pre>
      <Link to="/">Back to Home</Link>
    </div>
  );
};

export default ProofPage;

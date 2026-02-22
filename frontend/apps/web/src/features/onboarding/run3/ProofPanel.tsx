/**
 * ProofPanel component for Run3 onboarding process.
 * Transitions from Pending to Verified state and polls for proof status.
 * Displays a stamp when verified.
 */

import React, { useEffect, useState } from 'react';

type ProofStatus = 'PENDING' | 'VERIFIED';

interface ProofPanelProps {
  /** The current proof status */
  proofStatus: ProofStatus;
}

/**
 * ProofPanel component.
 * @param props - Props object containing the current proof status.
 */
const ProofPanel: React.FC<ProofPanelProps> = ({ proofStatus }) => {
  const [verifiedStampVisible, setVerifiedStampVisible] = useState(false);

  useEffect(() => {
    if (proofStatus === 'VERIFIED') {
      setVerifiedStampVisible(true);
    }
  }, [proofStatus]);

  return (
    <div>
      {proofStatus === 'PENDING' ? (
        <p>Proof is pending verification.</p>
      ) : (
        <>
          <p>Proof has been verified.</p>
          {verifiedStampVisible && <img src="/verified_stamp.png" alt="Verified Stamp" />}
        </>
      )}
    </div>
  );
};

export default ProofPanel;

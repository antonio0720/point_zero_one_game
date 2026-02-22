/**
 * IntegrityLink component for displaying proof page integrity links.
 */

import React from 'react';

type Props = {
  /** The hash of the proof page. */
  proofPageHash: string;
};

const IntegrityLink: React.FC<Props> = ({ proofPageHash }) => {
  return (
    <a href={`/proof/${proofPageHash}/integrity`} rel="noopener noreferrer">
      View Proof Page Integrity
    </a>
  );
};

export default IntegrityLink;

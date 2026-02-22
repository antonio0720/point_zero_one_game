/**
 * IntegrityLink component for Season Hub
 */

import React from 'react';

type Props = {
  /** The integrity checksum of the season data */
  checksum?: string;
};

const IntegrityLink: React.FC<Props> = ({ checksum }) => {
  if (!checksum) return null;

  return (
    <a href={`#checksum-${checksum}`} className="integrity-link">
      Check Integrity
    </a>
  );
};

export default IntegrityLink;

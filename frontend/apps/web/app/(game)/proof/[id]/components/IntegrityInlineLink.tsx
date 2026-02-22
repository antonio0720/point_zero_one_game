/**
 * IntegrityInlineLink component for displaying a verifiable run link in the Proof page.
 */

import React from 'react';

type Props = {
  /** The unique identifier of the game run. */
  id: string;
};

const IntegrityInlineLink: React.FC<Props> = ({ id }) => (
  <a href={`/proof/${id}`} target="_blank" rel="noopener noreferrer">
    This run is verifiable. Here’s how.
  </a>
);

export default IntegrityInlineLink;

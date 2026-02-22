/**
 * WhatWeTrackPrivacySafe component for Point Zero One Digital's financial roguelike game.
 * Strict TypeScript, no 'any', export all public symbols, include JSDoc.
 */

import React from 'react';

type Props = {
  /** Title of the section */
  title: string;
  /** Description of what we track and privacy commitments */
  content: string;
};

/**
 * WhatWeTrackPrivacySafe component for displaying information about what data is tracked and privacy commitments.
 */
const WhatWeTrackPrivacySafe: React.FC<Props> = ({ title, content }) => {
  return (
    <section className="what-we-track">
      <h2>{title}</h2>
      <p dangerouslySetInnerHTML={{ __html: content }} />
    </section>
  );
};

export default WhatWeTrackPrivacySafe;

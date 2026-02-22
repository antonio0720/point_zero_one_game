/**
 * ClickableProof component for embedding proof CTAs, replay, and diagrams.
 */

import React from 'react';
import { Link } from 'gatsby';

type Props = {
  /** The title of the clickable proof section */
  title: string;

  /** The URL for the proof image */
  proofImageUrl: string;

  /** The URL for the replay video */
  replayVideoUrl?: string;

  /** The URL for the diagram image */
  diagramImageUrl?: string;

  /** The link to the proof page */
  proofPageLink: string;
};

const ClickableProof: React.FC<Props> = ({
  title,
  proofImageUrl,
  replayVideoUrl,
  diagramImageUrl,
  proofPageLink,
}) => {
  return (
    <div className="clickable-proof">
      <h2>{title}</h2>
      <div className="proof-image-container">
        <img src={proofImageUrl} alt="" />
        {diagramImageUrl && (
          <div className="diagram-image-container">
            <img src={diagramImageUrl} alt="" />
          </div>
        )}
      </div>
      {replayVideoUrl && (
        <video controls src={replayVideoUrl} className="replay-video" />
      )}
      <Link to={proofPageLink}>View Proof</Link>
    </div>
  );
};

export default ClickableProof;

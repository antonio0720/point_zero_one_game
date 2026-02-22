/**
 * StatusExplainerLink component for explaining the meaning of after-run status chips in Point Zero One Digital's financial roguelike game.
 */

import React from 'react';
import { Link } from 'react-router-dom';

type Props = {
  /** The status chip label to be explained */
  label: string;
};

/**
 * StatusExplainerLink component for explaining the meaning of after-run status chips.
 * Renders a link to the lifecycle page with the provided status chip label as the anchor text.
 */
const StatusExplainerLink: React.FC<Props> = ({ label }) => (
  <Link to="/integrity#lifecycle">What does {label} mean?</Link>
);

export default StatusExplainerLink;

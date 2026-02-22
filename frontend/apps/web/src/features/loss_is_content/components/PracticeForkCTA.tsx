/**
 * PracticeForkCTA component for the Point Zero One Digital game.
 * This component is used to display a CTA (Call to Action) button for practice mode only.
 */

import React from 'react';

type Props = {
  /**
   * Callback function to handle click event on the CTA button.
   */
  onClick: () => void;
};

const PracticeForkCTA: React.FC<Props> = ({ onClick }) => (
  <button onClick={onClick}>
    Practice Mode Only - Fork Game
  </button>
);

export default PracticeForkCTA;

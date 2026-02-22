/**
 * OverlayToggle component for toggling the micro-explanation overlay in the onboarding feature.
 */

import React, { useState } from 'react';

type OverlayToggleProps = {
  /**
   * Whether the micro-explanation overlay is visible or not.
   */
  isVisible: boolean;

  /**
   * Callback function to toggle the visibility of the micro-explanation overlay.
   */
  onToggle: () => void;
};

/**
 * OverlayToggle component.
 *
 * @param {OverlayToggleProps} props - Props for the OverlayToggle component.
 * @returns {JSX.Element} The rendered JSX for the OverlayToggle component.
 */
const OverlayToggle: React.FC<OverlayToggleProps> = ({ isVisible, onToggle }) => {
  return (
    <button onClick={onToggle}>
      {isVisible ? 'Hide Explanation' : 'Show Explanation'}
    </button>
  );
};

export { OverlayToggle };

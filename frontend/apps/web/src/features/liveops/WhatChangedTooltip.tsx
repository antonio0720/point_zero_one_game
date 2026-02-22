/**
 * WhatChangedTooltip component for displaying tooltip with changes after a patch.
 */

import React, { useState, useEffect } from 'react';
import { Tooltip as ReactTooltip, Overlay } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';
import { usePatchCardContext } from '../contexts/PatchCardContext';
import { PatchCardData } from '../types/PatchCardData';

/**
 * Interface for the tooltip data.
 */
interface TooltipData {
  id: string;
  label: string;
  content: JSX.Element;
}

const WhatChangedTooltip: React.FC = () => {
  const [tooltipData, setTooltipData] = useState<TooltipData | null>(null);
  const { currentPatchCardData } = usePatchCardContext();

  useEffect(() => {
    if (currentPatchCardData) {
      const patchCardContent = (
        <>
          <h3>{currentPatchCardData.title}</h3>
          <ul>
            {currentPatchCardData.changes.map((change, index) => (
              <li key={index}>{change}</li>
            ))}
          </ul>
        </>
      );

      setTooltipData({ id: 'patch-card', label: 'What Changed?', content: patchCardContent });
    }
  }, [currentPatchCardData]);

  useEffect(() => {
    if (tooltipData) {
      const tooltipTimeout = setTimeout(() => {
        setTooltipData(null);
      }, 60000); // Cooldown of 1 minute

      return () => clearTimeout(tooltipTimeout);
    }
  }, [tooltipData]);

  if (!tooltipData) {
    return null;
  }

  return (
    <>
      <button className="what-changed-tooltip-trigger" data-tip={tooltipData.label}>
        What Changed?
      </button>
      <ReactTooltip place="bottom" type="dark" id={tooltipData.id}>
        {tooltipData.content}
      </ReactTooltip>
    </>
  );
};

export { WhatChangedTooltip };

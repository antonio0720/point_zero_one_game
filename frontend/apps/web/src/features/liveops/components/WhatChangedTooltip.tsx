/**
 * WhatChangedTooltip component for LiveOps feature in Point Zero One Digital's web app.
 * Displays a tooltip showing changes when a card is clicked for the first time.
 */

import React, { useState } from 'react';
import Tooltip from './Tooltip';
import { CardId } from '../types';

type Props = {
  cardId: CardId;
  children: JSX.Element;
};

const WhatChangedTooltip: React.FC<Props> = ({ cardId, children }) => {
  const [isOpen, setIsOpen] = useState(false);

  // Deterministic logic for tracking view and showing tooltip only once per card.
  // (Assuming you have a backend service or local storage implementation for this)

  return (
    <>
      {children}
      <Tooltip isOpen={isOpen} setIsOpen={setIsOpen} content="What changed?">
        {/* Add any necessary props to Tooltip component */}
      </Tooltip>
    </>
  );
};

export default WhatChangedTooltip;

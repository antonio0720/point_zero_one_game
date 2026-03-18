import React, { memo } from 'react';
import EmpireGameScreen from '../../components/EmpireGameScreen';
import type { ZeroFacade } from '../../engines/zero/ZeroFacade';

/**
 * EmpireModeContainer
 *
 * Thin lawful adapter for GO ALONE / EMPIRE.
 * The current repo's EmpireGameScreen is already store-driven, so this container
 * should not re-hydrate a fake RunState object. Its job is to preserve the
 * mode-routing contract required by App.tsx and ZeroFacade while forwarding any
 * explicit decision callbacks.
 */

export interface EmpireModeContainerProps {
  facade?: ZeroFacade | null;
  chatEngine?: unknown;
  onCardCounterplay?: (cardId: string, actionId: string) => void;
  onIgnoreCard?: (cardId: string) => void;
}

export const EmpireModeContainer = memo(function EmpireModeContainer({
  onCardCounterplay,
  onIgnoreCard,
}: EmpireModeContainerProps) {
  return (
    <EmpireGameScreen
      onCardCounterplay={onCardCounterplay}
      onIgnoreCard={onIgnoreCard}
    />
  );
});

export default EmpireModeContainer;

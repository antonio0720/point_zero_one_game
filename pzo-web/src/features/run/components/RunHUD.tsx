/**
 * FILE: RunHUD.tsx
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/features/run/components/RunHUD.tsx
 * Density6 LLC · Point Zero One · Confidential
 *
 * RunHUD — thin wrapper around GameHUD.
 *
 * Intent:
 * - Keep App.tsx and run screens thin.
 * - Let GameHUD own all hook subscriptions.
 * - Only gate visibility and forward presentation props here.
 */
'use client';

import React from 'react';
import GameHUD from './GameHUD';

export interface RunHUDProps {
  readonly isActiveRun?: boolean;
  readonly showIntel?: boolean;
  readonly className?: string;
  readonly style?: React.CSSProperties;
}

export default function RunHUD({
  isActiveRun = true,
  showIntel = true,
  className,
  style,
}: RunHUDProps) {
  if (!isActiveRun) return null;

  return (
    <section
      className={className}
      style={style}
      aria-label="Point Zero One run heads-up display"
      data-pzo-surface="run-hud"
    >
      <GameHUD isActiveRun={isActiveRun} showIntel={showIntel} />
    </section>
  );
}

/**
 * FILE: RunHUD.tsx
 * Density6 LLC · Point Zero One · Confidential
 *
 * RunHUD — thin wrapper that mounts GameHUD with live engine data.
 * GameHUD is self-contained: all engine hooks run inside it.
 * RunHUD's only job is gate-keeping visibility and supplying className/style.
 */
'use client';
import React             from 'react';
import GameHUD           from './GameHUD';

export interface RunHUDProps {
  readonly isActiveRun?: boolean;
  readonly showIntel?:   boolean;
  readonly className?:   string;
  readonly style?:       React.CSSProperties;
}

export default function RunHUD({
  isActiveRun = true,
  showIntel   = true,
  className,
  style,
}: RunHUDProps) {
  if (!isActiveRun) return null;

  return (
    <div className={className} style={style}>
      <GameHUD isActiveRun={isActiveRun} showIntel={showIntel} />
    </div>
  );
}
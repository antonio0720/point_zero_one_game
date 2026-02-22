/**
 * ShieldIcons.tsx — Displays active shields with consume animation
 *
 * Props contract (from App.tsx):
 *   count      number     — shields state value
 *   consuming  boolean    — true for one render cycle when a shield procs
 *   className  string?
 *
 * Zero phantom imports. Zero hooks. Pure props → UI.
 */

import React from 'react';

export interface ShieldIconsProps {
  count: number;
  consuming?: boolean;  // pass true for ~300ms when a shield is consumed
  className?: string;
}

export default function ShieldIcons({ count, consuming = false, className = '' }: ShieldIconsProps) {
  if (count === 0 && !consuming) return null;

  return (
    <div className={`flex items-center gap-1.5 ${className}`} aria-label={`${count} shield${count !== 1 ? 's' : ''} active`}>
      {/* Active shields */}
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="relative flex items-center justify-center w-7 h-7 rounded-full
                     bg-yellow-950 border border-yellow-600
                     shadow-sm shadow-yellow-900/60
                     transition-all duration-200"
          title="Shield active — absorbs one bankruptcy event"
        >
          <span className="text-sm select-none">🛡️</span>
        </div>
      ))}

      {/* Consume flash — shown when a shield procs */}
      {consuming && (
        <div
          className="relative flex items-center justify-center w-7 h-7 rounded-full
                     bg-red-950 border border-red-600
                     animate-ping"
          aria-hidden
        >
          <span className="text-sm select-none opacity-60">💥</span>
        </div>
      )}

      {/* Count badge when > 3 */}
      {count > 3 && (
        <span className="text-yellow-400 text-xs font-mono font-bold ml-0.5">
          ×{count}
        </span>
      )}
    </div>
  );
}

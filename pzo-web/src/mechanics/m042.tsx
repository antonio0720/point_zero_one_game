/**
 * M42GuidedPrompts — Opt-In, Minimal, Non-Preachy Guided Prompts
 * Source spec: mechanics/M42_guided_prompts_opt_in_minimal.md
 *
 * Prompts fade as mastery increases. Run-scoped; never preachy.
 * Completion marks the prompt resolved and writes to ledger.
 *
 * Deploy to: pzo-web/src/mechanics/m042.tsx
 */

'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import { useM42GuidedPrompts, type M42GameSignals, type GuidedPrompt } from './useM42GuidedPrompts';

// ─── Prompt Type Styles ───────────────────────────────────────────────────────

const PRIORITY_STYLES: Record<number, string> = {
  1: 'border-red-500 bg-red-950/80 shadow-red-900/40',
  2: 'border-yellow-500 bg-yellow-950/80 shadow-yellow-900/40',
  3: 'border-blue-500 bg-blue-950/80 shadow-blue-900/40',
  4: 'border-zinc-500 bg-zinc-900/80 shadow-zinc-900/40',
  5: 'border-zinc-700 bg-zinc-900/80 shadow-zinc-900/40',
};

const PRIORITY_TEXT: Record<number, string> = {
  1: 'text-red-300',
  2: 'text-yellow-300',
  3: 'text-blue-300',
  4: 'text-zinc-300',
  5: 'text-zinc-400',
};

// ─── Single Prompt Card ───────────────────────────────────────────────────────

interface PromptCardProps {
  prompt: GuidedPrompt;
  onDismiss: (promptId: string) => void;
  onComplete: (promptId: string) => void;
  onShown: (promptId: string) => void;
}

function PromptCard({ prompt, onDismiss, onComplete, onShown }: PromptCardProps) {
  const shownRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mark as shown on mount
  useEffect(() => {
    if (!shownRef.current) {
      shownRef.current = true;
      onShown(prompt.promptId);
    }
  }, [prompt.promptId, onShown]);

  // Auto-fade timer
  useEffect(() => {
    if (prompt.autoFadeMs > 0) {
      timerRef.current = setTimeout(() => {
        onDismiss(prompt.promptId);
      }, prompt.autoFadeMs);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [prompt.promptId, prompt.autoFadeMs, onDismiss]);

  const priorityStyle = PRIORITY_STYLES[prompt.priority] ?? PRIORITY_STYLES[5];
  const textStyle = PRIORITY_TEXT[prompt.priority] ?? PRIORITY_TEXT[5];

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`
        relative flex items-start gap-3 p-3 rounded-lg border
        shadow-lg backdrop-blur-sm
        animate-in slide-in-from-bottom-2 fade-in duration-300
        ${priorityStyle}
      `}
    >
      {/* Message */}
      <p className={`flex-1 text-sm font-medium leading-snug ${textStyle}`}>
        {prompt.message}
      </p>

      {/* Action buttons */}
      <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
        {/* Complete (acknowledged action) */}
        <button
          onClick={() => onComplete(prompt.promptId)}
          className={`
            text-xs px-2.5 py-1 rounded-md font-semibold
            transition-all duration-150
            bg-white/10 hover:bg-white/20 ${textStyle}
            border border-white/10 hover:border-white/20
          `}
          aria-label="Got it"
        >
          Got it
        </button>

        {/* Dismiss (don't show again this session) */}
        {prompt.dismissable && (
          <button
            onClick={() => onDismiss(prompt.promptId)}
            className="text-zinc-500 hover:text-zinc-300 transition-colors text-xs leading-none"
            aria-label="Dismiss"
          >
            ✕
          </button>
        )}
      </div>

      {/* Auto-fade progress bar */}
      {prompt.autoFadeMs > 0 && (
        <div
          className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full overflow-hidden"
          aria-hidden="true"
        >
          <div
            className="h-full bg-white/20 origin-left"
            style={{
              animation: `shrink-x ${prompt.autoFadeMs}ms linear forwards`,
            }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Audit Hash Badge ─────────────────────────────────────────────────────────

function AuditBadge({ hash }: { hash: string }) {
  if (!hash) return null;
  return (
    <div className="flex items-center gap-1.5 text-zinc-600 text-xs font-mono">
      <span className="w-1.5 h-1.5 rounded-full bg-zinc-700 inline-block" />
      <span title={`M42 audit hash: ${hash}`}>
        {hash.slice(0, 8)}…{hash.slice(-4)}
      </span>
    </div>
  );
}

// ─── Mastery Indicator ────────────────────────────────────────────────────────

function MasteryBar({ mastery }: { mastery: number }) {
  const pct = Math.round(mastery * 100);
  const label = pct >= 75 ? 'Expert' : pct >= 50 ? 'Proficient' : pct >= 25 ? 'Learning' : 'Novice';
  return (
    <div className="flex items-center gap-2" title={`Mastery: ${pct}% — prompts reduce at 75%`}>
      <span className="text-zinc-500 text-xs">Mastery</span>
      <div className="w-16 h-1 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-600 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-zinc-500 text-xs">{label}</span>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface M42GuidedPromptsProps {
  signals: M42GameSignals | null;
  mlEnabled?: boolean;
  showAuditHash?: boolean;
  showMastery?: boolean;
  maxVisible?: number;
  className?: string;
}

// ─── Main Component ───────────────────────────────────────────────────────────

const M42GuidedPrompts: React.FC<M42GuidedPromptsProps> = ({
  signals,
  mlEnabled = true,
  showAuditHash = false,
  showMastery = false,
  maxVisible = 3,
  className = '',
}) => {
  const {
    visiblePrompts,
    auditHash,
    dismissPrompt,
    completePrompt,
    markPromptShown,
    sessionPromptsShown,
  } = useM42GuidedPrompts(signals, mlEnabled);

  const handleDismiss = useCallback((promptId: string) => {
    dismissPrompt(promptId);
  }, [dismissPrompt]);

  const handleComplete = useCallback((promptId: string) => {
    completePrompt(promptId);
  }, [completePrompt]);

  const handleShown = useCallback((promptId: string) => {
    markPromptShown(promptId);
  }, [markPromptShown]);

  // Cap visible prompts to prevent overwhelming UI
  const displayedPrompts = visiblePrompts.slice(0, maxVisible);

  if (!mlEnabled || displayedPrompts.length === 0) {
    // Still render the container so audit/mastery info is always visible if enabled
    if (!showAuditHash && !showMastery) return null;
  }

  return (
    <div
      className={`flex flex-col gap-2 ${className}`}
      data-testid="m42-guided-prompts"
      data-audit-hash={auditHash}
    >
      {/* Prompt stack */}
      {displayedPrompts.map(prompt => (
        <PromptCard
          key={prompt.promptId}
          prompt={prompt}
          onDismiss={handleDismiss}
          onComplete={handleComplete}
          onShown={handleShown}
        />
      ))}

      {/* Overflow indicator */}
      {visiblePrompts.length > maxVisible && (
        <p className="text-zinc-600 text-xs text-center">
          +{visiblePrompts.length - maxVisible} more prompts
        </p>
      )}

      {/* Footer meta */}
      {(showAuditHash || showMastery) && (
        <div className="flex items-center justify-between mt-1">
          {showMastery && signals && (
            <MasteryBar mastery={signals.masteryScore} />
          )}
          {showAuditHash && auditHash && (
            <AuditBadge hash={auditHash} />
          )}
        </div>
      )}
    </div>
  );
};

export default M42GuidedPrompts;

/*
  Global CSS required (add to globals.css or tailwind config):

  @keyframes shrink-x {
    from { transform: scaleX(1); }
    to   { transform: scaleX(0); }
  }
*/

/**
 * PZO SPRINT 8 — src/components/LeagueUI.tsx
 *
 * UI for the full League / Season infrastructure:
 *   1. LadderStandingsPanel — live rankings with rating, points, grade
 *   2. ReplayReportPanel    — anti-cheat verification report display
 *   3. MatchExportCard      — shareable proof card (text + clipboard export)
 *   4. SeasonBadge          — inline badge for use in ProofCardV2
 */

'use client';

import React, { useState } from 'react';
import type { LadderEntry, ClubStandingEntry, RunRecord } from '../engine/seasonLadder';
import type { ReplayReport } from '../engine/antiCheat';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

const GRADE_STYLE: Record<string, { color: string; bg: string }> = {
  S: { color: 'text-yellow-300', bg: 'bg-yellow-900/30 border-yellow-700/50' },
  A: { color: 'text-emerald-400', bg: 'bg-emerald-900/30 border-emerald-700/50' },
  B: { color: 'text-blue-400',   bg: 'bg-blue-900/30 border-blue-700/50' },
  C: { color: 'text-zinc-300',   bg: 'bg-zinc-800/60 border-zinc-700/50' },
  D: { color: 'text-orange-400', bg: 'bg-orange-900/20 border-orange-800/50' },
  F: { color: 'text-red-400',    bg: 'bg-red-900/20 border-red-800/50' },
};

// ─── Ladder Standings Panel ───────────────────────────────────────────────────

interface LadderStandingsPanelProps {
  entries: LadderEntry[];
  myPlayerId: string;
  clubEntries?: ClubStandingEntry[];
  seasonName: string;
  format: string;
}

export function LadderStandingsPanel({
  entries,
  myPlayerId,
  clubEntries,
  seasonName,
  format,
}: LadderStandingsPanelProps) {
  const [tab, setTab] = useState<'players' | 'clubs'>('players');
  const myRank = entries.find(e => e.playerId === myPlayerId);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white font-black text-sm">🏆 {seasonName}</p>
            <p className="text-zinc-500 text-xs capitalize">{format} format</p>
          </div>
          {myRank && (
            <div className="text-right">
              <p className="text-zinc-400 text-xs">Your rank</p>
              <p className="text-white font-black text-lg">#{myRank.rank}</p>
              <p className="text-indigo-300 text-xs font-mono">{myRank.ladderRating} ELO</p>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      {clubEntries && (
        <div className="flex border-b border-zinc-800">
          {(['players', 'clubs'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${
                tab === t ? 'text-white border-b-2 border-indigo-500 bg-zinc-800/30' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {t === 'players' ? '👤 Players' : '🏠 Clubs'}
            </button>
          ))}
        </div>
      )}

      {/* Player Table */}
      {tab === 'players' && (
        <div>
          {/* Column headers */}
          <div className="grid grid-cols-12 px-3 py-1.5 border-b border-zinc-800/50">
            <span className="col-span-1 text-zinc-600 text-xs">#</span>
            <span className="col-span-4 text-zinc-600 text-xs">Player</span>
            <span className="col-span-2 text-zinc-600 text-xs text-right">ELO</span>
            <span className="col-span-2 text-zinc-600 text-xs text-right">Pts</span>
            <span className="col-span-1 text-zinc-600 text-xs text-center">Gr</span>
            <span className="col-span-2 text-zinc-600 text-xs text-right">Runs</span>
          </div>

          <div className="divide-y divide-zinc-800/50 max-h-80 overflow-y-auto">
            {entries.map(entry => {
              const isMe = entry.playerId === myPlayerId;
              const gradeStyle = GRADE_STYLE[entry.grade] ?? GRADE_STYLE['C'];

              return (
                <div
                  key={entry.playerId}
                  className={`grid grid-cols-12 items-center px-3 py-2 ${
                    isMe ? 'bg-indigo-900/20' : 'hover:bg-zinc-800/30'
                  }`}
                >
                  {/* Rank */}
                  <span className="col-span-1 text-xs font-mono text-zinc-400">
                    {entry.rank <= 3
                      ? ['🥇', '🥈', '🥉'][entry.rank - 1]
                      : entry.rank}
                  </span>

                  {/* Player */}
                  <div className="col-span-4 flex items-center gap-1.5 overflow-hidden">
                    <span className="text-sm shrink-0">{entry.avatarEmoji}</span>
                    <div className="overflow-hidden">
                      <p className={`text-xs font-semibold truncate ${isMe ? 'text-indigo-300' : 'text-white'}`}>
                        {entry.displayName}
                      </p>
                      {entry.isVerified && (
                        <span className="text-emerald-500 text-xs">✓ verified</span>
                      )}
                    </div>
                  </div>

                  {/* ELO */}
                  <div className="col-span-2 text-right">
                    <span className="text-white text-xs font-mono font-bold">{entry.ladderRating}</span>
                    {entry.ratingDelta !== null && (
                      <span className={`text-xs font-mono ml-0.5 ${entry.ratingDelta >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {entry.ratingDelta >= 0 ? '+' : ''}{entry.ratingDelta}
                      </span>
                    )}
                  </div>

                  {/* Points */}
                  <span className="col-span-2 text-zinc-300 text-xs font-mono text-right">
                    {entry.seasonPoints.toLocaleString()}
                  </span>

                  {/* Grade */}
                  <span className={`col-span-1 text-center text-xs font-black ${gradeStyle.color}`}>
                    {entry.grade}
                  </span>

                  {/* Runs */}
                  <div className="col-span-2 text-right">
                    <span className="text-zinc-400 text-xs font-mono">{entry.totalRuns}</span>
                    <span className="text-zinc-600 text-xs ml-1">
                      {Math.round(entry.winRate * 100)}%W
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Club Table */}
      {tab === 'clubs' && clubEntries && (
        <div className="divide-y divide-zinc-800/50 max-h-80 overflow-y-auto">
          {clubEntries.map(club => (
            <div key={club.clubId} className="flex items-center gap-3 px-3 py-2 hover:bg-zinc-800/30">
              <span className="text-zinc-500 text-xs font-mono w-5 text-center">
                {club.rank <= 3 ? ['🥇', '🥈', '🥉'][club.rank - 1] : club.rank}
              </span>
              <div className="flex-1">
                <p className="text-white text-xs font-bold">{club.clubName}</p>
                <p className="text-zinc-500 text-xs">{club.memberCount} members · Top: {club.topPlayerName}</p>
              </div>
              <div className="text-right">
                <p className="text-white text-xs font-mono font-bold">{club.totalSeasonPoints.toLocaleString()}</p>
                <p className="text-zinc-500 text-xs">avg {club.avgLadderRating} ELO</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Replay Report Panel ──────────────────────────────────────────────────────

interface ReplayReportPanelProps {
  report: ReplayReport;
  onDismiss?: () => void;
}

export function ReplayReportPanel({ report, onDismiss }: ReplayReportPanelProps) {
  const [showDetails, setShowDetails] = useState(false);

  const verdictStyle = {
    CLEAN:      { icon: '✅', color: 'text-emerald-400', bg: 'bg-emerald-900/20 border-emerald-700/50' },
    SUSPICIOUS: { icon: '⚠️', color: 'text-orange-400', bg: 'bg-orange-900/20 border-orange-700/50' },
    INVALID:    { icon: '❌', color: 'text-red-400',    bg: 'bg-red-900/20 border-red-700/50' },
  }[report.verdict];

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800">
        <p className="text-white font-bold text-xs">🔍 Replay Verification</p>
        <p className="text-zinc-600 text-xs font-mono truncate">{report.matchHash}</p>
      </div>

      <div className="p-4 space-y-3">
        {/* Verdict */}
        <div className={`flex items-start gap-3 p-3 rounded-xl border ${verdictStyle.bg}`}>
          <span className="text-xl">{verdictStyle.icon}</span>
          <div>
            <p className={`font-black text-sm ${verdictStyle.color}`}>{report.verdict}</p>
            <p className="text-zinc-400 text-xs">{report.verdictReason}</p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-2">
          {[
            ['Chain Intact', report.logVerification.chainIntact ? '✅ Yes' : '❌ Broken', report.logVerification.chainIntact ? 'text-emerald-400' : 'text-red-400'],
            ['Actions', String(report.logVerification.totalActions), 'text-white'],
            ['Plausible', report.plausibilityCheck.plausible ? '✅ Yes' : '⚠️ Flags', report.plausibilityCheck.plausible ? 'text-emerald-400' : 'text-orange-400'],
            ['Confidence', `${Math.round(report.plausibilityCheck.confidence * 100)}%`, 'text-white'],
            ['Rule Pack', report.rulePackHash, 'text-zinc-400'],
          ].map(([label, val, color]) => (
            <div key={label} className="bg-zinc-800/50 rounded-lg p-2">
              <p className="text-zinc-500 text-xs">{label}</p>
              <p className={`text-xs font-mono font-semibold truncate ${color}`}>{val}</p>
            </div>
          ))}
        </div>

        {/* Discrepancies */}
        {report.discrepancies.length > 0 && (
          <div>
            <button
              onClick={() => setShowDetails(v => !v)}
              className="w-full text-left flex items-center justify-between py-1"
            >
              <span className="text-orange-400 text-xs font-semibold">{report.discrepancies.length} discrepancy(s)</span>
              <span className="text-zinc-600 text-xs">{showDetails ? '▲' : '▼'}</span>
            </button>
            {showDetails && (
              <div className="space-y-1 mt-1">
                {report.discrepancies.map((d, i) => (
                  <p key={i} className="text-red-400 text-xs font-mono bg-red-900/10 rounded px-2 py-1">{d}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {onDismiss && (
          <button
            onClick={onDismiss}
            className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-xl transition-colors"
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Match Export Card ────────────────────────────────────────────────────────

interface MatchExportCardProps {
  run: RunRecord;
  matchHash: string;
  playerName: string;
  seasonName: string;
  ladderRank: number | null;
  onCopyText?: () => void;
}

export function MatchExportCard({
  run,
  matchHash,
  playerName,
  seasonName,
  ladderRank,
  onCopyText,
}: MatchExportCardProps) {
  const [copied, setCopied] = useState(false);

  const gradeStyle = GRADE_STYLE[run.grade] ?? GRADE_STYLE['C'];
  const cashflow = run.finalIncome - run.finalExpenses;
  const date = new Date(run.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const shareText = [
    `🃏 PZO PROOF CARD`,
    `──────────────────`,
    `Player : ${playerName}`,
    `Season : ${seasonName}`,
    `Date   : ${date}`,
    `Grade  : ${run.grade}  (${run.difficultyPreset})`,
    `Score  : ${run.totalScore.toLocaleString()}`,
    `──────────────────`,
    `💵 Money     : ${run.moneyScore}`,
    `🛡 Resilience: ${run.resilienceScore}`,
    `🧠 Discipline: ${run.disciplineScore}`,
    `⚖️ Risk IQ   : ${run.riskMgmtScore}`,
    `──────────────────`,
    `Net Worth : ${fmt(run.finalNetWorth)}`,
    `Cashflow  : ${cashflow >= 0 ? '+' : ''}${fmt(cashflow)}/mo`,
    `Survived  : ${run.survivedRun ? 'YES' : 'NO'}`,
    `Objectives: ${run.completedObjectiveIds.length} completed`,
    ladderRank ? `Rank      : #${ladderRank}` : '',
    `──────────────────`,
    `HASH: ${matchHash}`,
    run.verified ? `✅ VERIFIED — Point Zero One` : `⚠️ UNVERIFIED`,
  ].filter(Boolean).join('\n');

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onCopyText?.();
  };

  return (
    <div className={`border-2 rounded-xl overflow-hidden ${gradeStyle.bg}`}>
      {/* Visual Card Header */}
      <div className="px-4 py-4 text-center border-b border-zinc-800/50">
        <div className={`text-5xl font-black ${gradeStyle.color}`}>{run.grade}</div>
        <p className="text-white font-black text-base mt-0.5">{playerName}</p>
        <p className="text-zinc-400 text-xs">{seasonName} · {date}</p>
        {ladderRank && (
          <p className="text-indigo-300 text-xs mt-0.5">Ranked #{ladderRank}</p>
        )}
      </div>

      {/* Score Pillars */}
      <div className="grid grid-cols-4 divide-x divide-zinc-800 border-b border-zinc-800">
        {[
          ['💵', 'Money', run.moneyScore],
          ['🛡', 'Shield', run.resilienceScore],
          ['🧠', 'Mind', run.disciplineScore],
          ['⚖️', 'Risk', run.riskMgmtScore],
        ].map(([icon, label, score]) => (
          <div key={label as string} className="text-center py-3 px-1">
            <p className="text-base">{icon}</p>
            <p className="text-white font-black text-sm font-mono">{score}</p>
            <p className="text-zinc-600 text-xs">{label}</p>
          </div>
        ))}
      </div>

      {/* Financial Row */}
      <div className="grid grid-cols-3 divide-x divide-zinc-800/50 border-b border-zinc-800/50">
        {[
          ['Net Worth', fmt(run.finalNetWorth), 'text-white'],
          ['Cashflow', `${cashflow >= 0 ? '+' : ''}${fmt(cashflow)}/mo`, cashflow >= 0 ? 'text-emerald-400' : 'text-red-400'],
          ['Score', run.totalScore.toLocaleString(), gradeStyle.color],
        ].map(([label, val, color]) => (
          <div key={label as string} className="text-center py-2 px-1">
            <p className="text-zinc-500 text-xs">{label}</p>
            <p className={`text-xs font-mono font-bold ${color}`}>{val}</p>
          </div>
        ))}
      </div>

      {/* Verification Footer */}
      <div className="px-4 py-2 flex items-center justify-between">
        <div>
          <p className={`text-xs font-mono ${run.verified ? 'text-emerald-500' : 'text-zinc-500'}`}>
            {run.verified ? '✅ VERIFIED' : '⚠️ UNVERIFIED'}
          </p>
          <p className="text-zinc-700 text-xs font-mono truncate max-w-32">{matchHash}</p>
        </div>
        <button
          onClick={handleCopy}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            copied
              ? 'bg-emerald-700 text-emerald-200'
              : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
          }`}
        >
          {copied ? '✅ Copied!' : '📋 Copy Proof'}
        </button>
      </div>
    </div>
  );
}

// ─── Season Badge (inline, for ProofCardV2) ───────────────────────────────────

interface SeasonBadgeProps {
  rank: number;
  rating: number;
  seasonName: string;
  grade: string;
  compact?: boolean;
}

export function SeasonBadge({ rank, rating, seasonName, grade, compact }: SeasonBadgeProps) {
  const gradeStyle = GRADE_STYLE[grade] ?? GRADE_STYLE['C'];

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs ${gradeStyle.bg}`}>
        <span className={`font-black ${gradeStyle.color}`}>{grade}</span>
        <span className="text-zinc-500">·</span>
        <span className="text-zinc-400 font-mono">#{rank}</span>
        <span className="text-zinc-600">·</span>
        <span className="text-indigo-300 font-mono">{rating}</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-xl border ${gradeStyle.bg}`}>
      <div className={`text-2xl font-black ${gradeStyle.color}`}>{grade}</div>
      <div>
        <p className="text-white text-xs font-bold">{seasonName}</p>
        <div className="flex gap-2">
          <span className="text-zinc-400 text-xs font-mono">#{rank} ladder</span>
          <span className="text-indigo-300 text-xs font-mono">{rating} ELO</span>
        </div>
      </div>
    </div>
  );
}

// ─── Achievement Badges ───────────────────────────────────────────────────────

const ACHIEVEMENT_META: Record<string, { icon: string; label: string; desc: string }> = {
  MILLENNIAL_MIND:    { icon: '🧠', label: 'Millennial Mind',    desc: 'Score 1000+ on a single run' },
  CONSISTENCY_KING:   { icon: '👑', label: 'Consistency King',   desc: '75%+ win rate across 5+ runs' },
  HOT_STREAK:         { icon: '🔥', label: 'Hot Streak',         desc: '5 consecutive cashflow-positive runs' },
  PERFECT_RUN:        { icon: '💎', label: 'Perfect Run',        desc: 'Grade S on any difficulty' },
  PHOENIX:            { icon: '🦅', label: 'Phoenix',            desc: 'Recover from distress and earn A or S' },
  IRON_RESERVE:       { icon: '🛡️', label: 'Iron Reserve',       desc: 'Maintain 25%+ liquidity all run' },
  DIVERSIFIED:        { icon: '📊', label: 'Diversified',        desc: 'End with HHI below 25%' },
  BIAS_BREAKER:       { icon: '⚡', label: 'Bias Breaker',       desc: 'Clear 5 bias states in one run' },
};

interface AchievementBadgesProps {
  achievements: string[];
}

export function AchievementBadges({ achievements }: AchievementBadgesProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {achievements.map(id => {
        const meta = ACHIEVEMENT_META[id];
        if (!meta) return null;
        return (
          <div
            key={id}
            title={meta.desc}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-800 border border-zinc-700 rounded-xl cursor-help hover:border-zinc-500 transition-colors"
          >
            <span className="text-sm">{meta.icon}</span>
            <span className="text-zinc-300 text-xs font-semibold">{meta.label}</span>
          </div>
        );
      })}
    </div>
  );
}

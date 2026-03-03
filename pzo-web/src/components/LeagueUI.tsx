/**
 * LeagueUI.tsx — PZO Sprint 8
 * LadderStandingsPanel · ReplayReportPanel · MatchExportCard · SeasonBadge · AchievementBadges
 *
 * Rebuilt: Syne + IBM Plex Mono · Inline styles · Mobile-first · High contrast
 * Engine: SovereigntyEngine · RunGrade · GRADE_THRESHOLDS · IntegrityStatus
 * 20M-player scale — no Tailwind dependency, no external CSS.
 * Density6 LLC · Confidential
 */

'use client';

import React, { useState } from 'react';
import type { LadderEntry, ClubStandingEntry, RunRecord } from '../engine/seasonLadder';
import type { ReplayReport } from '../engine/antiCheat';
import type { RunGrade, IntegrityStatus } from '../engines/sovereignty/types';
import { GRADE_THRESHOLDS } from '../engines/sovereignty/types';

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  void:    '#030308',
  card:    '#0C0C1E',
  cardHi:  '#131328',
  border:  'rgba(255,255,255,0.08)',
  borderM: 'rgba(255,255,255,0.14)',
  text:    '#F2F2FF',
  textSub: '#9090B4',
  textMut: '#44445A',
  green:   '#22DD88',
  red:     '#FF4D4D',
  orange:  '#FF8C00',
  yellow:  '#FFD700',
  indigo:  '#818CF8',
  purple:  '#A855F7',
  teal:    '#22D3EE',
  blue:    '#4488FF',
  mono:    "'IBM Plex Mono', 'JetBrains Mono', monospace",
  display: "'Syne', 'Outfit', system-ui, sans-serif",
};

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');*{box-sizing:border-box;}`;

// ─── Grade palette — mapped directly from SovereigntyEngine.GRADE_THRESHOLDS ─
const GRADE_CFG: Record<RunGrade, { color: string; bg: string; border: string; label: string }> = {
  A: { color: T.yellow,  bg: 'rgba(255,215,0,0.08)',    border: 'rgba(255,215,0,0.28)',    label: 'Sovereign' },
  B: { color: T.teal,    bg: 'rgba(34,211,238,0.08)',   border: 'rgba(34,211,238,0.25)',   label: 'Architect' },
  C: { color: T.indigo,  bg: 'rgba(129,140,248,0.08)',  border: 'rgba(129,140,248,0.22)',  label: 'Builder'   },
  D: { color: T.orange,  bg: 'rgba(255,140,0,0.07)',    border: 'rgba(255,140,0,0.22)',    label: 'Developing'},
  F: { color: T.red,     bg: 'rgba(255,77,77,0.07)',    border: 'rgba(255,77,77,0.22)',    label: 'Liquidated'},
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  const s = n < 0 ? '-' : '', v = Math.abs(n);
  if (v >= 1_000_000) return `${s}$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1_000)     return `${s}$${(v / 1e3).toFixed(0)}K`;
  return `${s}$${v.toLocaleString()}`;
}

// ─── Panel wrapper ────────────────────────────────────────────────────────────
function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: T.card, borderRadius: 12,
      border: `1px solid ${T.border}`,
      overflow: 'hidden', fontFamily: T.display,
      ...style,
    }}>
      <style>{FONT_IMPORT}</style>
      {children}
    </div>
  );
}

function PanelHeader({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 14px', borderBottom: `1px solid ${T.border}`,
      flexWrap: 'wrap', gap: 8,
    }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: T.text, fontFamily: T.display }}>
        {children}
      </span>
      {right}
    </div>
  );
}

// ─── Grade Badge (inline) ─────────────────────────────────────────────────────
function GradeBadge({ grade, size = 'sm' }: { grade: RunGrade; size?: 'sm' | 'md' | 'lg' }) {
  const cfg  = GRADE_CFG[grade];
  const sizes = { sm: 12, md: 18, lg: 28 };
  return (
    <span style={{
      fontSize: sizes[size], fontWeight: 800, fontFamily: T.display,
      color: cfg.color, textShadow: `0 0 16px ${cfg.color}55`,
    }}>
      {grade}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════
// LADDER STANDINGS PANEL
// ═══════════════════════════════════════════════════════════════════

interface LadderStandingsPanelProps {
  entries: LadderEntry[];
  myPlayerId: string;
  clubEntries?: ClubStandingEntry[];
  seasonName: string;
  format: string;
}

export function LadderStandingsPanel({
  entries, myPlayerId, clubEntries, seasonName, format,
}: LadderStandingsPanelProps) {
  const [tab, setTab] = useState<'players' | 'clubs'>('players');
  const myEntry = entries.find(e => e.playerId === myPlayerId);
  const MEDALS  = ['🥇', '🥈', '🥉'];

  return (
    <Panel>
      {/* Header */}
      <div style={{
        padding: '12px 14px', borderBottom: `1px solid ${T.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
      }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 800, color: T.text, fontFamily: T.display, marginBottom: 2 }}>
            🏆 {seasonName}
          </p>
          <p style={{ fontSize: 10, color: T.textSub, fontFamily: T.mono, textTransform: 'capitalize' }}>
            {format} format
          </p>
        </div>
        {myEntry && (
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 9, fontFamily: T.mono, color: T.textSub, marginBottom: 3 }}>Your rank</p>
            <p style={{ fontSize: 24, fontWeight: 800, color: T.text, fontFamily: T.display, lineHeight: 1, marginBottom: 2 }}>
              #{myEntry.rank}
            </p>
            <p style={{ fontSize: 10, fontFamily: T.mono, color: T.indigo, fontWeight: 700 }}>
              {myEntry.ladderRating} ELO
            </p>
          </div>
        )}
      </div>

      {/* Tabs */}
      {clubEntries && (
        <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}` }}>
          {(['players', 'clubs'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, padding: '10px 0', cursor: 'pointer',
                fontSize: 10, fontFamily: T.mono, fontWeight: 700,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                background: 'transparent', border: 'none',
                borderBottom: tab === t ? `2px solid ${T.indigo}` : '2px solid transparent',
                color: tab === t ? T.text : T.textMut,
                transition: 'color 0.15s, border-color 0.15s',
                minHeight: 40,
              }}
            >
              {t === 'players' ? '👤 Players' : '🏠 Clubs'}
            </button>
          ))}
        </div>
      )}

      {/* Player table */}
      {tab === 'players' && (
        <div>
          {/* Column headers */}
          <div style={{
            display: 'grid', gridTemplateColumns: '28px 1fr 64px 50px 24px 48px',
            gap: 4, padding: '6px 14px',
            borderBottom: `1px solid rgba(255,255,255,0.04)`,
          }}>
            {['#', 'Player', 'ELO', 'Pts', 'Gr', 'Runs'].map((h, i) => (
              <span key={h} style={{
                fontSize: 9, fontFamily: T.mono, color: T.textMut, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.1em',
                textAlign: i >= 2 ? 'right' : 'left',
              }}>
                {h}
              </span>
            ))}
          </div>

          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {entries.map(entry => {
              const isMe       = entry.playerId === myPlayerId;
              const gradeCfg   = GRADE_CFG[entry.grade as RunGrade] ?? GRADE_CFG['C'];
              const deltaColor = entry.ratingDelta !== null && entry.ratingDelta >= 0 ? T.green : T.red;

              return (
                <div
                  key={entry.playerId}
                  style={{
                    display: 'grid', gridTemplateColumns: '28px 1fr 64px 50px 24px 48px',
                    gap: 4, padding: '9px 14px', alignItems: 'center',
                    background: isMe ? 'rgba(129,140,248,0.07)' : 'transparent',
                    borderBottom: `1px solid rgba(255,255,255,0.04)`,
                    transition: 'background 0.15s',
                  }}
                >
                  {/* Rank */}
                  <span style={{
                    fontSize: entry.rank <= 3 ? 14 : 10,
                    fontFamily: T.mono, color: T.textSub, fontWeight: 700,
                    textAlign: 'center',
                  }}>
                    {entry.rank <= 3 ? MEDALS[entry.rank - 1] : entry.rank}
                  </span>

                  {/* Player */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                    <span style={{ fontSize: 14, flexShrink: 0 }}>{entry.avatarEmoji}</span>
                    <div style={{ minWidth: 0 }}>
                      <p style={{
                        fontSize: 11, fontWeight: 700, fontFamily: T.display,
                        color: isMe ? T.indigo : T.text,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {entry.displayName}
                      </p>
                      {entry.isVerified && (
                        <span style={{ fontSize: 9, fontFamily: T.mono, color: T.green }}>
                          ✓ verified
                        </span>
                      )}
                    </div>
                  </div>

                  {/* ELO */}
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 11, fontFamily: T.mono, fontWeight: 700, color: T.text }}>
                      {entry.ladderRating}
                    </span>
                    {entry.ratingDelta !== null && (
                      <span style={{ fontSize: 9, fontFamily: T.mono, color: deltaColor, marginLeft: 2 }}>
                        {entry.ratingDelta >= 0 ? '+' : ''}{entry.ratingDelta}
                      </span>
                    )}
                  </div>

                  {/* Points */}
                  <span style={{
                    fontSize: 10, fontFamily: T.mono, color: T.textSub,
                    textAlign: 'right', fontWeight: 600,
                  }}>
                    {entry.seasonPoints.toLocaleString()}
                  </span>

                  {/* Grade */}
                  <div style={{ textAlign: 'center' }}>
                    <GradeBadge grade={entry.grade as RunGrade} size="sm" />
                  </div>

                  {/* Runs + win rate */}
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 10, fontFamily: T.mono, color: T.textSub }}>
                      {entry.totalRuns}
                    </span>
                    <span style={{ fontSize: 9, fontFamily: T.mono, color: T.textMut, marginLeft: 4 }}>
                      {Math.round(entry.winRate * 100)}%W
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Club table */}
      {tab === 'clubs' && clubEntries && (
        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
          {clubEntries.map(club => (
            <div
              key={club.clubId}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', borderBottom: `1px solid rgba(255,255,255,0.04)`,
              }}
            >
              <span style={{
                fontSize: club.rank <= 3 ? 14 : 10,
                fontFamily: T.mono, color: T.textSub, width: 22, textAlign: 'center',
              }}>
                {club.rank <= 3 ? MEDALS[club.rank - 1] : club.rank}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: 11, fontWeight: 700, color: T.text, fontFamily: T.display, marginBottom: 2,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {club.clubName}
                </p>
                <p style={{ fontSize: 9, fontFamily: T.mono, color: T.textSub }}>
                  {club.memberCount} members · Top: {club.topPlayerName}
                </p>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ fontSize: 11, fontFamily: T.mono, fontWeight: 700, color: T.text }}>
                  {club.totalSeasonPoints.toLocaleString()}
                </p>
                <p style={{ fontSize: 9, fontFamily: T.mono, color: T.textSub }}>
                  avg {club.avgLadderRating} ELO
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

// ═══════════════════════════════════════════════════════════════════
// REPLAY REPORT PANEL
// ═══════════════════════════════════════════════════════════════════

interface ReplayReportPanelProps {
  report: ReplayReport;
  onDismiss?: () => void;
}

export function ReplayReportPanel({ report, onDismiss }: ReplayReportPanelProps) {
  const [showDetails, setShowDetails] = useState(false);

  const VERDICT_CFG: Record<IntegrityStatus, { icon: string; color: string; bg: string; border: string }> = {
    VERIFIED:   { icon: '✅', color: T.green,  bg: 'rgba(34,221,136,0.08)',  border: 'rgba(34,221,136,0.25)' },
    TAMPERED:   { icon: '❌', color: T.red,    bg: 'rgba(255,77,77,0.08)',   border: 'rgba(255,77,77,0.25)'  },
    UNVERIFIED: { icon: '⚠️', color: T.orange, bg: 'rgba(255,140,0,0.08)',  border: 'rgba(255,140,0,0.25)'  },
  };

  const vcfg = VERDICT_CFG[report.verdict as IntegrityStatus] ?? VERDICT_CFG['UNVERIFIED'];

  const quickStats = [
    { label: 'Chain Intact', value: report.logVerification.chainIntact ? '✅ Yes' : '❌ Broken',           color: report.logVerification.chainIntact ? T.green : T.red    },
    { label: 'Actions',      value: String(report.logVerification.totalActions),                              color: T.text                                                  },
    { label: 'Plausible',    value: report.plausibilityCheck.plausible ? '✅ Yes' : '⚠️ Flags',             color: report.plausibilityCheck.plausible ? T.green : T.orange },
    { label: 'Confidence',   value: `${Math.round(report.plausibilityCheck.confidence * 100)}%`,             color: T.text                                                  },
    { label: 'Rule Pack',    value: report.rulePackHash.slice(0, 12) + '…',                                  color: T.textSub                                               },
  ];

  return (
    <Panel>
      <PanelHeader>🔍 Replay Verification</PanelHeader>

      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Hash */}
        <p style={{
          fontSize: 9, fontFamily: T.mono, color: T.textMut,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {report.matchHash}
        </p>

        {/* Verdict banner */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 12,
          padding: '12px 14px', borderRadius: 10,
          background: vcfg.bg, border: `1px solid ${vcfg.border}`,
        }}>
          <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{vcfg.icon}</span>
          <div>
            <p style={{ fontSize: 14, fontWeight: 800, color: vcfg.color, fontFamily: T.display, marginBottom: 3 }}>
              {report.verdict}
            </p>
            <p style={{ fontSize: 11, color: T.textSub, fontFamily: T.mono, lineHeight: 1.5 }}>
              {report.verdictReason}
            </p>
          </div>
        </div>

        {/* Quick stats grid */}
        <div style={{
          display: 'grid', gap: 8,
          gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
        }}>
          {quickStats.map(({ label, value, color }) => (
            <div key={label} style={{
              padding: '9px 10px', borderRadius: 8,
              background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.border}`,
            }}>
              <p style={{ fontSize: 9, fontFamily: T.mono, color: T.textSub, marginBottom: 4, letterSpacing: '0.08em' }}>
                {label}
              </p>
              <p style={{
                fontSize: 11, fontFamily: T.mono, fontWeight: 700, color,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {value}
              </p>
            </div>
          ))}
        </div>

        {/* Discrepancies */}
        {report.discrepancies.length > 0 && (
          <div>
            <button
              onClick={() => setShowDetails(v => !v)}
              style={{
                width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 0',
                minHeight: 32,
              }}
            >
              <span style={{ fontSize: 11, fontFamily: T.mono, fontWeight: 700, color: T.orange }}>
                {report.discrepancies.length} discrepancy{report.discrepancies.length > 1 ? 'ies' : ''}
              </span>
              <span style={{ fontSize: 11, color: T.textMut }}>{showDetails ? '▲' : '▼'}</span>
            </button>
            {showDetails && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                {report.discrepancies.map((d, i) => (
                  <p key={i} style={{
                    fontSize: 10, fontFamily: T.mono, color: T.red,
                    padding: '5px 8px', borderRadius: 6,
                    background: 'rgba(255,77,77,0.08)', border: '1px solid rgba(255,77,77,0.20)',
                    lineHeight: 1.4,
                  }}>
                    {d}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {onDismiss && (
          <button
            onClick={onDismiss}
            style={{
              width: '100%', padding: '10px', borderRadius: 9, cursor: 'pointer',
              fontSize: 11, fontFamily: T.mono, fontWeight: 700,
              background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.border}`,
              color: T.textSub, minHeight: 40, transition: 'all 0.15s',
            }}
          >
            Close
          </button>
        )}
      </div>
    </Panel>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MATCH EXPORT CARD
// ═══════════════════════════════════════════════════════════════════

interface MatchExportCardProps {
  run: RunRecord;
  matchHash: string;
  playerName: string;
  seasonName: string;
  ladderRank: number | null;
  onCopyText?: () => void;
}

export function MatchExportCard({
  run, matchHash, playerName, seasonName, ladderRank, onCopyText,
}: MatchExportCardProps) {
  const [copied, setCopied] = useState(false);

  const grade    = run.grade as RunGrade;
  const gcfg     = GRADE_CFG[grade] ?? GRADE_CFG['F'];
  const cashflow = run.finalIncome - run.finalExpenses;
  const date     = new Date(run.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const shareText = [
    `🃏 PZO PROOF CARD`,
    `──────────────────`,
    `Player  : ${playerName}`,
    `Season  : ${seasonName}`,
    `Date    : ${date}`,
    `Grade   : ${run.grade}  (${run.difficultyPreset})`,
    `Score   : ${run.totalScore.toLocaleString()}`,
    `──────────────────`,
    `💵 Money      : ${run.moneyScore}`,
    `🛡 Resilience : ${run.resilienceScore}`,
    `🧠 Discipline : ${run.disciplineScore}`,
    `⚖️ Risk IQ    : ${run.riskMgmtScore}`,
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
    setTimeout(() => setCopied(false), 2200);
    onCopyText?.();
  };

  const SCORE_PILLARS = [
    { icon: '💵', label: 'Money',    score: run.moneyScore      },
    { icon: '🛡',  label: 'Shield',   score: run.resilienceScore  },
    { icon: '🧠', label: 'Mind',     score: run.disciplineScore  },
    { icon: '⚖️', label: 'Risk IQ',  score: run.riskMgmtScore   },
  ];

  return (
    <div style={{
      borderRadius: 12, overflow: 'hidden', fontFamily: T.display,
      border: `2px solid ${gcfg.border}`,
      background: gcfg.bg,
    }}>
      <style>{FONT_IMPORT}</style>

      {/* Hero section */}
      <div style={{
        padding: 'clamp(16px,4vw,24px)', textAlign: 'center',
        borderBottom: `1px solid rgba(255,255,255,0.07)`,
      }}>
        <div style={{
          fontSize: 'clamp(3rem,8vw,5rem)', fontWeight: 800,
          fontFamily: T.display, color: gcfg.color,
          textShadow: `0 0 40px ${gcfg.color}55`,
          lineHeight: 1, marginBottom: 8,
        }}>
          {run.grade}
        </div>
        <p style={{ fontSize: 15, fontWeight: 800, color: T.text, fontFamily: T.display, marginBottom: 3 }}>
          {playerName}
        </p>
        <p style={{ fontSize: 11, color: T.textSub, fontFamily: T.mono }}>
          {seasonName} · {date}
        </p>
        {ladderRank && (
          <p style={{ fontSize: 11, color: T.indigo, fontFamily: T.mono, fontWeight: 700, marginTop: 4 }}>
            Ranked #{ladderRank}
          </p>
        )}
      </div>

      {/* Score pillars */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        borderBottom: `1px solid rgba(255,255,255,0.07)`,
      }}>
        {SCORE_PILLARS.map(({ icon, label, score }) => (
          <div key={label} style={{
            textAlign: 'center', padding: '12px 6px',
            borderRight: `1px solid rgba(255,255,255,0.07)`,
          }}>
            <div style={{ fontSize: 18, lineHeight: 1, marginBottom: 5 }}>{icon}</div>
            <div style={{
              fontSize: 16, fontFamily: T.mono, fontWeight: 700, color: T.text, marginBottom: 3,
            }}>
              {score}
            </div>
            <div style={{ fontSize: 9, fontFamily: T.mono, color: T.textSub, letterSpacing: '0.08em' }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Financial row */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        borderBottom: `1px solid rgba(255,255,255,0.07)`,
      }}>
        {[
          { label: 'Net Worth', value: fmt(run.finalNetWorth), color: T.text },
          { label: 'Cashflow',  value: `${cashflow >= 0 ? '+' : ''}${fmt(cashflow)}/mo`, color: cashflow >= 0 ? T.green : T.red },
          { label: 'Score',     value: run.totalScore.toLocaleString(), color: gcfg.color },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            textAlign: 'center', padding: '10px 8px',
            borderRight: `1px solid rgba(255,255,255,0.07)`,
          }}>
            <p style={{ fontSize: 9, fontFamily: T.mono, color: T.textSub, marginBottom: 4, letterSpacing: '0.08em' }}>
              {label}
            </p>
            <p style={{ fontSize: 11, fontFamily: T.mono, fontWeight: 700, color }}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Verification + copy */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', gap: 10, flexWrap: 'wrap',
      }}>
        <div style={{ minWidth: 0 }}>
          <p style={{
            fontSize: 10, fontFamily: T.mono, fontWeight: 700,
            color: run.verified ? T.green : T.textSub, marginBottom: 2,
          }}>
            {run.verified ? '✅ VERIFIED' : '⚠️ UNVERIFIED'}
          </p>
          <p style={{
            fontSize: 9, fontFamily: T.mono, color: T.textMut,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160,
          }}>
            {matchHash}
          </p>
        </div>
        <button
          onClick={handleCopy}
          style={{
            padding: '9px 16px', borderRadius: 8, cursor: 'pointer',
            fontSize: 11, fontFamily: T.mono, fontWeight: 700,
            background: copied ? T.green : 'rgba(255,255,255,0.05)',
            border: `1px solid ${copied ? T.green : T.borderM}`,
            color: copied ? '#000' : T.text,
            transition: 'all 0.2s ease', minHeight: 36, flexShrink: 0,
            boxShadow: copied ? `0 0 16px rgba(34,221,136,0.35)` : 'none',
          }}
        >
          {copied ? '✅ Copied!' : '📋 Copy Proof'}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SEASON BADGE
// ═══════════════════════════════════════════════════════════════════

interface SeasonBadgeProps {
  rank: number;
  rating: number;
  seasonName: string;
  grade: string;
  compact?: boolean;
}

export function SeasonBadge({ rank, rating, seasonName, grade, compact }: SeasonBadgeProps) {
  const gcfg = GRADE_CFG[grade as RunGrade] ?? GRADE_CFG['F'];

  if (compact) {
    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '5px 12px', borderRadius: 20,
        background: gcfg.bg, border: `1px solid ${gcfg.border}`,
        fontFamily: T.mono,
      }}>
        <style>{FONT_IMPORT}</style>
        <span style={{ fontSize: 13, fontWeight: 800, color: gcfg.color, fontFamily: T.display }}>
          {grade}
        </span>
        <span style={{ fontSize: 10, color: T.textMut }}>·</span>
        <span style={{ fontSize: 10, color: T.textSub }}>#{rank}</span>
        <span style={{ fontSize: 10, color: T.textMut }}>·</span>
        <span style={{ fontSize: 10, color: T.indigo, fontWeight: 700 }}>{rating}</span>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '12px 16px', borderRadius: 10,
      background: gcfg.bg, border: `1px solid ${gcfg.border}`,
      fontFamily: T.display,
    }}>
      <style>{FONT_IMPORT}</style>
      <div style={{
        fontSize: 28, fontWeight: 800, fontFamily: T.display, color: gcfg.color,
        textShadow: `0 0 20px ${gcfg.color}55`, lineHeight: 1,
      }}>
        {grade}
      </div>
      <div>
        <p style={{ fontSize: 12, fontWeight: 700, color: T.text, fontFamily: T.display, marginBottom: 3 }}>
          {seasonName}
        </p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 10, fontFamily: T.mono, color: T.textSub, fontWeight: 600 }}>
            #{rank} ladder
          </span>
          <span style={{ fontSize: 10, fontFamily: T.mono, color: T.indigo, fontWeight: 700 }}>
            {rating} ELO
          </span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ACHIEVEMENT BADGES
// ═══════════════════════════════════════════════════════════════════

const ACHIEVEMENT_META: Record<string, { icon: string; label: string; desc: string; color: string }> = {
  MILLENNIAL_MIND:  { icon: '🧠', label: 'Millennial Mind',    desc: 'Score 1000+ on a single run',           color: T.purple  },
  CONSISTENCY_KING: { icon: '👑', label: 'Consistency King',   desc: '75%+ win rate across 5+ runs',          color: T.yellow  },
  HOT_STREAK:       { icon: '🔥', label: 'Hot Streak',         desc: '5 consecutive cashflow-positive runs',  color: T.orange  },
  PERFECT_RUN:      { icon: '💎', label: 'Perfect Run',        desc: 'Grade A on any difficulty',             color: T.teal    },
  PHOENIX:          { icon: '🦅', label: 'Phoenix',            desc: 'Recover from distress and earn A',      color: T.orange  },
  IRON_RESERVE:     { icon: '🛡️', label: 'Iron Reserve',       desc: 'Maintain 25%+ liquidity all run',       color: T.indigo  },
  DIVERSIFIED:      { icon: '📊', label: 'Diversified',        desc: 'End with HHI below 25%',                color: T.blue    },
  BIAS_BREAKER:     { icon: '⚡', label: 'Bias Breaker',       desc: 'Clear 5 bias states in one run',        color: T.green   },
};

interface AchievementBadgesProps {
  achievements: string[];
}

export function AchievementBadges({ achievements }: AchievementBadgesProps) {
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 8,
      fontFamily: T.display,
    }}>
      <style>{FONT_IMPORT}</style>
      {achievements.map(id => {
        const meta = ACHIEVEMENT_META[id];
        if (!meta) return null;
        return (
          <div
            key={id}
            title={meta.desc}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '7px 12px', borderRadius: 20, cursor: 'help',
              background: `${meta.color}10`, border: `1px solid ${meta.color}30`,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLDivElement).style.background = `${meta.color}18`;
              (e.currentTarget as HTMLDivElement).style.border = `1px solid ${meta.color}50`;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLDivElement).style.background = `${meta.color}10`;
              (e.currentTarget as HTMLDivElement).style.border = `1px solid ${meta.color}30`;
            }}
          >
            <span style={{ fontSize: 14, lineHeight: 1 }}>{meta.icon}</span>
            <span style={{
              fontSize: 10, fontFamily: T.mono, fontWeight: 700,
              color: meta.color, letterSpacing: '0.04em',
            }}>
              {meta.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
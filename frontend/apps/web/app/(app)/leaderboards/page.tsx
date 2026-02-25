///Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/frontend/apps/web/app/(app)/leaderboards/page.tsx

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
// FIX [TS2614]: LadderTable is a default export — use default import syntax
import LadderTable from '../../../src/features/leaderboards/components/LadderTable';
import { EligibilityChecklistPanel } from '../../../src/features/leaderboards/components/EligibilityChecklistPanel';

// ── Types ─────────────────────────────────────────────────────────────────────

interface LeaderboardEntry {
  id:     number;
  name:   string;
  score:  number;
  status: 'active' | 'inactive' | 'banned';
  rank:   number;
  proofHash?: string;
}

interface EligibilityStatus {
  eligible:         boolean;
  totalRuns:        number;
  sportModeOptIn:   boolean;
  verifiedRunCount: number;
  reason?:          string;
}

type TabId = 'casual' | 'verified';

// ── Constants ─────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 10_000;

// ── Hook: eligibility ─────────────────────────────────────────────────────────

function useEligibility(playerId: string | null) {
  const [eligibility, setEligibility] = useState<EligibilityStatus | null>(null);
  const [loading, setLoading]         = useState(false);

  const check = useCallback(async () => {
    if (!playerId) return;
    setLoading(true);
    try {
      const { data } = await axios.get<EligibilityStatus>(
        `/api/leaderboards/verified/eligibility`,
        { params: { playerId } },
      );
      setEligibility(data);
    } catch {
      setEligibility({
        eligible:         false,
        totalRuns:        0,
        sportModeOptIn:   false,
        verifiedRunCount: 0,
        reason:           'Could not verify eligibility. Try again.',
      });
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  return { eligibility, checkEligibility: check, loading };
}

// ── Hook: ladder data ─────────────────────────────────────────────────────────

function useLadderEntries(tab: TabId, enabled: boolean) {
  const [entries, setEntries]   = useState<LeaderboardEntry[]>([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const fetchData = async () => {
      setFetching(true);
      try {
        const { data } = await axios.get<LeaderboardEntry[]>(
          `/api/leaderboards/${tab}`,
          { params: { limit: 100 } },
        );
        if (!cancelled) { setEntries(data); setError(null); }
      } catch {
        if (!cancelled) setError('Failed to load leaderboard. Retrying…');
      } finally {
        if (!cancelled) setFetching(false);
      }
    };

    fetchData();
    const id = setInterval(fetchData, POLL_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [tab, enabled]);

  return { entries, fetching, error };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LeaderboardsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('casual');

  const playerId = typeof window !== 'undefined'
    ? (localStorage.getItem('playerId') ?? null)
    : null;

  const { eligibility, checkEligibility, loading: eligLoading } = useEligibility(playerId);

  const handleTabClick = (tab: TabId) => {
    setActiveTab(tab);
    if (tab === 'verified' && eligibility === null) checkEligibility();
  };

  const casualData   = useLadderEntries('casual',   activeTab === 'casual');
  const verifiedData = useLadderEntries('verified',  activeTab === 'verified' && eligibility?.eligible === true);

  const isVerifiedLocked = eligibility !== null && !eligibility.eligible;

  return (
    <main className="leaderboards-page" style={{ padding: '1.5rem', maxWidth: 960, margin: '0 auto' }}>
      <h1 style={{ marginBottom: '1rem', fontSize: '1.5rem', fontWeight: 700 }}>
        Leaderboards
      </h1>

      {/* Tab bar */}
      <div
        role="tablist"
        style={{ display: 'flex', gap: 8, borderBottom: '2px solid #2a2a2a', marginBottom: '1.5rem' }}
      >
        <TabButton id="casual"   label="Casual"   active={activeTab === 'casual'}   locked={false}            onClick={() => handleTabClick('casual')} />
        <TabButton id="verified" label="Verified" active={activeTab === 'verified'} locked={isVerifiedLocked} onClick={() => handleTabClick('verified')} />
      </div>

      {/* Casual panel */}
      {activeTab === 'casual' && (
        <div role="tabpanel" aria-labelledby="tab-casual">
          {casualData.error && <p style={{ color: '#f87171', marginBottom: 8 }}>{casualData.error}</p>}
          {casualData.fetching && !casualData.entries.length
            ? <LoadingSkeleton />
            : <LadderTable data={casualData.entries} />
          }
        </div>
      )}

      {/* Verified panel */}
      {activeTab === 'verified' && (
        <div role="tabpanel" aria-labelledby="tab-verified">
          {eligLoading && <LoadingSkeleton />}

          {!eligLoading && isVerifiedLocked && (
            <div style={{ maxWidth: 480 }}>
              <p style={{ color: '#f87171', marginBottom: 12, fontWeight: 600 }}>
                {eligibility?.reason ?? 'You are not eligible for the Verified leaderboard.'}
              </p>
              <EligibilityChecklistPanel />
              <button
                onClick={checkEligibility}
                style={{ marginTop: 16, padding: '8px 18px', background: '#2563eb', color: '#fff', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600 }}
              >
                Re-check eligibility
              </button>
            </div>
          )}

          {!eligLoading && eligibility?.eligible && (
            <>
              {verifiedData.error && <p style={{ color: '#f87171', marginBottom: 8 }}>{verifiedData.error}</p>}
              {verifiedData.fetching && !verifiedData.entries.length
                ? <LoadingSkeleton />
                : <LadderTable data={verifiedData.entries} />
              }
            </>
          )}
        </div>
      )}
    </main>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

interface TabButtonProps {
  id:      TabId;
  label:   string;
  active:  boolean;
  locked:  boolean;
  onClick: () => void;
}

const TabButton: React.FC<TabButtonProps> = ({ id, label, active, locked, onClick }) => (
  <button
    id={`tab-${id}`}
    role="tab"
    aria-selected={active}
    aria-disabled={locked}
    onClick={onClick}
    style={{
      padding: '8px 20px',
      fontWeight: active ? 700 : 500,
      background: 'none',
      border: 'none',
      borderBottom: `2px solid ${active ? '#2563eb' : 'transparent'}`,
      cursor: 'pointer',
      opacity: locked ? 0.45 : 1,
      color: active ? '#2563eb' : '#9ca3af',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
    }}
  >
    {label}
    {locked && <span title="Not eligible for Verified ladder" style={{ fontSize: 12, opacity: 0.8 }} aria-label="Locked">🔒</span>}
  </button>
);

const LoadingSkeleton: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
    {[...Array(8)].map((_, i) => (
      <div key={i} style={{ height: 36, borderRadius: 6, background: '#1f1f1f', animation: 'pulse 1.4s ease-in-out infinite', opacity: 0.6 - i * 0.05 }} />
    ))}
  </div>
);

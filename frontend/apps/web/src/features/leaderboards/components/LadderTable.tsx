/**
 * LadderTable
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/frontend/apps/web/src/features/leaderboards/components/LadderTable.tsx
 *
 * Default export — fixes TS2614 (page imported as named, component was default).
 */

import React from 'react';

export interface LeaderboardEntry {
  id:         number;
  name:       string;
  score:      number;
  status:     'active' | 'inactive' | 'banned';
  rank:       number;
  proofHash?: string;
}

interface LadderTableProps {
  data: LeaderboardEntry[];
}

const gradeFromScore = (score: number): string => {
  if (score >= 120) return 'A';
  if (score >= 90)  return 'B';
  if (score >= 60)  return 'C';
  if (score >= 30)  return 'D';
  return 'F';
};

const LadderTable: React.FC<LadderTableProps> = ({ data }) => {
  if (!data.length) {
    return (
      <p style={{ color: '#6b7280', padding: '2rem 0', textAlign: 'center' }}>
        No entries yet. Be the first to claim a rank.
      </p>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '0.875rem',
          color: '#e5e7eb',
        }}
      >
        <thead>
          <tr style={{ borderBottom: '1px solid #374151', color: '#9ca3af', textAlign: 'left' }}>
            <th style={{ padding: '8px 12px', width: 48 }}>Rank</th>
            <th style={{ padding: '8px 12px' }}>Player</th>
            <th style={{ padding: '8px 12px', textAlign: 'right' }}>CORD Score</th>
            <th style={{ padding: '8px 12px', textAlign: 'center' }}>Grade</th>
            <th style={{ padding: '8px 12px', textAlign: 'center' }}>Verified</th>
          </tr>
        </thead>
        <tbody>
          {data.map((entry) => (
            <tr
              key={entry.id}
              style={{
                borderBottom: '1px solid #1f2937',
                background: entry.rank <= 3 ? 'rgba(37,99,235,0.06)' : 'transparent',
              }}
            >
              <td style={{ padding: '10px 12px', fontWeight: 700, color: rankColor(entry.rank) }}>
                {entry.rank <= 3 ? rankMedal(entry.rank) : `#${entry.rank}`}
              </td>
              <td style={{ padding: '10px 12px', fontWeight: 500 }}>{entry.name}</td>
              <td style={{ padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {entry.score.toFixed(2)}
              </td>
              <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    background: gradeBackground(gradeFromScore(entry.score)),
                    color: '#fff',
                  }}
                >
                  {gradeFromScore(entry.score)}
                </span>
              </td>
              <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                {entry.proofHash ? (
                  <span title={`proof: ${entry.proofHash}`} style={{ color: '#34d399' }}>✓</span>
                ) : (
                  <span style={{ color: '#4b5563' }}>—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

function rankColor(rank: number): string {
  if (rank === 1) return '#fbbf24';
  if (rank === 2) return '#d1d5db';
  if (rank === 3) return '#c2724f';
  return '#6b7280';
}

function rankMedal(rank: number): string {
  if (rank === 1) return '🥇 1';
  if (rank === 2) return '🥈 2';
  return '🥉 3';
}

function gradeBackground(grade: string): string {
  const map: Record<string, string> = {
    A: '#059669', B: '#2563eb', C: '#d97706', D: '#dc2626', F: '#7f1d1d',
  };
  return map[grade] ?? '#374151';
}

export default LadderTable;

/**
 * ============================================================================
 * FILE: pzo_client/src/components/chat/AlliancePanel.tsx
 * Point Zero One — Alliance HQ Panel
 * 
 * Tabs: ROSTER | VAULT | AID | APPLICATIONS | WAR | SETTINGS
 * Features: Rank badges, promote/demote buttons, vault contribution bar,
 *           aid request feed, application accept/reject, war status panel
 * ============================================================================
 */

import React, { useState, useEffect, useCallback } from 'react';
import type {
  Alliance, AllianceMember, AidRequest,
  AllianceApplication, AllianceRank, AllianceWar,
} from '../../../shared/contracts/multiplayer';
import { RANK_LABELS, RANK_NUM } from '../../../shared/contracts/multiplayer';

// ─── RANK CONFIG ─────────────────────────────────────────────────────────────

const RANK_COLORS: Record<AllianceRank, string> = {
  R5: '#FFD700', R4: '#C0C0C0', R3: '#CD7F32', R2: '#4FC3F7', R1: '#78909C',
};

const PRESENCE_COLORS = { ONLINE: '#4CAF50', AWAY: '#FFC107', OFFLINE: '#555' } as const;

// ─── PROPS ────────────────────────────────────────────────────────────────────

interface AlliancePanelProps {
  alliance:      Alliance;
  roster:        AllianceMember[];
  applications:  AllianceApplication[];
  aidRequests:   AidRequest[];
  currentWar:    AllianceWar | null;
  myRank:        AllianceRank;
  myId:          string;
  onPromote:     (targetId: string) => Promise<void>;
  onDemote:      (targetId: string) => Promise<void>;
  onKick:        (targetId: string) => Promise<void>;
  onAcceptApp:   (appId: string) => Promise<void>;
  onRejectApp:   (appId: string) => Promise<void>;
  onContribute:  (amount: number) => Promise<void>;
  onRequestAid:  (type: 'COINS' | 'BOOST' | 'SHIELD', amount: number) => Promise<void>;
  onOpenDM:      (playerId: string, playerName: string) => void;
  onClose:       () => void;
  onUpdateSettings?: (settings: Partial<Alliance>) => Promise<void>;
}

type Tab = 'ROSTER' | 'VAULT' | 'AID' | 'APPLICATIONS' | 'WAR' | 'SETTINGS';

// ─── RANK BADGE ───────────────────────────────────────────────────────────────

function RankBadge({ rank, size = 'sm' }: { rank: AllianceRank; size?: 'sm' | 'lg' }) {
  const fontSize = size === 'lg' ? '11px' : '9px';
  const padding  = size === 'lg' ? '2px 8px' : '1px 5px';
  return (
    <span style={{
      display:       'inline-block',
      fontSize,
      fontWeight:    700,
      padding,
      borderRadius:  4,
      background:    RANK_COLORS[rank],
      color:         rank === 'R5' || rank === 'R4' ? '#000' : '#fff',
      letterSpacing: '0.5px',
    }}>
      {rank}
    </span>
  );
}

// ─── PRESENCE DOT ─────────────────────────────────────────────────────────────

function PresenceDot({ isOnline, lastActive }: { isOnline: boolean; lastActive: string }) {
  const lastDate = new Date(lastActive);
  const diffMins = (Date.now() - lastDate.getTime()) / 60_000;
  const status   = isOnline ? 'ONLINE' : diffMins < 30 ? 'AWAY' : 'OFFLINE';
  return (
    <span title={status} style={{
      display:     'inline-block',
      width:       8,
      height:      8,
      borderRadius: '50%',
      background:  PRESENCE_COLORS[status],
      flexShrink:  0,
    }} />
  );
}

// ─── VAULT BAR ────────────────────────────────────────────────────────────────

function VaultBar({ current, capacity }: { current: number; capacity: number }) {
  const pct = Math.min((current / capacity) * 100, 100);
  return (
    <div style={{ position: 'relative', background: '#1E1E2E', borderRadius: 4, height: 12, overflow: 'hidden' }}>
      <div style={{
        position:   'absolute', left: 0, top: 0, bottom: 0,
        width:      `${pct}%`,
        background: 'linear-gradient(90deg, #FFD700, #FFA000)',
        transition: 'width 0.5s',
      }} />
      <span style={{
        position:  'absolute', right: 4, top: 0, bottom: 0,
        display:   'flex', alignItems: 'center',
        fontSize:  '9px', color: '#fff', fontWeight: 700,
      }}>
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}

// ─── AID REQUEST ROW ─────────────────────────────────────────────────────────

function AidRow({ req }: { req: AidRequest }) {
  const pct  = Math.min((req.fulfilled / req.target) * 100, 100);
  const icon = req.type === 'COINS' ? '💰' : req.type === 'BOOST' ? '⚡' : '🛡';
  const expires = new Date(req.expiresAt);
  const minsLeft = Math.max(0, Math.floor((expires.getTime() - Date.now()) / 60_000));
  return (
    <div style={{ background: '#1A1A2E', borderRadius: 6, padding: '6px 10px', marginBottom: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: '11px', color: '#E0E0E0' }}>
          {icon} {req.requesterName} needs {req.type}
        </span>
        <span style={{ fontSize: '10px', color: '#666' }}>{minsLeft}m left</span>
      </div>
      <div style={{ background: '#111', borderRadius: 3, height: 6, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: '#4CAF50', transition: 'width 0.3s' }} />
      </div>
      <div style={{ fontSize: '9px', color: '#888', marginTop: 2 }}>
        {req.fulfilled.toLocaleString()} / {req.target.toLocaleString()}
      </div>
    </div>
  );
}

// ─── WAR STATUS PANEL ─────────────────────────────────────────────────────────

function WarStatusPanel({ war, allianceId }: { war: AllianceWar; allianceId: string }) {
  const isAttacker  = war.attackerId === allianceId;
  const myPoints    = isAttacker ? war.attackerPoints : war.defenderPoints;
  const theirPoints = isAttacker ? war.defenderPoints : war.attackerPoints;
  const myTag       = isAttacker ? war.attackerTag    : war.defenderTag;
  const theirTag    = isAttacker ? war.defenderTag    : war.attackerTag;

  const total    = myPoints + theirPoints || 1;
  const myPct    = (myPoints / total) * 100;

  const STATUS_COLORS: Record<string, string> = {
    DECLARED: '#FFA726', PREPARATION: '#FFCC02', ACTIVE: '#EF5350', SETTLEMENT: '#9E9E9E', ENDED: '#555',
  };

  const endsAt  = new Date(war.endsAt);
  const minsLeft = Math.max(0, Math.floor((endsAt.getTime() - Date.now()) / 60_000));
  const hoursLeft = Math.floor(minsLeft / 60);
  const minsRem   = minsLeft % 60;

  return (
    <div style={{ background: '#1A1A2E', borderRadius: 8, padding: 12 }}>
      {/* Status badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{
          fontSize: '10px', fontWeight: 700, letterSpacing: '1px',
          color: STATUS_COLORS[war.status] ?? '#fff',
        }}>
          ⚔️ WAR — {war.status}
        </span>
        {war.status === 'ACTIVE' && (
          <span style={{ fontSize: '10px', color: '#EF5350', fontWeight: 700 }}>
            {hoursLeft}h {minsRem}m remaining
          </span>
        )}
      </div>

      {/* Score bar */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <span style={{ fontSize: '11px', color: '#FFD700', fontWeight: 700 }}>
            [{myTag}] {myPoints.toLocaleString()}
          </span>
          <span style={{ fontSize: '10px', color: '#888' }}>vs</span>
          <span style={{ fontSize: '11px', color: '#EF5350', fontWeight: 700 }}>
            {theirPoints.toLocaleString()} [{theirTag}]
          </span>
        </div>
        <div style={{ position: 'relative', background: '#EF5350', borderRadius: 4, height: 10, overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: `${myPct}%`,
            background: '#FFD700',
            transition: 'width 0.5s',
          }} />
        </div>
      </div>

      {/* Proof hash if ended */}
      {war.outcome && war.proofHash && (
        <div style={{ fontSize: '9px', color: '#666', marginTop: 6 }}>
          Outcome: <strong style={{ color: '#fff' }}>{war.outcome}</strong> — Proof: {war.proofHash.slice(0, 16)}...
        </div>
      )}
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function AlliancePanel({
  alliance, roster, applications, aidRequests, currentWar,
  myRank, myId,
  onPromote, onDemote, onKick, onAcceptApp, onRejectApp,
  onContribute, onRequestAid, onOpenDM, onClose, onUpdateSettings,
}: AlliancePanelProps) {
  const [activeTab, setActiveTab]         = useState<Tab>('ROSTER');
  const [contributeAmt, setContributeAmt] = useState('');
  const [aidType, setAidType]             = useState<'COINS' | 'BOOST' | 'SHIELD'>('COINS');
  const [aidAmount, setAidAmount]         = useState('');
  const [loading, setLoading]             = useState<string | null>(null);
  const [search, setSearch]               = useState('');

  const myRankNum = RANK_NUM[myRank];

  const filteredRoster = roster.filter(m =>
    !search || m.displayName.toLowerCase().includes(search.toLowerCase())
  );

  // Sort: R5 → R4 → R3 → R2 → R1, then online, then war points
  const sortedRoster = [...filteredRoster].sort((a, b) => {
    if (RANK_NUM[b.rank] !== RANK_NUM[a.rank]) return RANK_NUM[b.rank] - RANK_NUM[a.rank];
    if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
    return b.warPoints - a.warPoints;
  });

  const withLoading = useCallback(async (key: string, fn: () => Promise<void>) => {
    setLoading(key);
    try { await fn(); }
    finally { setLoading(null); }
  }, []);

  const TABS: Array<{ key: Tab; label: string; badge?: number }> = [
    { key: 'ROSTER',       label: `👥 Roster (${roster.length}/${alliance.capacity})` },
    { key: 'VAULT',        label: `🏦 Vault` },
    { key: 'AID',          label: `🤝 Aid`, badge: aidRequests.length },
    { key: 'APPLICATIONS', label: `📋 Apps`, badge: myRankNum >= 4 ? applications.length : undefined },
    { key: 'WAR',          label: `⚔️ War` },
    ...(myRankNum >= 5 ? [{ key: 'SETTINGS' as Tab, label: '⚙️' }] : []),
  ];

  return (
    <div style={{
      position:      'fixed',
      top:           '50%',
      left:          '50%',
      transform:     'translate(-50%, -50%)',
      width:         420,
      maxHeight:     560,
      background:    'rgba(8, 8, 18, 0.97)',
      border:        '1px solid #2A2A3E',
      borderRadius:  12,
      display:       'flex',
      flexDirection: 'column',
      zIndex:        2000,
      boxShadow:     '0 16px 48px rgba(0,0,0,0.8)',
      fontFamily:    '"Inter", "Segoe UI", sans-serif',
      overflow:      'hidden',
    }}>

      {/* ── Header ── */}
      <div style={{
        display:    'flex',
        alignItems: 'center',
        padding:    '10px 14px',
        background: '#0D0D1E',
        borderBottom: '1px solid #1E1E2E',
        gap: 10,
        flexShrink: 0,
      }}>
        {/* Banner icon */}
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: `linear-gradient(135deg, ${alliance.banner.colorPrimary}, ${alliance.banner.colorSecondary})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, flexShrink: 0,
        }}>
          👑
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: '#FFD700', fontWeight: 700, fontSize: 14 }}>
              [{alliance.tag}]
            </span>
            <span style={{ color: '#E0E0E0', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {alliance.name}
            </span>
          </div>
          <div style={{ fontSize: '10px', color: '#666' }}>
            Lv.{alliance.level} · {alliance.memberCount}/{alliance.capacity} members · My rank: <RankBadge rank={myRank} />
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', fontSize: 18 }}>
          ✕
        </button>
      </div>

      {/* ── Tabs ── */}
      <div style={{
        display:    'flex',
        borderBottom: '1px solid #1E1E2E',
        background: '#0D0D1E',
        flexShrink: 0,
        overflowX:  'auto',
        scrollbarWidth: 'none',
      }}>
        {TABS.map(tab => (
          <button key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              background:   activeTab === tab.key ? '#1A1A2E' : 'transparent',
              border:       'none',
              borderBottom: activeTab === tab.key ? '2px solid #FFD700' : '2px solid transparent',
              color:        activeTab === tab.key ? '#FFD700' : '#666',
              padding:      '7px 10px',
              fontSize:     '10px',
              fontWeight:   activeTab === tab.key ? 700 : 400,
              cursor:       'pointer',
              whiteSpace:   'nowrap',
              position:     'relative',
            }}
          >
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span style={{
                position: 'absolute', top: 2, right: 2,
                background: '#EF5350', color: '#fff',
                fontSize: '8px', fontWeight: 700,
                borderRadius: '50%', width: 14, height: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {tab.badge > 9 ? '9+' : tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', scrollbarWidth: 'thin', scrollbarColor: '#333 transparent' }}>

        {/* ── ROSTER TAB ── */}
        {activeTab === 'ROSTER' && (
          <div>
            <input
              placeholder="Search members..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: '#1A1A2E', border: '1px solid #333',
                borderRadius: 6, padding: '5px 10px',
                color: '#E0E0E0', fontSize: '11px', outline: 'none',
                marginBottom: 8,
              }}
            />

            {sortedRoster.map(member => {
              const isMe       = member.userId === myId;
              const canPromote = !isMe && myRankNum > RANK_NUM[member.rank] + 1 && RANK_NUM[member.rank] < 4;
              const canDemote  = !isMe && myRankNum > RANK_NUM[member.rank] && myRankNum >= 4 && RANK_NUM[member.rank] > 1;
              const canKick    = !isMe && myRankNum > RANK_NUM[member.rank] && myRankNum >= 4;

              return (
                <div key={member.userId} style={{
                  display:    'flex',
                  alignItems: 'center',
                  padding:    '7px 8px',
                  borderRadius: 6,
                  marginBottom: 2,
                  background: isMe ? 'rgba(255,215,0,0.05)' : 'transparent',
                  border:     isMe ? '1px solid rgba(255,215,0,0.15)' : '1px solid transparent',
                  gap: 8,
                }}>
                  {/* Presence */}
                  <PresenceDot isOnline={member.isOnline} lastActive={member.lastActive} />

                  {/* Rank badge */}
                  <RankBadge rank={member.rank} />

                  {/* Name + stats */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '11px', color: isMe ? '#FFD700' : '#E0E0E0', fontWeight: isMe ? 700 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {member.displayName}{isMe ? ' (you)' : ''}
                    </div>
                    <div style={{ fontSize: '9px', color: '#555' }}>
                      {member.warPoints.toLocaleString()} war pts · Joined {new Date(member.joinedAt).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                    {!isMe && (
                      <button onClick={() => onOpenDM(member.userId, member.displayName)} title="DM"
                        style={actionBtn('#1E1E2E')}>💬</button>
                    )}
                    {canPromote && (
                      <button
                        onClick={() => withLoading(`promote_${member.userId}`, () => onPromote(member.userId))}
                        disabled={!!loading}
                        title={`Promote to ${nextRank(member.rank)}`}
                        style={actionBtn('#1B5E20')}
                      >▲</button>
                    )}
                    {canDemote && (
                      <button
                        onClick={() => withLoading(`demote_${member.userId}`, () => onDemote(member.userId))}
                        disabled={!!loading}
                        title={`Demote to ${prevRank(member.rank)}`}
                        style={actionBtn('#4A0000')}
                      >▼</button>
                    )}
                    {canKick && (
                      <button
                        onClick={() => {
                          if (confirm(`Kick ${member.displayName}?`)) {
                            withLoading(`kick_${member.userId}`, () => onKick(member.userId));
                          }
                        }}
                        disabled={!!loading}
                        title="Kick"
                        style={actionBtn('#4A0000')}
                      >✕</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── VAULT TAB ── */}
        {activeTab === 'VAULT' && (
          <div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: '12px', color: '#FFD700', fontWeight: 700, marginBottom: 4 }}>
                Alliance Vault
              </div>
              <div style={{ fontSize: '24px', color: '#E0E0E0', fontWeight: 700, marginBottom: 4 }}>
                💰 {alliance.vault.toLocaleString()} coins
              </div>
              <VaultBar current={alliance.vault} capacity={5_000_000} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: '11px', color: '#999', marginBottom: 6 }}>Contribute coins:</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[1000, 5000, 25000].map(amt => (
                  <button key={amt}
                    onClick={() => withLoading('contribute', () => onContribute(amt))}
                    disabled={!!loading}
                    style={goldBtn()}
                  >
                    +{(amt/1000).toFixed(0)}k
                  </button>
                ))}
                <input
                  type="number"
                  placeholder="Custom"
                  value={contributeAmt}
                  onChange={e => setContributeAmt(e.target.value)}
                  style={{
                    flex: 1, background: '#1A1A2E', border: '1px solid #333',
                    borderRadius: 6, padding: '4px 8px', color: '#E0E0E0', fontSize: '11px', outline: 'none',
                  }}
                />
                <button
                  onClick={() => {
                    const amt = parseInt(contributeAmt);
                    if (amt > 0) withLoading('contribute_custom', () => onContribute(amt));
                  }}
                  disabled={!!loading || !contributeAmt}
                  style={goldBtn()}
                >
                  ✓
                </button>
              </div>
            </div>

            {/* Top contributors */}
            <div>
              <div style={{ fontSize: '11px', color: '#666', marginBottom: 6 }}>Top Contributors:</div>
              {[...roster].sort((a,b) => b.totalContributed - a.totalContributed).slice(0, 5).map((m, i) => (
                <div key={m.userId} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: '11px' }}>
                  <span style={{ color: i === 0 ? '#FFD700' : '#999' }}>#{i+1} {m.displayName}</span>
                  <span style={{ color: '#E0E0E0' }}>💰 {m.totalContributed.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── AID TAB ── */}
        {activeTab === 'AID' && (
          <div>
            {/* Request aid */}
            <div style={{ background: '#1A1A2E', borderRadius: 8, padding: 10, marginBottom: 10 }}>
              <div style={{ fontSize: '11px', color: '#FFD700', fontWeight: 700, marginBottom: 6 }}>Request Aid:</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                {(['COINS', 'BOOST', 'SHIELD'] as const).map(t => (
                  <button key={t}
                    onClick={() => setAidType(t)}
                    style={{
                      flex: 1,
                      background: aidType === t ? '#FFD700' : '#0D0D1E',
                      color: aidType === t ? '#000' : '#888',
                      border: 'none', borderRadius: 5, padding: '4px 0',
                      fontSize: '10px', fontWeight: aidType === t ? 700 : 400, cursor: 'pointer',
                    }}
                  >
                    {t === 'COINS' ? '💰 Coins' : t === 'BOOST' ? '⚡ Boost' : '🛡 Shield'}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="number"
                  placeholder={aidType === 'COINS' ? 'Amount' : '1'}
                  value={aidAmount}
                  onChange={e => setAidAmount(e.target.value)}
                  style={{
                    flex: 1, background: '#0D0D1E', border: '1px solid #333',
                    borderRadius: 5, padding: '5px 8px', color: '#E0E0E0', fontSize: '11px', outline: 'none',
                  }}
                />
                <button
                  onClick={() => {
                    const amt = parseInt(aidAmount) || 1;
                    withLoading('aid_request', () => onRequestAid(aidType, amt));
                    setAidAmount('');
                  }}
                  disabled={!!loading}
                  style={goldBtn('flex')}
                >
                  Request
                </button>
              </div>
            </div>

            {/* Open requests */}
            <div style={{ fontSize: '11px', color: '#666', marginBottom: 6 }}>
              Open Requests ({aidRequests.length}):
            </div>
            {aidRequests.length === 0 && (
              <div style={{ color: '#444', fontSize: '11px', textAlign: 'center', padding: 20 }}>
                No open aid requests.
              </div>
            )}
            {aidRequests.map(req => <AidRow key={req.id} req={req} />)}
          </div>
        )}

        {/* ── APPLICATIONS TAB ── */}
        {activeTab === 'APPLICATIONS' && (
          <div>
            {myRankNum < 4 ? (
              <div style={{ color: '#666', fontSize: '11px', textAlign: 'center', padding: 20 }}>
                R4+ required to manage applications.
              </div>
            ) : applications.length === 0 ? (
              <div style={{ color: '#444', fontSize: '11px', textAlign: 'center', padding: 20 }}>
                No pending applications.
              </div>
            ) : (
              applications.map(app => (
                <div key={app.id} style={{ background: '#1A1A2E', borderRadius: 8, padding: 10, marginBottom: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: '12px', color: '#E0E0E0', fontWeight: 600 }}>
                      {app.userName}
                    </span>
                    <span style={{ fontSize: '10px', color: '#666' }}>
                      {new Date(app.appliedAt).toLocaleDateString()}
                    </span>
                  </div>
                  {app.message && (
                    <div style={{ fontSize: '11px', color: '#999', marginBottom: 8, fontStyle: 'italic' }}>
                      "{app.message}"
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => withLoading(`accept_${app.id}`, () => onAcceptApp(app.id))}
                      disabled={!!loading}
                      style={{ ...goldBtn(), flex: 1 }}
                    >
                      ✓ Accept
                    </button>
                    <button
                      onClick={() => withLoading(`reject_${app.id}`, () => onRejectApp(app.id))}
                      disabled={!!loading}
                      style={{ flex: 1, background: '#4A0000', border: 'none', borderRadius: 5, color: '#EF9A9A', fontSize: '11px', padding: '5px 0', cursor: 'pointer' }}
                    >
                      ✕ Reject
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── WAR TAB ── */}
        {activeTab === 'WAR' && (
          <div>
            {currentWar ? (
              <WarStatusPanel war={currentWar as AllianceWar} allianceId={alliance.id} />
            ) : (
              <div style={{ textAlign: 'center', padding: 20 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>⚔️</div>
                <div style={{ color: '#666', fontSize: '12px' }}>No active war.</div>
                {myRankNum >= 5 && (
                  <div style={{ marginTop: 12, fontSize: '11px', color: '#999' }}>
                    As R5 Sovereign, you can declare war from an alliance's profile.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── SETTINGS TAB (R5 only) ── */}
        {activeTab === 'SETTINGS' && myRankNum >= 5 && (
          <div style={{ fontSize: '11px', color: '#999' }}>
            <div style={{ color: '#FFD700', fontWeight: 700, fontSize: '12px', marginBottom: 10 }}>
              Alliance Settings
            </div>
            <div style={{ color: '#666', fontSize: '11px' }}>
              Settings editor — wire to <code>onUpdateSettings</code> callback.<br/>
              Fields: Name, Description, Open/Closed, Min Level, Language, Banner colors.
            </div>
            {/* Settings form implementation stub — extend as needed */}
            <div style={{ marginTop: 10, padding: 8, background: '#1A1A2E', borderRadius: 6, fontSize: '10px', color: '#555' }}>
              Extend this section with controlled inputs for alliance settings.
              Call <code>onUpdateSettings(&#123;...&#125;)</code> on save.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── STYLE HELPERS ────────────────────────────────────────────────────────────

function actionBtn(bg: string): React.CSSProperties {
  return {
    background: bg, border: 'none', borderRadius: 4,
    color: '#E0E0E0', fontSize: '11px', cursor: 'pointer',
    width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 0,
  };
}

function goldBtn(display?: string): React.CSSProperties {
  return {
    background: '#FFD700', border: 'none', borderRadius: 5,
    color: '#000', fontSize: '11px', fontWeight: 700,
    padding: '5px 10px', cursor: 'pointer',
    display: display as React.CSSProperties['display'],
  };
}

function nextRank(rank: AllianceRank): AllianceRank {
  const n = RANK_NUM[rank];
  const next = Object.entries(RANK_NUM).find(([, v]) => v === n + 1);
  return (next?.[0] ?? rank) as AllianceRank;
}

function prevRank(rank: AllianceRank): AllianceRank {
  const n = RANK_NUM[rank];
  const prev = Object.entries(RANK_NUM).find(([, v]) => v === n - 1);
  return (prev?.[0] ?? rank) as AllianceRank;
}

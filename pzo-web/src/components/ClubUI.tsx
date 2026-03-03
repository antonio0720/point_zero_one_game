/**
 * ClubUI.tsx — PZO Sprint 7
 * MarketRowDisplay · InteractionPanel · ClubScoreboard · ModeratorPresetSelector
 *
 * Rebuilt: Syne + IBM Plex Mono · Inline styles · Mobile-first · High contrast
 * 20M-player scale — no Tailwind dependency, no external CSS.
 * Density6 LLC · Confidential
 */

'use client';

import React, { useState } from 'react';
import type { Card } from './CardHand';
import type {
  MarketRowState,
  MarketRowCard,
  InteractionCard,
  ClubPlayer,
  ModeratorRuleSet,
  InteractionCardType,
} from '../types/club';
import { MODERATOR_RULE_SETS } from '../types/club';

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  void:    '#030308',
  card:    '#0C0C1E',
  cardHi:  '#131328',
  surface: '#0A0A18',
  border:  'rgba(255,255,255,0.08)',
  borderM: 'rgba(255,255,255,0.14)',
  borderB: 'rgba(255,255,255,0.22)',
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

// ─── Font import (injected once) ──────────────────────────────────────────────
const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');*{box-sizing:border-box;}`;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  const s = n < 0 ? '-' : '', v = Math.abs(n);
  if (v >= 1_000_000) return `${s}$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1_000)     return `${s}$${(v / 1e3).toFixed(0)}K`;
  return `${s}$${v.toLocaleString()}`;
}

function timeBar(currentTick: number, expiresAtTick: number, addedAtTick: number): number {
  const total     = expiresAtTick - addedAtTick;
  const remaining = expiresAtTick - currentTick;
  return Math.max(0, Math.min(1, remaining / Math.max(1, total)));
}

// ─── Panel wrapper ────────────────────────────────────────────────────────────
function Panel({
  children, style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
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
      <span style={{ fontSize: 12, fontWeight: 700, color: T.text, fontFamily: T.display }}>
        {children}
      </span>
      {right}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 9, fontFamily: T.mono, fontWeight: 700,
      letterSpacing: '0.18em', textTransform: 'uppercase',
      color: T.textSub, marginBottom: 8,
    }}>
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MARKET ROW DISPLAY
// ═══════════════════════════════════════════════════════════════════

export interface MarketRowDisplayProps {
  marketRow: MarketRowState;
  currentTick: number;
  playerCash: number;
  playerId: string;
  onClaim: (marketCardId: string) => void;
  onBid: (marketCardId: string, amount: number) => void;
}

// ─── Single market slot ───────────────────────────────────────────────────────
function MarketSlot({
  slot, currentTick, playerCash, playerId, onClaim, onBid,
}: {
  slot: MarketRowCard; currentTick: number; playerCash: number;
  playerId: string;
  onClaim: (id: string) => void; onBid: (id: string, amount: number) => void;
}) {
  const [showBid,   setShowBid]   = useState(false);
  const [bidAmount, setBidAmount] = useState(0);

  const claimed       = !!slot.claimedByPlayerId;
  const claimedByMe   = slot.claimedByPlayerId === playerId;
  const claimedByAI   = slot.claimedByPlayerId === 'AI_COMPETITOR';
  const expired       = slot.expiresAtTick <= currentTick && !claimed;
  const cost          = slot.minBidCash ?? slot.card.energyCost;
  const canAfford     = playerCash >= cost;
  const isBidSlot     = slot.minBidCash !== null;
  const timeLeft      = timeBar(currentTick, slot.expiresAtTick, slot.addedAtTick);

  const borderColor = claimedByMe ? T.green
    : claimed   ? T.textMut
    : expired   ? T.textMut
    : canAfford ? `${T.indigo}66`
    : T.textMut;

  const bgColor = claimedByMe ? 'rgba(34,221,136,0.06)'
    : claimed   ? 'rgba(255,255,255,0.02)'
    : 'rgba(255,255,255,0.03)';

  return (
    <div style={{
      borderRadius: 10, border: `1px solid ${borderColor}`,
      background: bgColor, overflow: 'hidden',
      opacity: (claimed && !claimedByMe) || expired ? 0.45 : 1,
      transition: 'all 0.2s ease',
    }}>
      {/* Time bar */}
      {!claimed && !expired && (
        <div style={{ height: 3, background: 'rgba(255,255,255,0.06)' }}>
          <div style={{
            height: '100%',
            width: `${timeLeft * 100}%`,
            background: timeLeft > 0.5 ? T.green : timeLeft > 0.25 ? T.orange : T.red,
            transition: 'width 0.4s ease, background 0.4s ease',
          }} />
        </div>
      )}

      <div style={{ padding: '10px 12px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ flex: 1, minWidth: 0, marginRight: 6 }}>
            <p style={{
              fontSize: 11, fontWeight: 700, color: T.text, fontFamily: T.display,
              lineHeight: 1.3, marginBottom: 2,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {slot.card.name}
            </p>
            {slot.card.subtype && (
              <p style={{ fontSize: 9, color: T.textSub, fontFamily: T.mono }}>
                {slot.card.subtype}
              </p>
            )}
          </div>
          {isBidSlot && (
            <span style={{
              fontSize: 9, fontFamily: T.mono, fontWeight: 700, flexShrink: 0,
              padding: '2px 6px', borderRadius: 4,
              background: 'rgba(255,215,0,0.12)', border: '1px solid rgba(255,215,0,0.25)',
              color: T.yellow,
            }}>
              BID
            </span>
          )}
        </div>

        {/* Key stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 8 }}>
          {slot.card.cashflowMonthly !== null && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 9, fontFamily: T.mono, color: T.textSub }}>CF/mo</span>
              <span style={{ fontSize: 10, fontFamily: T.mono, fontWeight: 700, color: T.green }}>
                +{fmt(slot.card.cashflowMonthly)}
              </span>
            </div>
          )}
          {slot.card.roiPct !== null && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 9, fontFamily: T.mono, color: T.textSub }}>ROI</span>
              <span style={{ fontSize: 10, fontFamily: T.mono, color: T.textSub }}>
                {slot.card.roiPct}%
              </span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 9, fontFamily: T.mono, color: T.textSub }}>Cost</span>
            <span style={{
              fontSize: 10, fontFamily: T.mono, fontWeight: 700,
              color: canAfford ? T.text : T.red,
            }}>
              {fmt(cost)}
            </span>
          </div>
        </div>

        {/* Action */}
        {claimed ? (
          <div style={{
            padding: '6px 8px', borderRadius: 7, textAlign: 'center',
            fontSize: 10, fontFamily: T.mono, fontWeight: 700,
            background: claimedByMe ? 'rgba(34,221,136,0.10)' : claimedByAI ? 'rgba(255,77,77,0.10)' : 'rgba(255,255,255,0.04)',
            color: claimedByMe ? T.green : claimedByAI ? T.red : T.textMut,
          }}>
            {claimedByMe ? '✅ Yours' : claimedByAI ? '🤖 AI Claimed' : '🔒 Claimed'}
          </div>
        ) : expired ? (
          <div style={{
            textAlign: 'center', fontSize: 10, color: T.textMut, fontFamily: T.mono,
            padding: '6px 0',
          }}>
            Expired
          </div>
        ) : isBidSlot ? (
          showBid ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <input
                type="number" value={bidAmount}
                onChange={e => setBidAmount(Number(e.target.value))}
                min={slot.minBidCash ?? 0} step={500}
                placeholder={`Min: ${fmt(slot.minBidCash ?? 0)}`}
                style={{
                  width: '100%', padding: '7px 8px', borderRadius: 7,
                  background: 'rgba(255,255,255,0.05)', border: `1px solid ${T.borderM}`,
                  color: T.text, fontSize: 11, fontFamily: T.mono, outline: 'none',
                  minHeight: 34,
                }}
              />
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => { onBid(slot.id, bidAmount); setShowBid(false); }}
                  disabled={bidAmount < (slot.minBidCash ?? 0) || playerCash < bidAmount}
                  style={{
                    flex: 1, padding: '7px 0', borderRadius: 7, cursor: 'pointer',
                    fontSize: 10, fontFamily: T.mono, fontWeight: 700,
                    background: T.indigo, border: 'none', color: '#000',
                    opacity: bidAmount < (slot.minBidCash ?? 0) ? 0.4 : 1,
                    minHeight: 34,
                  }}
                >
                  Place Bid
                </button>
                <button
                  onClick={() => setShowBid(false)}
                  style={{
                    padding: '7px 10px', borderRadius: 7, cursor: 'pointer',
                    fontSize: 10, fontFamily: T.mono,
                    background: 'rgba(255,255,255,0.05)', border: `1px solid ${T.border}`,
                    color: T.textSub, minHeight: 34,
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowBid(true)}
              disabled={!canAfford}
              style={{
                width: '100%', padding: '8px', borderRadius: 7, cursor: canAfford ? 'pointer' : 'not-allowed',
                fontSize: 10, fontFamily: T.mono, fontWeight: 700,
                background: canAfford ? 'rgba(255,215,0,0.12)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${canAfford ? 'rgba(255,215,0,0.30)' : T.border}`,
                color: canAfford ? T.yellow : T.textMut,
                minHeight: 36,
              }}
            >
              {canAfford ? 'Bid Now' : `Need ${fmt(cost)}`}
            </button>
          )
        ) : (
          <button
            onClick={() => onClaim(slot.id)}
            disabled={!canAfford}
            style={{
              width: '100%', padding: '8px', borderRadius: 7, cursor: canAfford ? 'pointer' : 'not-allowed',
              fontSize: 10, fontFamily: T.mono, fontWeight: 700,
              background: canAfford ? T.indigo : 'rgba(255,255,255,0.04)',
              border: 'none',
              color: canAfford ? '#000' : T.textMut,
              boxShadow: canAfford ? `0 0 16px rgba(129,140,248,0.30)` : 'none',
              minHeight: 36,
            }}
          >
            {canAfford ? 'Claim' : `Need ${fmt(cost - playerCash)} more`}
          </button>
        )}

        {!claimed && !expired && (
          <p style={{
            textAlign: 'center', fontSize: 9, color: T.textMut,
            fontFamily: T.mono, marginTop: 5,
          }}>
            Expires T{slot.expiresAtTick}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Market Row Display ───────────────────────────────────────────────────────
export function MarketRowDisplay({
  marketRow, currentTick, playerCash, playerId, onClaim, onBid,
}: MarketRowDisplayProps) {
  const active      = marketRow.slots.filter(s => !s.claimedByPlayerId && s.expiresAtTick > currentTick);
  const claimedByMe = marketRow.slots.filter(s => s.claimedByPlayerId === playerId);

  return (
    <Panel>
      <PanelHeader right={
        claimedByMe.length > 0 ? (
          <span style={{ fontSize: 11, fontFamily: T.mono, fontWeight: 700, color: T.green }}>
            {claimedByMe.length} claimed ✅
          </span>
        ) : undefined
      }>
        🏪 Market Row{' '}
        <span style={{ fontSize: 10, fontFamily: T.mono, fontWeight: 400, color: T.textSub, marginLeft: 6 }}>
          {active.length} available
        </span>
      </PanelHeader>

      {marketRow.slots.length === 0 ? (
        <div style={{
          padding: 32, textAlign: 'center',
          fontSize: 13, fontFamily: T.mono, color: T.textMut,
        }}>
          Market refreshes soon…
        </div>
      ) : (
        <div style={{
          padding: 12,
          display: 'grid', gap: 10,
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        }}>
          {marketRow.slots.map(slot => (
            <MarketSlot
              key={slot.id} slot={slot}
              currentTick={currentTick} playerCash={playerCash}
              playerId={playerId} onClaim={onClaim} onBid={onBid}
            />
          ))}
        </div>
      )}
    </Panel>
  );
}

// ═══════════════════════════════════════════════════════════════════
// INTERACTION PANEL
// ═══════════════════════════════════════════════════════════════════

export interface InteractionPanelProps {
  players: ClubPlayer[];
  myPlayerId: string;
  pendingInteractions: InteractionCard[];
  ruleSet: ModeratorRuleSet;
  onSendAid: (targetId: string, amount: number, aidType: string) => void;
  onSendTrade: (targetId: string) => void;
  onSendBlock: (targetId: string, marketCardId: string) => void;
  onSendChallenge: (targetId: string, type: string) => void;
  onSendAlliance: (targetId: string, type: string) => void;
  onAcceptInteraction: (interactionId: string) => void;
  onRejectInteraction: (interactionId: string) => void;
}

// ─── Interaction config ───────────────────────────────────────────────────────
const INTERACTION_CFG: Record<InteractionCardType, {
  icon: string; label: string; accent: string; bg: string; border: string;
}> = {
  AID:       { icon: '🤝', label: 'Aid',       accent: T.green,  bg: 'rgba(34,221,136,0.07)',  border: 'rgba(34,221,136,0.25)' },
  TRADE:     { icon: '🔄', label: 'Trade',     accent: T.blue,   bg: 'rgba(68,136,255,0.07)',  border: 'rgba(68,136,255,0.25)' },
  BLOCK:     { icon: '🚫', label: 'Block',     accent: T.red,    bg: 'rgba(255,77,77,0.07)',   border: 'rgba(255,77,77,0.25)'  },
  CHALLENGE: { icon: '⚔️', label: 'Challenge', accent: T.orange, bg: 'rgba(255,140,0,0.07)',  border: 'rgba(255,140,0,0.25)'  },
  ALLIANCE:  { icon: '🛡️', label: 'Alliance',  accent: T.purple, bg: 'rgba(168,85,247,0.07)', border: 'rgba(168,85,247,0.25)' },
};

// ─── Pending interaction card ─────────────────────────────────────────────────
function PendingCard({
  interaction, isIncoming, onAccept, onReject,
}: {
  interaction: InteractionCard; isIncoming: boolean;
  onAccept: () => void; onReject: () => void;
}) {
  const cfg = INTERACTION_CFG[interaction.type];

  return (
    <div style={{
      padding: '10px 12px', borderRadius: 9,
      background: cfg.bg, border: `1px solid ${cfg.border}`,
    }}>
      <div style={{ display: 'flex', gap: 10, marginBottom: isIncoming && interaction.status === 'pending' ? 10 : 0 }}>
        <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{cfg.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: cfg.accent, fontFamily: T.display, marginBottom: 2 }}>
            {interaction.label}
          </p>
          <p style={{ fontSize: 10, color: T.textSub, fontFamily: T.mono, lineHeight: 1.4, marginBottom: 2 }}>
            {interaction.description}
          </p>
          <p style={{ fontSize: 9, color: T.textMut, fontFamily: T.mono }}>
            {isIncoming ? `From ${interaction.sourcePlayerId}` : `To ${interaction.targetPlayerId}`}
          </p>
        </div>
        {interaction.reputationDelta !== 0 && (
          <span style={{
            fontSize: 10, fontFamily: T.mono, fontWeight: 700, flexShrink: 0,
            color: interaction.reputationDelta > 0 ? T.blue : T.red,
          }}>
            {interaction.reputationDelta > 0 ? '+' : ''}{interaction.reputationDelta} rep
          </span>
        )}
      </div>

      {isIncoming && interaction.status === 'pending' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <button onClick={onAccept} style={{
            padding: '8px', borderRadius: 7, cursor: 'pointer',
            fontSize: 11, fontFamily: T.mono, fontWeight: 700,
            background: T.green, border: 'none', color: '#000', minHeight: 36,
          }}>
            Accept
          </button>
          <button onClick={onReject} style={{
            padding: '8px', borderRadius: 7, cursor: 'pointer',
            fontSize: 11, fontFamily: T.mono, fontWeight: 700,
            background: 'rgba(255,255,255,0.05)', border: `1px solid ${T.border}`,
            color: T.textSub, minHeight: 36,
          }}>
            Decline
          </button>
        </div>
      ) : !isIncoming && (
        <p style={{
          textAlign: 'center', fontSize: 10, color: T.textMut, fontFamily: T.mono,
        }}>
          {interaction.status === 'pending' ? '⏳ Awaiting response…'
            : interaction.status === 'accepted' ? '✅ Accepted' : '❌ Declined'}
        </p>
      )}
    </div>
  );
}

// ─── Action button ────────────────────────────────────────────────────────────
function ActionBtn({
  label, onClick, accent = T.indigo, fullWidth = false, disabled = false,
}: {
  label: string; onClick: () => void;
  accent?: string; fullWidth?: boolean; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick} disabled={disabled}
      style={{
        width: fullWidth ? '100%' : undefined,
        flex: fullWidth ? undefined : 1,
        padding: '9px 10px', borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 10, fontFamily: T.mono, fontWeight: 700, textAlign: 'center',
        background: `${accent}18`, border: `1px solid ${accent}44`,
        color: accent, opacity: disabled ? 0.4 : 1, minHeight: 36,
        transition: 'all 0.15s ease',
      }}
    >
      {label}
    </button>
  );
}

export function InteractionPanel({
  players, myPlayerId, pendingInteractions, ruleSet,
  onSendAid, onSendTrade, onSendBlock, onSendChallenge, onSendAlliance,
  onAcceptInteraction, onRejectInteraction,
}: InteractionPanelProps) {
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [activeAction,   setActiveAction]   = useState<InteractionCardType | null>(null);
  const [aidAmount,      setAidAmount]      = useState(1000);

  const others   = players.filter(p => p.id !== myPlayerId);
  const incoming = pendingInteractions.filter(i => i.targetPlayerId === myPlayerId && i.status === 'pending');
  const outgoing = pendingInteractions.filter(i => i.sourcePlayerId === myPlayerId && i.status === 'pending');

  const enabledActions = (Object.keys(INTERACTION_CFG) as InteractionCardType[]).filter(t => {
    switch (t) {
      case 'AID':       return ruleSet.allowAid;
      case 'TRADE':     return ruleSet.allowTrade;
      case 'BLOCK':     return ruleSet.allowBlock;
      case 'CHALLENGE': return ruleSet.allowChallenge;
      case 'ALLIANCE':  return ruleSet.allowAlliance;
    }
  });

  return (
    <Panel>
      <PanelHeader right={
        incoming.length > 0 ? (
          <span style={{
            fontSize: 10, fontFamily: T.mono, fontWeight: 700,
            padding: '3px 10px', borderRadius: 20,
            background: 'rgba(255,140,0,0.12)', border: '1px solid rgba(255,140,0,0.28)',
            color: T.orange,
          }}>
            {incoming.length} incoming
          </span>
        ) : undefined
      }>
        💬 Club Interactions
      </PanelHeader>

      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Incoming */}
        {incoming.length > 0 && (
          <div>
            <Label>Incoming</Label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {incoming.map(i => (
                <PendingCard key={i.id} interaction={i} isIncoming
                  onAccept={() => onAcceptInteraction(i.id)}
                  onReject={() => onRejectInteraction(i.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Sent */}
        {outgoing.length > 0 && (
          <div>
            <Label>Sent</Label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {outgoing.map(i => (
                <PendingCard key={i.id} interaction={i} isIncoming={false}
                  onAccept={() => {}} onReject={() => {}}
                />
              ))}
            </div>
          </div>
        )}

        {/* Send new */}
        <div>
          <Label>Send Action</Label>

          {/* Target selector */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {others.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedTarget(p.id === selectedTarget ? null : p.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 12px', borderRadius: 20, cursor: 'pointer',
                  fontSize: 11, fontFamily: T.mono, fontWeight: 600,
                  border: `1px solid ${selectedTarget === p.id ? T.indigo : T.border}`,
                  background: selectedTarget === p.id ? 'rgba(129,140,248,0.12)' : 'rgba(255,255,255,0.03)',
                  color: selectedTarget === p.id ? T.indigo : T.textSub,
                  transition: 'all 0.15s ease', minHeight: 36,
                }}
              >
                <span>{p.avatarEmoji}</span>
                <span>{p.displayName}</span>
                {p.isInDistress && <span style={{ color: T.red, fontSize: 10 }}>⚠️</span>}
              </button>
            ))}
            {others.length === 0 && (
              <p style={{ fontSize: 11, fontFamily: T.mono, color: T.textMut }}>
                No other players yet.
              </p>
            )}
          </div>

          {selectedTarget && (
            <>
              {/* Action type buttons */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {enabledActions.map(type => {
                  const cfg = INTERACTION_CFG[type];
                  const active = activeAction === type;
                  return (
                    <button
                      key={type}
                      onClick={() => setActiveAction(active ? null : type)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '7px 12px', borderRadius: 20, cursor: 'pointer',
                        fontSize: 10, fontFamily: T.mono, fontWeight: 700,
                        border: `1px solid ${active ? cfg.accent : T.border}`,
                        background: active ? cfg.bg : 'rgba(255,255,255,0.03)',
                        color: active ? cfg.accent : T.textSub,
                        transition: 'all 0.15s ease', minHeight: 36,
                      }}
                    >
                      {cfg.icon} {cfg.label}
                    </button>
                  );
                })}
              </div>

              {/* AID controls */}
              {activeAction === 'AID' && (
                <div style={{
                  padding: '12px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.border}`,
                  marginBottom: 8,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontFamily: T.mono, color: T.textSub }}>Amount</span>
                    <span style={{ fontSize: 12, fontFamily: T.mono, fontWeight: 700, color: T.text }}>
                      {fmt(aidAmount)}
                    </span>
                  </div>
                  <input type="range" min={500} max={10000} step={500} value={aidAmount}
                    onChange={e => setAidAmount(Number(e.target.value))}
                    style={{ width: '100%', accentColor: T.green, marginBottom: 10 }} />
                  <div style={{ display: 'flex', gap: 6 }}>
                    {(['loan', 'guarantee', 'shared_reserve'] as const).map(t => (
                      <ActionBtn
                        key={t} label={t.replace('_', ' ')} accent={T.green}
                        onClick={() => { onSendAid(selectedTarget, aidAmount, t); setActiveAction(null); }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {activeAction === 'TRADE' && (
                <ActionBtn label="Open Trade Offer" accent={T.blue} fullWidth
                  onClick={() => { onSendTrade(selectedTarget); setActiveAction(null); }} />
              )}

              {activeAction === 'CHALLENGE' && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {(['cashflow_duel', 'net_worth_race', 'bid_war'] as const).map(t => (
                    <ActionBtn key={t} label={t.replace(/_/g, ' ')} accent={T.orange}
                      onClick={() => { onSendChallenge(selectedTarget, t); setActiveAction(null); }} />
                  ))}
                </div>
              )}

              {activeAction === 'ALLIANCE' && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {(['shared_protection', 'info_share', 'joint_reserve'] as const).map(t => (
                    <ActionBtn key={t} label={t.replace(/_/g, ' ')} accent={T.purple}
                      onClick={() => { onSendAlliance(selectedTarget, t); setActiveAction(null); }} />
                  ))}
                </div>
              )}

              {activeAction === 'BLOCK' && (
                <p style={{
                  textAlign: 'center', fontSize: 10, fontFamily: T.mono,
                  color: T.textSub, padding: '8px 0',
                }}>
                  Select a market card to block, then confirm.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </Panel>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CLUB SCOREBOARD
// ═══════════════════════════════════════════════════════════════════

export interface ClubScoreboardProps {
  players: ClubPlayer[];
  myPlayerId: string;
  currentTick: number;
}

export function ClubScoreboard({ players, myPlayerId }: ClubScoreboardProps) {
  const sorted = [...players].sort((a, b) =>
    (b.income - a.income) || (b.netWorth - a.netWorth)
  );

  const RANK_MEDALS = ['🥇', '🥈', '🥉'];

  return (
    <Panel>
      <PanelHeader>🏆 Club Standings</PanelHeader>
      <div>
        {sorted.map((player, rank) => {
          const isMe     = player.id === myPlayerId;
          const cashflow = player.income;

          return (
            <div
              key={player.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px',
                background: isMe ? 'rgba(129,140,248,0.07)' : 'transparent',
                borderBottom: `1px solid ${T.border}`,
                transition: 'background 0.15s',
              }}
            >
              {/* Rank */}
              <span style={{
                width: 22, textAlign: 'center', flexShrink: 0,
                fontSize: rank < 3 ? 14 : 11,
                fontFamily: T.mono, color: T.textSub, fontWeight: 700,
              }}>
                {rank < 3 ? RANK_MEDALS[rank] : rank + 1}
              </span>

              {/* Avatar */}
              <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1 }}>
                {player.avatarEmoji}
              </span>

              {/* Name + stats */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: 11, fontWeight: 700, fontFamily: T.display,
                  color: isMe ? T.indigo : T.text, marginBottom: 2,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {player.displayName}{isMe ? ' (you)' : ''}
                </p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: 10, fontFamily: T.mono, fontWeight: 700,
                    color: cashflow >= 0 ? T.green : T.red,
                  }}>
                    {cashflow >= 0 ? '+' : ''}{fmt(cashflow)}/mo
                  </span>
                  <span style={{ fontSize: 10, fontFamily: T.mono, color: T.textSub }}>
                    {fmt(player.netWorth)} NW
                  </span>
                </div>
              </div>

              {/* Reputation */}
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ fontSize: 10, fontFamily: T.mono, color: T.textSub }}>
                  {player.reputationScore} rep
                </p>
                <p style={{ fontSize: 9, fontFamily: T.mono, color: T.textMut }}>
                  {player.reputationTier}
                </p>
              </div>

              {/* Status indicators */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                {player.isInDistress && (
                  <span style={{ fontSize: 12 }} title="In distress">⚠️</span>
                )}
                {!player.isConnected && (
                  <div style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: T.textMut,
                  }} title="Disconnected" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MODERATOR PRESET SELECTOR
// ═══════════════════════════════════════════════════════════════════

type ModeratorPreset = import('../types/club').ModeratorPreset;

export interface ModeratorPresetSelectorProps {
  selectedPreset: ModeratorPreset;
  onChange: (preset: ModeratorPreset) => void;
}

export function ModeratorPresetSelector({
  selectedPreset, onChange,
}: ModeratorPresetSelectorProps) {
  const presets = Object.values(MODERATOR_RULE_SETS);

  const RULE_CFG: Array<{ key: keyof ModeratorRuleSet; label: string; color: string }> = [
    { key: 'allowAid',       label: 'Aid',       color: T.green  },
    { key: 'allowTrade',     label: 'Trade',     color: T.blue   },
    { key: 'allowBlock',     label: 'Block',     color: T.red    },
    { key: 'allowChallenge', label: 'Challenge', color: T.orange },
    { key: 'allowAlliance',  label: 'Alliance',  color: T.purple },
  ];

  return (
    <div style={{ fontFamily: T.display }}>
      <style>{FONT_IMPORT}</style>
      <Label>Club Mode</Label>
      <div style={{
        display: 'grid', gap: 10,
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
      }}>
        {presets.map(preset => {
          const active = selectedPreset === preset.preset;
          return (
            <button
              key={preset.preset}
              onClick={() => onChange(preset.preset as ModeratorPreset)}
              style={{
                textAlign: 'left', padding: '12px 14px', borderRadius: 10,
                cursor: 'pointer', border: 'none',
                background: active ? 'rgba(129,140,248,0.12)' : 'rgba(255,255,255,0.03)',
                outline: `1px solid ${active ? T.indigo : T.border}`,
                transition: 'all 0.2s ease',
                minHeight: 80,
              }}
            >
              <p style={{
                fontSize: 11, fontWeight: 700,
                color: active ? T.indigo : T.text, fontFamily: T.display, marginBottom: 4,
              }}>
                {preset.label}
              </p>
              <p style={{
                fontSize: 10, color: T.textSub, fontFamily: T.mono,
                lineHeight: 1.5, marginBottom: 8,
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>
                {preset.description}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {RULE_CFG.filter(r => preset[r.key as keyof typeof preset]).map(r => (
                  <span key={r.key} style={{
                    fontSize: 9, fontFamily: T.mono, fontWeight: 700,
                    padding: '2px 6px', borderRadius: 4,
                    background: `${r.color}14`, border: `1px solid ${r.color}33`,
                    color: r.color,
                  }}>
                    {r.label}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
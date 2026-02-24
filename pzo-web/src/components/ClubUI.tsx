/**
 * PZO SPRINT 7 — src/components/ClubUI.tsx
 *
 * Two components:
 *   1. MarketRowDisplay — 4-slot contested opportunity market
 *   2. InteractionPanel — send/receive Aid / Trade / Block / Challenge / Alliance
 *   3. ClubScoreboard  — live player standings during a session
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function timeBar(currentTick: number, expiresAtTick: number, addedAtTick: number): number {
  const total = expiresAtTick - addedAtTick;
  const remaining = expiresAtTick - currentTick;
  return Math.max(0, Math.min(1, remaining / total));
}

// ─── Market Row Display ───────────────────────────────────────────────────────

interface MarketRowDisplayProps {
  marketRow: MarketRowState;
  currentTick: number;
  playerCash: number;
  playerId: string;
  onClaim: (marketCardId: string) => void;
  onBid: (marketCardId: string, amount: number) => void;
}

function MarketSlot({
  slot,
  currentTick,
  playerCash,
  playerId,
  onClaim,
  onBid,
}: {
  slot: MarketRowCard;
  currentTick: number;
  playerCash: number;
  playerId: string;
  onClaim: (id: string) => void;
  onBid: (id: string, amount: number) => void;
}) {
  const [showBid, setShowBid] = useState(false);
  const [bidAmount, setBidAmount] = useState(0);

  const claimed = !!slot.claimedByPlayerId;
  const claimedByMe = slot.claimedByPlayerId === playerId;
  const claimedByAi = slot.claimedByPlayerId === 'AI_COMPETITOR';
  const timeLeft = timeBar(currentTick, slot.expiresAtTick, slot.addedAtTick);
  const cost = slot.minBidCash ?? slot.card.energyCost;
  const canAfford = playerCash >= cost;
  const expired = slot.expiresAtTick <= currentTick && !claimed;

  const card = slot.card;

  return (
    <div className={`relative bg-zinc-900 border-2 rounded-xl overflow-hidden transition-all ${
      claimedByMe ? 'border-emerald-500 shadow-lg shadow-emerald-900/30' :
      claimed ? 'border-zinc-700 opacity-50' :
      expired ? 'border-zinc-800 opacity-40' :
      canAfford ? 'border-zinc-600 hover:border-indigo-400' :
      'border-zinc-700 opacity-60'
    }`}>
      {/* Time bar */}
      {!claimed && !expired && (
        <div className="h-1 bg-zinc-800">
          <div
            className={`h-full transition-all ${timeLeft > 0.5 ? 'bg-emerald-500' : timeLeft > 0.25 ? 'bg-yellow-500' : 'bg-red-500'}`}
            style={{ width: `${timeLeft * 100}%` }}
          />
        </div>
      )}

      <div className="p-3">
        {/* Card Header */}
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="text-white font-bold text-xs leading-tight">{card.name}</p>
            <p className="text-zinc-500 text-xs">{card.subtype}</p>
          </div>
          {slot.minBidCash !== null && (
            <span className="text-xs bg-yellow-900/60 text-yellow-300 border border-yellow-700/50 px-1.5 py-0.5 rounded font-semibold">
              Bid
            </span>
          )}
        </div>

        {/* Key Stats */}
        <div className="space-y-0.5 mb-2">
          {card.cashflowMonthly !== null && (
            <div className="flex justify-between">
              <span className="text-zinc-500 text-xs">CF/mo</span>
              <span className="text-emerald-400 text-xs font-mono">+{fmt(card.cashflowMonthly)}</span>
            </div>
          )}
          {card.roiPct !== null && (
            <div className="flex justify-between">
              <span className="text-zinc-500 text-xs">ROI</span>
              <span className="text-zinc-300 text-xs font-mono">{card.roiPct}%</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-zinc-500 text-xs">Cost</span>
            <span className={`text-xs font-mono font-bold ${canAfford ? 'text-white' : 'text-red-400'}`}>{fmt(cost)}</span>
          </div>
        </div>

        {/* Action */}
        {claimed ? (
          <div className={`text-center text-xs font-bold py-1.5 rounded-lg ${
            claimedByMe ? 'bg-emerald-900/40 text-emerald-300' :
            claimedByAi ? 'bg-red-900/40 text-red-400' :
            'bg-zinc-800 text-zinc-500'
          }`}>
            {claimedByMe ? '✅ Yours' : claimedByAi ? '🤖 AI Claimed' : '🔒 Claimed'}
          </div>
        ) : expired ? (
          <div className="text-center text-xs text-zinc-600 py-1.5">Expired</div>
        ) : slot.minBidCash !== null ? (
          showBid ? (
            <div className="space-y-1">
              <input
                type="number"
                value={bidAmount}
                onChange={e => setBidAmount(Number(e.target.value))}
                min={slot.minBidCash}
                step={500}
                className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-2 py-1 text-xs text-white font-mono"
                placeholder={`Min: ${fmt(slot.minBidCash)}`}
              />
              <div className="flex gap-1">
                <button
                  onClick={() => { onBid(slot.id, bidAmount); setShowBid(false); }}
                  disabled={bidAmount < (slot.minBidCash ?? 0) || playerCash < bidAmount}
                  className="flex-1 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  Place Bid
                </button>
                <button onClick={() => setShowBid(false)} className="px-2 bg-zinc-800 text-zinc-400 text-xs rounded-lg">✕</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowBid(true)}
              disabled={!canAfford}
              className="w-full py-1.5 bg-yellow-700/60 hover:bg-yellow-600/60 disabled:bg-zinc-800 disabled:text-zinc-600 text-yellow-200 text-xs font-bold rounded-lg transition-colors"
            >
              {canAfford ? 'Bid Now' : `Need ${fmt(cost)}`}
            </button>
          )
        ) : (
          <button
            onClick={() => onClaim(slot.id)}
            disabled={!canAfford}
            className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-xs font-bold rounded-lg transition-colors"
          >
            {canAfford ? 'Claim' : `Need ${fmt(cost - playerCash)} more`}
          </button>
        )}

        {/* Tick countdown */}
        {!claimed && !expired && (
          <p className="text-zinc-600 text-xs text-center mt-1">
            Expires T{slot.expiresAtTick}
          </p>
        )}
      </div>
    </div>
  );
}

export function MarketRowDisplay({
  marketRow,
  currentTick,
  playerCash,
  playerId,
  onClaim,
  onBid,
}: MarketRowDisplayProps) {
  const activeSlots = marketRow.slots.filter(s => !s.claimedByPlayerId && s.expiresAtTick > currentTick);
  const claimedByMe = marketRow.slots.filter(s => s.claimedByPlayerId === playerId);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="px-3 py-2 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-white font-bold text-xs">🏪 Market Row</span>
          <span className="text-zinc-500 text-xs">{activeSlots.length} available</span>
        </div>
        {claimedByMe.length > 0 && (
          <span className="text-emerald-400 text-xs font-semibold">{claimedByMe.length} claimed ✅</span>
        )}
      </div>

      {marketRow.slots.length === 0 ? (
        <div className="p-6 text-center text-zinc-600 text-sm">
          Market refreshes soon…
        </div>
      ) : (
        <div className="p-3 grid grid-cols-2 md:grid-cols-4 gap-2">
          {marketRow.slots.map(slot => (
            <MarketSlot
              key={slot.id}
              slot={slot}
              currentTick={currentTick}
              playerCash={playerCash}
              playerId={playerId}
              onClaim={onClaim}
              onBid={onBid}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Interaction Panel ────────────────────────────────────────────────────────

interface InteractionPanelProps {
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

const INTERACTION_CONFIGS: Record<InteractionCardType, { icon: string; label: string; color: string; bg: string }> = {
  AID:       { icon: '🤝', label: 'Aid',       color: 'text-emerald-400', bg: 'bg-emerald-900/30 border-emerald-700/50' },
  TRADE:     { icon: '🔄', label: 'Trade',     color: 'text-blue-400',    bg: 'bg-blue-900/30 border-blue-700/50' },
  BLOCK:     { icon: '🚫', label: 'Block',     color: 'text-red-400',     bg: 'bg-red-900/30 border-red-700/50' },
  CHALLENGE: { icon: '⚔️', label: 'Challenge', color: 'text-orange-400',  bg: 'bg-orange-900/30 border-orange-700/50' },
  ALLIANCE:  { icon: '🛡️', label: 'Alliance',  color: 'text-purple-400',  bg: 'bg-purple-900/30 border-purple-700/50' },
};

function PendingInteractionCard({
  interaction,
  isIncoming,
  onAccept,
  onReject,
}: {
  interaction: InteractionCard;
  isIncoming: boolean;
  onAccept: () => void;
  onReject: () => void;
}) {
  const config = INTERACTION_CONFIGS[interaction.type];
  return (
    <div className={`border rounded-xl p-3 ${config.bg}`}>
      <div className="flex items-start gap-2 mb-2">
        <span className="text-lg">{config.icon}</span>
        <div className="flex-1">
          <p className={`text-xs font-bold ${config.color}`}>{interaction.label}</p>
          <p className="text-zinc-400 text-xs">{interaction.description}</p>
          <p className="text-zinc-600 text-xs mt-0.5">
            {isIncoming ? `From ${interaction.sourcePlayerId}` : `Sent to ${interaction.targetPlayerId}`}
          </p>
        </div>
        <div className="text-right">
          {interaction.reputationDelta !== 0 && (
            <p className={`text-xs font-mono ${interaction.reputationDelta > 0 ? 'text-blue-400' : 'text-red-400'}`}>
              {interaction.reputationDelta > 0 ? '+' : ''}{interaction.reputationDelta} rep
            </p>
          )}
        </div>
      </div>
      {isIncoming && interaction.status === 'pending' && (
        <div className="flex gap-2">
          <button onClick={onAccept} className="flex-1 py-1.5 bg-emerald-700/60 hover:bg-emerald-600/60 text-emerald-200 text-xs font-bold rounded-lg transition-colors">
            Accept
          </button>
          <button onClick={onReject} className="flex-1 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs font-bold rounded-lg transition-colors">
            Decline
          </button>
        </div>
      )}
      {!isIncoming && (
        <p className="text-zinc-600 text-xs text-center">
          {interaction.status === 'pending' ? '⏳ Awaiting response…' :
           interaction.status === 'accepted' ? '✅ Accepted' : '❌ Declined'}
        </p>
      )}
    </div>
  );
}

export function InteractionPanel({
  players,
  myPlayerId,
  pendingInteractions,
  ruleSet,
  onSendAid,
  onSendTrade,
  onSendBlock,
  onSendChallenge,
  onSendAlliance,
  onAcceptInteraction,
  onRejectInteraction,
}: InteractionPanelProps) {
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<InteractionCardType | null>(null);
  const [aidAmount, setAidAmount] = useState(1000);

  const otherPlayers = players.filter(p => p.id !== myPlayerId);
  const incoming = pendingInteractions.filter(i => i.targetPlayerId === myPlayerId && i.status === 'pending');
  const outgoing = pendingInteractions.filter(i => i.sourcePlayerId === myPlayerId);

  const enabledActions = (Object.keys(INTERACTION_CONFIGS) as InteractionCardType[]).filter(type => {
    switch (type) {
      case 'AID': return ruleSet.allowAid;
      case 'TRADE': return ruleSet.allowTrade;
      case 'BLOCK': return ruleSet.allowBlock;
      case 'CHALLENGE': return ruleSet.allowChallenge;
      case 'ALLIANCE': return ruleSet.allowAlliance;
    }
  });

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="px-3 py-2 border-b border-zinc-800 flex items-center justify-between">
        <span className="text-white font-bold text-xs">💬 Club Interactions</span>
        {incoming.length > 0 && (
          <span className="text-orange-300 text-xs font-bold bg-orange-900/40 px-2 py-0.5 rounded-full">
            {incoming.length} incoming
          </span>
        )}
      </div>

      <div className="p-3 space-y-3">
        {/* Incoming */}
        {incoming.length > 0 && (
          <div>
            <p className="text-zinc-500 text-xs uppercase font-semibold tracking-wide mb-2">Incoming</p>
            <div className="space-y-2">
              {incoming.map(i => (
                <PendingInteractionCard
                  key={i.id}
                  interaction={i}
                  isIncoming={true}
                  onAccept={() => onAcceptInteraction(i.id)}
                  onReject={() => onRejectInteraction(i.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Outgoing */}
        {outgoing.filter(i => i.status === 'pending').length > 0 && (
          <div>
            <p className="text-zinc-500 text-xs uppercase font-semibold tracking-wide mb-2">Sent</p>
            <div className="space-y-2">
              {outgoing.filter(i => i.status === 'pending').map(i => (
                <PendingInteractionCard
                  key={i.id}
                  interaction={i}
                  isIncoming={false}
                  onAccept={() => {}}
                  onReject={() => {}}
                />
              ))}
            </div>
          </div>
        )}

        {/* Send New */}
        <div>
          <p className="text-zinc-500 text-xs uppercase font-semibold tracking-wide mb-2">Send Action</p>

          {/* Target selector */}
          <div className="flex gap-1.5 flex-wrap mb-2">
            {otherPlayers.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedTarget(p.id === selectedTarget ? null : p.id)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  selectedTarget === p.id
                    ? 'bg-indigo-600 border-indigo-400 text-white'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500'
                }`}
              >
                <span>{p.avatarEmoji}</span>
                <span>{p.displayName}</span>
                {p.isInDistress && <span className="text-red-400 text-xs">⚠️</span>}
              </button>
            ))}
          </div>

          {selectedTarget && (
            <>
              {/* Action type buttons */}
              <div className="flex gap-1.5 flex-wrap mb-2">
                {enabledActions.map(type => {
                  const config = INTERACTION_CONFIGS[type];
                  return (
                    <button
                      key={type}
                      onClick={() => setActiveAction(activeAction === type ? null : type)}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                        activeAction === type
                          ? `${config.bg} ${config.color}`
                          : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:border-zinc-600'
                      }`}
                    >
                      {config.icon} {config.label}
                    </button>
                  );
                })}
              </div>

              {/* Action-specific controls */}
              {activeAction === 'AID' && (
                <div className="bg-zinc-800/60 rounded-xl p-3 space-y-2">
                  <div className="flex justify-between">
                    <label className="text-zinc-400 text-xs">Amount</label>
                    <span className="text-white text-xs font-mono">{fmt(aidAmount)}</span>
                  </div>
                  <input type="range" min={500} max={10000} step={500} value={aidAmount}
                    onChange={e => setAidAmount(Number(e.target.value))}
                    className="w-full accent-emerald-500" />
                  <div className="flex gap-2">
                    {(['loan', 'guarantee', 'shared_reserve'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => { onSendAid(selectedTarget, aidAmount, t); setActiveAction(null); }}
                        className="flex-1 py-1.5 bg-emerald-700/60 hover:bg-emerald-600/60 text-emerald-200 text-xs font-bold rounded-lg capitalize transition-colors"
                      >
                        {t.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeAction === 'TRADE' && (
                <button
                  onClick={() => { onSendTrade(selectedTarget); setActiveAction(null); }}
                  className="w-full py-2 bg-blue-700/60 hover:bg-blue-600/60 text-blue-200 text-xs font-bold rounded-xl transition-colors"
                >
                  Open Trade Offer
                </button>
              )}

              {activeAction === 'CHALLENGE' && (
                <div className="flex gap-2">
                  {(['cashflow_duel', 'net_worth_race', 'bid_war'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => { onSendChallenge(selectedTarget, t); setActiveAction(null); }}
                      className="flex-1 py-1.5 bg-orange-800/60 hover:bg-orange-700/60 text-orange-200 text-xs font-bold rounded-lg transition-colors text-center leading-tight"
                    >
                      {t.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              )}

              {activeAction === 'ALLIANCE' && (
                <div className="flex gap-2">
                  {(['shared_protection', 'info_share', 'joint_reserve'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => { onSendAlliance(selectedTarget, t); setActiveAction(null); }}
                      className="flex-1 py-1.5 bg-purple-800/60 hover:bg-purple-700/60 text-purple-200 text-xs font-bold rounded-lg transition-colors text-center leading-tight"
                    >
                      {t.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              )}

              {activeAction === 'BLOCK' && (
                <p className="text-zinc-500 text-xs text-center py-2">
                  Select a market card to block, then confirm.
                </p>
              )}
            </>
          )}

          {!selectedTarget && otherPlayers.length === 0 && (
            <p className="text-zinc-600 text-xs text-center py-3">
              No other players in session yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Club Scoreboard ──────────────────────────────────────────────────────────

interface ClubScoreboardProps {
  players: ClubPlayer[];
  myPlayerId: string;
  currentTick: number;
}

export function ClubScoreboard({ players, myPlayerId, currentTick }: ClubScoreboardProps) {
  const sorted = [...players].sort((a, b) => (b.income - b.netWorth * 0) - (a.income - a.netWorth * 0) || b.netWorth - a.netWorth);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="px-3 py-2 border-b border-zinc-800">
        <span className="text-white font-bold text-xs">🏆 Club Standings</span>
      </div>
      <div className="divide-y divide-zinc-800">
        {sorted.map((player, rank) => {
          const isMe = player.id === myPlayerId;
          const cashflow = player.income;
          return (
            <div key={player.id} className={`px-3 py-2 flex items-center gap-3 ${isMe ? 'bg-indigo-900/20' : ''}`}>
              <span className="text-zinc-500 text-xs font-mono w-5 text-center">
                {rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : `${rank + 1}`}
              </span>
              <span className="text-base">{player.avatarEmoji}</span>
              <div className="flex-1">
                <p className={`text-xs font-bold ${isMe ? 'text-indigo-300' : 'text-white'}`}>
                  {player.displayName} {isMe && '(you)'}
                </p>
                <div className="flex gap-2">
                  <span className={`text-xs font-mono ${cashflow >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {cashflow >= 0 ? '+' : ''}{fmt(cashflow)}/mo
                  </span>
                  <span className="text-zinc-600 text-xs">{fmt(player.netWorth)} NW</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-zinc-400 text-xs font-mono">{player.reputationScore} rep</p>
                <p className="text-zinc-600 text-xs">{player.reputationTier}</p>
              </div>
              {player.isInDistress && (
                <span className="text-red-400 text-xs">⚠️</span>
              )}
              {!player.isConnected && (
                <span className="text-zinc-600 text-xs">•</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Moderator Preset Selector ────────────────────────────────────────────────

interface ModeratorPresetSelectorProps {
  selectedPreset: import('../types/club').ModeratorPreset;
  onChange: (preset: import('../types/club').ModeratorPreset) => void;
}

export function ModeratorPresetSelector({ selectedPreset, onChange }: ModeratorPresetSelectorProps) {
  type Preset = import('../types/club').ModeratorPreset;
  const presets = Object.values(MODERATOR_RULE_SETS);

  return (
    <div className="space-y-2">
      <p className="text-zinc-400 text-xs uppercase font-semibold tracking-wide">Club Mode</p>
      <div className="grid grid-cols-2 gap-2">
        {presets.map(preset => (
          <button
            key={preset.preset}
            onClick={() => onChange(preset.preset as Preset)}
            className={`text-left p-3 rounded-xl border transition-all ${
              selectedPreset === preset.preset
                ? 'bg-indigo-900/40 border-indigo-500 shadow-lg shadow-indigo-900/20'
                : 'bg-zinc-800/60 border-zinc-700 hover:border-zinc-500'
            }`}
          >
            <p className={`text-xs font-bold mb-0.5 ${selectedPreset === preset.preset ? 'text-indigo-200' : 'text-white'}`}>
              {preset.label}
            </p>
            <p className="text-zinc-500 text-xs leading-tight line-clamp-2">{preset.description}</p>
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {preset.allowAid && <span className="text-xs text-emerald-500">Aid</span>}
              {preset.allowTrade && <span className="text-xs text-blue-500">Trade</span>}
              {preset.allowBlock && <span className="text-xs text-red-500">Block</span>}
              {preset.allowChallenge && <span className="text-xs text-orange-500">Challenge</span>}
              {preset.allowAlliance && <span className="text-xs text-purple-500">Alliance</span>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

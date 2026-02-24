/**
 * PZO UPGRADE — src/components/CardHand.tsx
 * FULL REPLACEMENT of CardHand.tsx
 * 
 * New capabilities:
 * - 5 real play zones: BUILD / RESERVE / SCALE / LEARN / FLIP (with logic hints)
 * - Expiry badges: HOT / COOLING / EXPIRING / EXPIRED
 * - Bias state warning overlay
 * - Counterparty risk indicator (if discoverable)
 * - Delayed maturity label on applicable cards
 * - Zone affinity highlights when dragging
 * - Card terms modal (leverage%, duration, insurance toggle)
 * - Tap-to-play fallback for mobile (no drag required)
 */

'use client';

import React, { useState, useCallback } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';

import {
  ZONE_CONFIGS,
  EXPIRY_BADGE_STYLES,
  BIAS_CARD_MODIFIERS,
  getExpiryBadge,
  type ZoneId,
  type ExpiryBadge,
  type BiasState,
  type CardExtension,
} from '../types/game';

// ─── Re-export base types ─────────────────────────────────────────────────────

export type DeckType = 'OPPORTUNITY' | 'IPA' | 'FUBAR' | 'MISSED_OPPORTUNITY' | 'PRIVILEGED' | 'SO';

export interface ComboSynergy {
  comboId: string;
  label: string;
  description: string;
  requiredCardIds: string[];
  bonusDescription: string;
}

// Extended Card interface (backwards compatible — all new fields optional)
export interface Card {
  id: string;
  name: string;
  type: DeckType;
  subtype: string | null;
  description: string;
  cost: number | null;
  leverage: number | null;
  downPayment: number | null;
  cashflowMonthly: number | null;
  roiPct: number | null;
  cashImpact: number | null;
  turnsLost: number | null;
  value: number | null;
  energyCost: number;
  synergies: ComboSynergy[];
  // ── New extension fields ──
  extension?: CardExtension;
  expiresAtTick?: number | null;        // shortcut for hand expiry display
  activationDelayTicks?: number | null; // shows "activates in X mo" on card
  biasFlag?: BiasState | null;          // bias risk on play
  counterpartyVisible?: boolean;        // if due diligence was performed
  counterpartyLabel?: string | null;
  currentTick?: number;                 // injected by parent for expiry calc
}

export interface CardHandProps {
  cards: Card[];
  playerEnergy: number;
  activeCardIds?: string[];
  onPlayCard: (cardId: string, targetZone: string) => void;
  onCardHover?: (cardId: string | null) => void;
  currentTick?: number;
  activeBiases?: Partial<Record<BiasState, { intensity: number }>>;
  className?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DECK_COLORS: Record<DeckType, { bg: string; border: string; badge: string; text: string }> = {
  OPPORTUNITY:        { bg: 'bg-emerald-950', border: 'border-emerald-500', badge: 'bg-emerald-500',  text: 'text-emerald-400' },
  IPA:                { bg: 'bg-blue-950',    border: 'border-blue-500',    badge: 'bg-blue-500',    text: 'text-blue-400' },
  FUBAR:              { bg: 'bg-red-950',     border: 'border-red-500',     badge: 'bg-red-500',     text: 'text-red-400' },
  MISSED_OPPORTUNITY: { bg: 'bg-orange-950',  border: 'border-orange-500',  badge: 'bg-orange-500',  text: 'text-orange-400' },
  PRIVILEGED:         { bg: 'bg-yellow-950',  border: 'border-yellow-400',  badge: 'bg-yellow-400',  text: 'text-yellow-300' },
  SO:                 { bg: 'bg-zinc-900',    border: 'border-zinc-500',    badge: 'bg-zinc-600',    text: 'text-zinc-300' },
};

const DECK_LABELS: Record<DeckType, string> = {
  OPPORTUNITY: 'Opportunity',
  IPA: 'Income Asset',
  FUBAR: 'FUBAR',
  MISSED_OPPORTUNITY: 'Missed',
  PRIVILEGED: 'Privileged',
  SO: 'Obstacle',
};

// Which card types can go into which zones
const ZONE_COMPATIBILITY: Record<ZoneId, DeckType[]> = {
  BUILD:   ['OPPORTUNITY', 'IPA'],
  RESERVE: ['OPPORTUNITY', 'IPA', 'SO'],
  SCALE:   ['OPPORTUNITY', 'IPA', 'PRIVILEGED'],
  LEARN:   ['OPPORTUNITY', 'IPA', 'SO'],
  FLIP:    ['OPPORTUNITY', 'IPA', 'PRIVILEGED'],
};

const ALL_ZONES: ZoneId[] = ['BUILD', 'RESERVE', 'SCALE', 'LEARN', 'FLIP'];
const PLAYABLE_TYPES: DeckType[] = ['OPPORTUNITY', 'IPA', 'PRIVILEGED', 'SO'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null): string {
  if (n === null) return '—';
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function isAffordable(card: Card, energy: number): boolean {
  return card.energyCost <= energy;
}

function isZoneCompatible(card: Card, zone: ZoneId): boolean {
  return ZONE_COMPATIBILITY[zone]?.includes(card.type) ?? false;
}

// ─── Expiry Badge Component ───────────────────────────────────────────────────

function ExpiryBadge({ badge }: { badge: ExpiryBadge }) {
  const style = EXPIRY_BADGE_STYLES[badge];
  return (
    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${style.bg} ${style.color} whitespace-nowrap`}>
      {style.label}
    </span>
  );
}

// ─── Terms Modal ─────────────────────────────────────────────────────────────

interface TermsModalProps {
  card: Card;
  onConfirm: (terms: NonNullable<CardExtension['terms']>) => void;
  onCancel: () => void;
}

function TermsModal({ card, onConfirm, onCancel }: TermsModalProps) {
  const [leveragePct, setLeveragePct] = useState(60);
  const [durationMonths, setDurationMonths] = useState(12);
  const [isVariableRate, setIsVariableRate] = useState(false);
  const [hasInsuranceAddon, setHasInsuranceAddon] = useState(false);

  const effectiveIncome = (card.cashflowMonthly ?? 0) * (1 + leveragePct / 300);
  const monthlyDebtService = ((card.leverage ?? 0) * (leveragePct / 100)) * 0.008;
  const netCashflow = effectiveIncome - monthlyDebtService;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-80 shadow-2xl">
        <h3 className="text-white font-bold text-base mb-1">{card.name}</h3>
        <p className="text-zinc-400 text-xs mb-4">Structure this deal before playing.</p>

        <div className="space-y-4">
          {/* Leverage */}
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-zinc-400 text-xs">Leverage</label>
              <span className="text-white text-xs font-mono">{leveragePct}%</span>
            </div>
            <input type="range" min={0} max={80} step={5} value={leveragePct}
              onChange={e => setLeveragePct(Number(e.target.value))}
              className="w-full accent-indigo-500" />
            <div className="flex justify-between text-xs text-zinc-600 mt-0.5">
              <span>None</span><span>Conservative</span><span>Aggressive</span>
            </div>
          </div>

          {/* Duration */}
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-zinc-400 text-xs">Duration</label>
              <span className="text-white text-xs font-mono">{durationMonths} mo</span>
            </div>
            <input type="range" min={1} max={36} step={1} value={durationMonths}
              onChange={e => setDurationMonths(Number(e.target.value))}
              className="w-full accent-indigo-500" />
          </div>

          {/* Toggles */}
          <div className="flex gap-3">
            <button
              onClick={() => setIsVariableRate(!isVariableRate)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                isVariableRate ? 'bg-orange-900 border-orange-500 text-orange-300' : 'bg-zinc-800 border-zinc-700 text-zinc-400'
              }`}
            >
              {isVariableRate ? '⚡ Variable Rate' : 'Fixed Rate'}
            </button>
            <button
              onClick={() => setHasInsuranceAddon(!hasInsuranceAddon)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                hasInsuranceAddon ? 'bg-blue-900 border-blue-500 text-blue-300' : 'bg-zinc-800 border-zinc-700 text-zinc-400'
              }`}
            >
              {hasInsuranceAddon ? '🛡 Insured' : 'No Insurance'}
            </button>
          </div>

          {/* Net Cashflow Preview */}
          <div className="bg-zinc-800 rounded-xl p-3">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-zinc-400">Gross CF/mo</span>
              <span className="text-emerald-400 font-mono">+{fmt(Math.round(effectiveIncome))}</span>
            </div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-zinc-400">Debt Service</span>
              <span className="text-red-400 font-mono">−{fmt(Math.round(monthlyDebtService))}</span>
            </div>
            <div className="h-px bg-zinc-700 my-1" />
            <div className="flex justify-between text-xs">
              <span className="text-zinc-300 font-semibold">Net CF/mo</span>
              <span className={`font-mono font-bold ${netCashflow >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {netCashflow >= 0 ? '+' : ''}{fmt(Math.round(netCashflow))}
              </span>
            </div>
            {isVariableRate && (
              <p className="text-orange-400 text-xs mt-1">⚡ Variable: rate can spike with market regime</p>
            )}
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button onClick={onCancel}
            className="flex-1 py-2 rounded-xl bg-zinc-800 text-zinc-400 text-sm font-semibold hover:bg-zinc-700 transition-colors">
            Cancel
          </button>
          <button onClick={() => onConfirm({ leveragePct, durationMonths, isVariableRate, hasInsuranceAddon })}
            className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-colors">
            Confirm Play
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Single Card Component ────────────────────────────────────────────────────

interface SingleCardProps {
  card: Card;
  playerEnergy: number;
  currentTick?: number;
  isBeingDragged?: boolean;
  isDragOverlay?: boolean;
  isCompatibleWithDragZone?: boolean;
  onHover?: (cardId: string | null) => void;
  onTapPlay?: (cardId: string) => void;
}

function SingleCard({
  card,
  playerEnergy,
  currentTick = 0,
  isBeingDragged = false,
  isDragOverlay = false,
  isCompatibleWithDragZone = false,
  onHover,
  onTapPlay,
}: SingleCardProps) {
  const [showSynergies, setShowSynergies] = useState(false);
  const affordable = isAffordable(card, playerEnergy);
  const colors = DECK_COLORS[card.type];

  const expiresAt = card.expiresAtTick ?? null;
  const expiryBadge = getExpiryBadge(currentTick, expiresAt);
  const isExpired = expiryBadge === 'EXPIRED';

  const cardOpacity = (!affordable || isExpired) && !isDragOverlay ? 'opacity-40 grayscale' : 'opacity-100';
  const dragScale = isBeingDragged ? 'scale-105 rotate-2 shadow-2xl shadow-black/60' : '';
  const hoverScale = !isBeingDragged && affordable && !isExpired ? 'hover:-translate-y-2 hover:shadow-xl hover:shadow-black/50' : '';
  const compatibleHighlight = isCompatibleWithDragZone ? 'ring-2 ring-indigo-400 ring-offset-1 ring-offset-zinc-900' : '';

  const hasDelay = (card.activationDelayTicks ?? 0) > 0;
  const delayMonths = Math.ceil((card.activationDelayTicks ?? 0) / 12);

  return (
    <div
      className={`
        relative w-36 h-56 rounded-xl border-2 ${colors.bg} ${colors.border}
        select-none cursor-grab active:cursor-grabbing
        transition-all duration-200 ease-out
        flex flex-col overflow-hidden
        ${cardOpacity} ${dragScale} ${hoverScale} ${compatibleHighlight}
      `}
      onMouseEnter={() => { setShowSynergies(true); onHover?.(card.id); }}
      onMouseLeave={() => { setShowSynergies(false); onHover?.(null); }}
    >
      {/* Type Badge */}
      <div className={`${colors.badge} px-2 py-0.5 text-xs font-bold text-white tracking-wide flex items-center justify-between`}>
        <span>{DECK_LABELS[card.type]}</span>
        {expiryBadge && expiryBadge !== 'HOT' && (
          <ExpiryBadge badge={expiryBadge} />
        )}
      </div>

      {/* Card Name */}
      <div className="px-2 pt-1.5 pb-0.5">
        <p className="text-white font-semibold text-xs leading-tight line-clamp-2">{card.name}</p>
        {card.subtype && (
          <p className={`text-xs ${colors.text} opacity-70 mt-0.5`}>{card.subtype}</p>
        )}
      </div>

      {/* Energy Cost Bubble */}
      <div className="absolute top-1 right-1">
        <div className={`
          w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
          ${affordable ? 'bg-white/20 text-white' : 'bg-red-900/80 text-red-300'}
          border border-white/20
        `}>
          {card.energyCost >= 1000 ? `${Math.round(card.energyCost / 1000)}K` : card.energyCost || '—'}
        </div>
      </div>

      {/* Bias Risk Indicator */}
      {card.biasFlag && (
        <div className="px-2 py-0.5">
          <div className="text-xs bg-orange-900/60 border border-orange-700/50 rounded px-1 py-0.5 text-orange-300">
            ⚠️ {BIAS_CARD_MODIFIERS[card.biasFlag].label}
          </div>
        </div>
      )}

      {/* Delayed Maturity Banner */}
      {hasDelay && (
        <div className="px-2 py-0.5">
          <div className="text-xs bg-indigo-900/60 border border-indigo-700/50 rounded px-1 py-0.5 text-indigo-300">
            ⏳ Activates in {delayMonths} mo
          </div>
        </div>
      )}

      {/* Counterparty Risk */}
      {card.counterpartyVisible && card.counterpartyLabel && (
        <div className="px-2 py-0.5">
          <div className={`text-xs rounded px-1 py-0.5 ${
            card.counterpartyLabel === 'reliable' ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700/50' :
            card.counterpartyLabel === 'fragile' || card.counterpartyLabel === 'predatory' ? 'bg-red-900/60 text-red-300 border border-red-700/50' :
            'bg-zinc-800 text-zinc-400 border border-zinc-700'
          }`}>
            🤝 {card.counterpartyLabel}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="px-2 space-y-0.5 flex-1 mt-1">
        {card.cashflowMonthly !== null && (
          <div className="flex justify-between items-center">
            <span className="text-zinc-400 text-xs">CF/mo</span>
            <span className="text-emerald-400 text-xs font-mono font-semibold">+{fmt(card.cashflowMonthly)}</span>
          </div>
        )}
        {card.downPayment !== null && (
          <div className="flex justify-between items-center">
            <span className="text-zinc-400 text-xs">Down</span>
            <span className="text-white text-xs font-mono">{fmt(card.downPayment)}</span>
          </div>
        )}
        {card.leverage !== null && (
          <div className="flex justify-between items-center">
            <span className="text-zinc-400 text-xs">Debt</span>
            <span className="text-orange-400 text-xs font-mono">{fmt(card.leverage)}</span>
          </div>
        )}
        {card.roiPct !== null && (
          <div className="flex justify-between items-center">
            <span className="text-zinc-400 text-xs">ROI</span>
            <span className={`text-xs font-mono font-semibold ${card.roiPct >= 30 ? 'text-yellow-400' : 'text-zinc-300'}`}>
              {card.roiPct}%
            </span>
          </div>
        )}
        {card.cashImpact !== null && (
          <div className="flex justify-between items-center">
            <span className="text-zinc-400 text-xs">Impact</span>
            <span className="text-red-400 text-xs font-mono">{fmt(card.cashImpact)}</span>
          </div>
        )}
        {card.value !== null && (
          <div className="flex justify-between items-center">
            <span className="text-zinc-400 text-xs">Value</span>
            <span className="text-yellow-300 text-xs font-mono">{fmt(card.value)}</span>
          </div>
        )}
        {card.turnsLost !== null && (
          <div className="flex justify-between items-center">
            <span className="text-zinc-400 text-xs">Freeze</span>
            <span className="text-red-400 text-xs font-mono">{card.turnsLost}t</span>
          </div>
        )}
      </div>

      {/* Description */}
      <div className="px-2 pb-2">
        <p className="text-zinc-500 text-xs line-clamp-1 leading-tight">{card.description}</p>
      </div>

      {/* Tap to Play Button (mobile / click fallback) */}
      {onTapPlay && affordable && !isExpired && PLAYABLE_TYPES.includes(card.type) && (
        <button
          className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center shadow-lg z-10"
          onClick={(e) => { e.stopPropagation(); onTapPlay(card.id); }}
          title="Quick play to Build zone"
        >
          ▶
        </button>
      )}

      {/* Insufficient Funds Overlay */}
      {!affordable && !isExpired && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl">
          <span className="text-red-400 text-xs font-bold tracking-wider uppercase bg-black/70 px-2 py-0.5 rounded">
            Insufficient funds
          </span>
        </div>
      )}

      {/* Expired Overlay */}
      {isExpired && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-xl">
          <span className="text-zinc-500 text-xs font-bold tracking-wider uppercase bg-black/70 px-2 py-0.5 rounded">
            Opportunity Gone
          </span>
        </div>
      )}

      {/* Synergy Tooltip */}
      {showSynergies && card.synergies.length > 0 && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 z-50 pointer-events-none">
          <div className="bg-zinc-900 border border-zinc-600 rounded-lg p-2 shadow-2xl">
            <p className="text-zinc-400 text-xs font-semibold mb-1 uppercase tracking-wide">Combos</p>
            {card.synergies.slice(0, 3).map(s => (
              <div key={s.comboId} className="mb-1.5 last:mb-0">
                <p className="text-yellow-300 text-xs font-semibold">{s.label}</p>
                <p className="text-zinc-400 text-xs">{s.bonusDescription}</p>
              </div>
            ))}
          </div>
          <div className="w-2 h-2 bg-zinc-900 border-r border-b border-zinc-600 rotate-45 mx-auto -mt-1" />
        </div>
      )}
    </div>
  );
}

// ─── Draggable Card ───────────────────────────────────────────────────────────

function DraggableCard({ card, playerEnergy, currentTick, onHover, onTapPlay, isCompatibleWithDragZone }: {
  card: Card;
  playerEnergy: number;
  currentTick?: number;
  onHover?: (id: string | null) => void;
  onTapPlay?: (id: string) => void;
  isCompatibleWithDragZone?: boolean;
}) {
  const expiryBadge = getExpiryBadge(currentTick ?? 0, card.expiresAtTick ?? null);
  const isExpired = expiryBadge === 'EXPIRED';
  const canDrag = isAffordable(card, playerEnergy) && !isExpired;

  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({
    id: card.id,
    disabled: !canDrag,
  });

  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <SingleCard
        card={card}
        playerEnergy={playerEnergy}
        currentTick={currentTick}
        isBeingDragged={isDragging}
        onHover={onHover}
        onTapPlay={onTapPlay}
        isCompatibleWithDragZone={isCompatibleWithDragZone}
      />
    </div>
  );
}

// ─── Real Play Zone Component ─────────────────────────────────────────────────

interface PlayZoneProps {
  zoneId: ZoneId;
  isDragActive: boolean;
  activeCardType: DeckType | null;
  isExpanded: boolean;
}

function PlayZone({ zoneId, isDragActive, activeCardType, isExpanded }: PlayZoneProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `zone-${zoneId}` });
  const config = ZONE_CONFIGS[zoneId];
  const compatible = activeCardType ? ZONE_COMPATIBILITY[zoneId].includes(activeCardType) : true;
  const canReceive = isDragActive && compatible;

  return (
    <div
      ref={setNodeRef}
      className={`
        flex-1 min-w-[100px] rounded-xl border-2 border-dashed
        flex flex-col items-center justify-center gap-1 px-2
        transition-all duration-200 relative
        ${isOver && canReceive ? 'border-indigo-400 bg-indigo-900/30 scale-105 shadow-lg shadow-indigo-900/40' :
          isOver && !canReceive ? 'border-red-600 bg-red-900/20' :
          canReceive ? 'border-zinc-500 bg-zinc-900/40 animate-pulse' :
          isDragActive && !compatible ? 'border-zinc-800 bg-zinc-950 opacity-40' :
          'border-zinc-700 bg-zinc-900/40'
        }
        ${isExpanded ? 'py-4' : 'py-2'}
      `}
    >
      <span className={`font-bold text-xs ${isOver && canReceive ? 'text-indigo-300' : isOver && !canReceive ? 'text-red-400' : 'text-zinc-400'}`}>
        {config.label}
      </span>
      {isExpanded && (
        <>
          <p className="text-zinc-500 text-xs text-center leading-tight">{config.description}</p>
          <p className={`text-xs font-mono font-semibold mt-0.5 ${isOver && canReceive ? 'text-indigo-300' : 'text-zinc-600'}`}>
            {config.tooltip}
          </p>
          {!compatible && isDragActive && (
            <p className="text-red-500 text-xs mt-1">Incompatible card type</p>
          )}
        </>
      )}
    </div>
  );
}

// ─── Bias Warning Bar ─────────────────────────────────────────────────────────

function BiasWarningBar({ activeBiases }: { activeBiases: Partial<Record<BiasState, { intensity: number }>> }) {
  const entries = Object.entries(activeBiases) as [BiasState, { intensity: number }][];
  if (entries.length === 0) return null;

  return (
    <div className="flex gap-2 flex-wrap px-1 mb-2">
      {entries.map(([bias, state]) => {
        const mod = BIAS_CARD_MODIFIERS[bias];
        return (
          <div key={bias}
            className="flex items-center gap-1 bg-orange-900/40 border border-orange-700/50 rounded-full px-2 py-0.5">
            <span className="text-orange-300 text-xs font-bold">{mod.label}</span>
            <span className="text-orange-500 text-xs">{(state.intensity * 100).toFixed(0)}%</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main CardHand Component ──────────────────────────────────────────────────

export default function CardHand({
  cards,
  playerEnergy,
  onPlayCard,
  onCardHover,
  currentTick = 0,
  activeBiases = {},
  className = '',
}: CardHandProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingPlayId, setPendingPlayId] = useState<string | null>(null); // for terms modal
  const [zonesExpanded, setZonesExpanded] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const activeCard = activeId ? cards.find(c => c.id === activeId) ?? null : null;

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const zoneId = (over.id as string).replace('zone-', '') as ZoneId;
    const card = cards.find(c => c.id === active.id);
    if (!card) return;

    // Non-playable types resolve immediately (FUBAR, MISSED go directly)
    if (!PLAYABLE_TYPES.includes(card.type)) {
      onPlayCard(active.id as string, zoneId);
      return;
    }

    // Playable cards: show terms if leverage is relevant, else direct play
    if (card.leverage !== null && card.leverage > 0) {
      setPendingPlayId(active.id as string);
    } else {
      onPlayCard(active.id as string, zoneId);
    }
  }, [cards, onPlayCard]);

  const handleTapPlay = useCallback((cardId: string) => {
    onPlayCard(cardId, 'BUILD'); // default zone for tap-play
  }, [onPlayCard]);

  const handleTermsConfirm = useCallback((terms: NonNullable<CardExtension['terms']>) => {
    if (!pendingPlayId) return;
    // Pass terms via encoded zone string — parent should parse `zone|termsJSON`
    onPlayCard(pendingPlayId, `BUILD|${JSON.stringify(terms)}`);
    setPendingPlayId(null);
  }, [pendingPlayId, onPlayCard]);

  const pendingCard = pendingPlayId ? cards.find(c => c.id === pendingPlayId) ?? null : null;

  const hasBiases = Object.keys(activeBiases).length > 0;

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className={`flex flex-col gap-3 ${className}`}>

          {/* Bias Warning */}
          {hasBiases && <BiasWarningBar activeBiases={activeBiases} />}

          {/* Zone Header + Toggle */}
          <div className="flex items-center justify-between px-1">
            <span className="text-zinc-400 text-xs uppercase font-semibold tracking-wide">
              Play Zones
            </span>
            <button
              onClick={() => setZonesExpanded(v => !v)}
              className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors"
            >
              {zonesExpanded ? '▲ collapse' : '▼ details'}
            </button>
          </div>

          {/* Play Zones */}
          <div className="flex gap-2">
            {ALL_ZONES.map(zoneId => (
              <PlayZone
                key={zoneId}
                zoneId={zoneId}
                isDragActive={activeId !== null}
                activeCardType={activeCard?.type ?? null}
                isExpanded={zonesExpanded}
              />
            ))}
          </div>

          {/* Energy Bar */}
          <div className="flex items-center gap-2 px-1">
            <span className="text-zinc-400 text-xs font-semibold uppercase tracking-wide">Cash</span>
            <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, (playerEnergy / 100_000) * 100)}%` }}
              />
            </div>
            <span className="text-emerald-400 font-mono text-xs font-bold">
              {playerEnergy >= 1_000_000 ? `$${(playerEnergy / 1e6).toFixed(1)}M`
                : playerEnergy >= 1_000 ? `$${(playerEnergy / 1e3).toFixed(1)}K`
                : `$${playerEnergy.toLocaleString()}`}
            </span>
          </div>

          {/* Hand */}
          <div className="flex gap-2 overflow-x-auto pb-2 snap-x">
            {cards.length === 0 ? (
              <div className="w-full text-center text-zinc-600 text-sm py-8">
                No cards in hand — drawing soon
              </div>
            ) : (
              cards.map(card => {
                const compatible = activeCard ? isZoneCompatible(activeCard, 'BUILD') : false;
                return (
                  <div key={card.id} className="snap-start flex-shrink-0">
                    <DraggableCard
                      card={{ ...card, currentTick }}
                      playerEnergy={playerEnergy}
                      currentTick={currentTick}
                      onHover={onCardHover}
                      onTapPlay={handleTapPlay}
                      isCompatibleWithDragZone={activeId !== null && activeId !== card.id && compatible}
                    />
                  </div>
                );
              })
            )}
          </div>

          {/* Legend */}
          <div className="flex gap-3 px-1 flex-wrap">
            {ALL_ZONES.map(z => {
              const cfg = ZONE_CONFIGS[z];
              return (
                <div key={z} className="flex items-center gap-1">
                  <span className="text-zinc-500 text-xs">{cfg.label.split(' ')[0]}</span>
                  <span className="text-zinc-600 text-xs">{cfg.tooltip}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeCard && (
            <SingleCard card={activeCard} playerEnergy={playerEnergy} currentTick={currentTick} isDragOverlay />
          )}
        </DragOverlay>
      </DndContext>

      {/* Terms Modal */}
      {pendingCard && (
        <TermsModal
          card={pendingCard}
          onConfirm={handleTermsConfirm}
          onCancel={() => setPendingPlayId(null)}
        />
      )}
    </>
  );
}

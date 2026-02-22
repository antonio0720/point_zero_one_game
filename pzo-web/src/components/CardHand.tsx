/**
 * T00478 — CardHand.tsx
 * Draggable card hand — @dnd-kit drag and drop
 * - Cards show name/type/cost/leverage/description
 * - Hover shows combo synergies
 * - Insufficient energy grays card
 *
 * Deploy to: pzo-web/src/components/CardHand.tsx
 */

'use client';

import React, { useState } from 'react';
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

// ─── Types ────────────────────────────────────────────────────────────────────

export type DeckType = 'OPPORTUNITY' | 'IPA' | 'FUBAR' | 'MISSED_OPPORTUNITY' | 'PRIVILEGED' | 'SO';

export interface ComboSynergy {
  comboId: string;
  label: string;
  description: string;
  requiredCardIds: string[];
  bonusDescription: string;
}

export interface Card {
  id: string;
  name: string;
  type: DeckType;
  subtype: string | null;
  description: string;
  cost: number | null;          // cash cost (OPPORTUNITY, IPA)
  leverage: number | null;      // debt amount
  downPayment: number | null;   // energy equivalent
  cashflowMonthly: number | null;
  roiPct: number | null;
  cashImpact: number | null;    // for FUBAR / SO
  turnsLost: number | null;     // for MISSED_OPPORTUNITY
  value: number | null;         // for PRIVILEGED
  energyCost: number;           // abstract energy (mapped from downPayment or cost)
  synergies: ComboSynergy[];
}

export interface CardHandProps {
  cards: Card[];
  playerEnergy: number;            // current available cash/energy
  activeCardIds?: string[];        // cards currently selected or played
  onPlayCard: (cardId: string, targetZone: string) => void;
  onCardHover?: (cardId: string | null) => void;
  className?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DECK_COLORS: Record<DeckType, { bg: string; border: string; badge: string; text: string }> = {
  OPPORTUNITY:       { bg: 'bg-emerald-950', border: 'border-emerald-500', badge: 'bg-emerald-500', text: 'text-emerald-400' },
  IPA:               { bg: 'bg-blue-950',    border: 'border-blue-500',    badge: 'bg-blue-500',    text: 'text-blue-400' },
  FUBAR:             { bg: 'bg-red-950',     border: 'border-red-500',     badge: 'bg-red-500',     text: 'text-red-400' },
  MISSED_OPPORTUNITY:{ bg: 'bg-orange-950',  border: 'border-orange-500',  badge: 'bg-orange-500',  text: 'text-orange-400' },
  PRIVILEGED:        { bg: 'bg-yellow-950',  border: 'border-yellow-400',  badge: 'bg-yellow-400',  text: 'text-yellow-300' },
  SO:                { bg: 'bg-zinc-900',    border: 'border-zinc-500',    badge: 'bg-zinc-600',    text: 'text-zinc-300' },
};

const DECK_LABELS: Record<DeckType, string> = {
  OPPORTUNITY: 'Opportunity',
  IPA: 'Income Asset',
  FUBAR: 'FUBAR',
  MISSED_OPPORTUNITY: 'Missed',
  PRIVILEGED: 'Privileged',
  SO: 'Obstacle',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatMoney(n: number | null): string {
  if (n === null) return '—';
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function isAffordable(card: Card, energy: number): boolean {
  return card.energyCost <= energy;
}

// ─── Card UI Component ────────────────────────────────────────────────────────

interface SingleCardProps {
  card: Card;
  playerEnergy: number;
  isBeingDragged?: boolean;
  isDragOverlay?: boolean;
  onHover?: (cardId: string | null) => void;
}

function SingleCard({ card, playerEnergy, isBeingDragged = false, isDragOverlay = false, onHover }: SingleCardProps) {
  const [showSynergies, setShowSynergies] = useState(false);
  const affordable = isAffordable(card, playerEnergy);
  const colors = DECK_COLORS[card.type];

  const cardOpacity = !affordable && !isDragOverlay ? 'opacity-40 grayscale' : 'opacity-100';
  const dragScale = isBeingDragged ? 'scale-105 rotate-2 shadow-2xl shadow-black/60' : '';
  const hoverScale = !isBeingDragged && affordable ? 'hover:-translate-y-2 hover:shadow-xl hover:shadow-black/50' : '';

  return (
    <div
      className={`
        relative w-36 h-52 rounded-xl border-2 ${colors.bg} ${colors.border}
        select-none cursor-grab active:cursor-grabbing
        transition-all duration-200 ease-out
        flex flex-col overflow-hidden
        ${cardOpacity} ${dragScale} ${hoverScale}
      `}
      onMouseEnter={() => {
        setShowSynergies(true);
        onHover?.(card.id);
      }}
      onMouseLeave={() => {
        setShowSynergies(false);
        onHover?.(null);
      }}
    >
      {/* Type Badge */}
      <div className={`${colors.badge} px-2 py-0.5 text-xs font-bold text-white tracking-wide`}>
        {DECK_LABELS[card.type]}
      </div>

      {/* Card Name */}
      <div className="px-2 pt-1.5 pb-1">
        <p className="text-white font-semibold text-xs leading-tight line-clamp-2">
          {card.name}
        </p>
      </div>

      {/* Energy Cost indicator */}
      <div className="absolute top-1 right-1">
        <div className={`
          w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
          ${affordable ? 'bg-white/20 text-white' : 'bg-red-900/80 text-red-300'}
          border border-white/20
        `}>
          {card.energyCost >= 1000 ? `${Math.round(card.energyCost / 1000)}K` : card.energyCost}
        </div>
      </div>

      {/* Stats */}
      <div className="px-2 space-y-0.5 flex-1">
        {card.cashflowMonthly !== null && (
          <div className="flex justify-between items-center">
            <span className="text-zinc-400 text-xs">CF/mo</span>
            <span className="text-emerald-400 text-xs font-mono font-semibold">
              +{formatMoney(card.cashflowMonthly)}
            </span>
          </div>
        )}
        {card.downPayment !== null && (
          <div className="flex justify-between items-center">
            <span className="text-zinc-400 text-xs">Down</span>
            <span className="text-white text-xs font-mono">{formatMoney(card.downPayment)}</span>
          </div>
        )}
        {card.leverage !== null && (
          <div className="flex justify-between items-center">
            <span className="text-zinc-400 text-xs">Debt</span>
            <span className="text-orange-400 text-xs font-mono">{formatMoney(card.leverage)}</span>
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
            <span className="text-red-400 text-xs font-mono">{formatMoney(card.cashImpact)}</span>
          </div>
        )}
        {card.value !== null && (
          <div className="flex justify-between items-center">
            <span className="text-zinc-400 text-xs">Value</span>
            <span className="text-yellow-300 text-xs font-mono">{formatMoney(card.value)}</span>
          </div>
        )}
        {card.turnsLost !== null && (
          <div className="flex justify-between items-center">
            <span className="text-zinc-400 text-xs">Skip</span>
            <span className="text-red-400 text-xs font-mono">{card.turnsLost} turn{card.turnsLost > 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* Description */}
      <div className="px-2 pb-2">
        <p className="text-zinc-400 text-xs line-clamp-2 leading-tight">{card.description}</p>
      </div>

      {/* Not Affordable Overlay */}
      {!affordable && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl">
          <span className="text-red-400 text-xs font-bold tracking-wider uppercase bg-black/70 px-2 py-0.5 rounded">
            Insufficient funds
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
          {/* Tooltip arrow */}
          <div className="w-2 h-2 bg-zinc-900 border-r border-b border-zinc-600 rotate-45 mx-auto -mt-1" />
        </div>
      )}
    </div>
  );
}

// ─── Draggable Card ───────────────────────────────────────────────────────────

function DraggableCard({ card, playerEnergy, onHover }: {
  card: Card;
  playerEnergy: number;
  onHover?: (id: string | null) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({
    id: card.id,
    disabled: !isAffordable(card, playerEnergy),
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <SingleCard
        card={card}
        playerEnergy={playerEnergy}
        isBeingDragged={isDragging}
        onHover={onHover}
      />
    </div>
  );
}

// ─── Drop Zone ────────────────────────────────────────────────────────────────

function PlayZone() {
  const { setNodeRef, isOver } = useDroppable({ id: 'play-zone' });
  return (
    <div
      ref={setNodeRef}
      className={`
        w-full h-24 border-2 border-dashed rounded-xl
        flex items-center justify-center
        transition-all duration-200
        ${isOver
          ? 'border-emerald-400 bg-emerald-900/20 scale-105'
          : 'border-zinc-700 bg-zinc-900/40'}
      `}
    >
      <span className={`text-sm font-semibold ${isOver ? 'text-emerald-400' : 'text-zinc-600'}`}>
        {isOver ? 'Drop to Play' : 'Play Zone — drag a card here'}
      </span>
    </div>
  );
}

// ─── Main CardHand Component ──────────────────────────────────────────────────

export default function CardHand({
  cards,
  playerEnergy,
  onPlayCard,
  onCardHover,
  className = '',
}: CardHandProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const activeCard = activeId ? cards.find(c => c.id === activeId) ?? null : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (over && over.id === 'play-zone') {
      onPlayCard(active.id as string, 'play-zone');
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className={`flex flex-col gap-4 ${className}`}>
        {/* Play Zone */}
        <PlayZone />

        {/* Energy Bar */}
        <div className="flex items-center gap-2 px-1">
          <span className="text-zinc-400 text-xs font-semibold uppercase tracking-wide">Cash Available</span>
          <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${Math.min(100, (playerEnergy / 100_000) * 100)}%` }}
            />
          </div>
          <span className="text-emerald-400 font-mono text-xs font-bold">
            {formatMoney(playerEnergy)}
          </span>
        </div>

        {/* Hand */}
        <div className="flex gap-2 overflow-x-auto pb-2 snap-x">
          {cards.length === 0 ? (
            <div className="w-full text-center text-zinc-600 text-sm py-8">
              No cards in hand
            </div>
          ) : (
            cards.map(card => (
              <div key={card.id} className="snap-start flex-shrink-0">
                <DraggableCard
                  card={card}
                  playerEnergy={playerEnergy}
                  onHover={onCardHover}
                />
              </div>
            ))
          )}
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeCard && (
          <SingleCard
            card={activeCard}
            playerEnergy={playerEnergy}
            isDragOverlay
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}

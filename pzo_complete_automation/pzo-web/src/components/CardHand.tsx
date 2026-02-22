/**
 * CardHand — Draggable card hand component
 * PZO_T00478 | Phase: PZO_P03_BROWSER_UI
 * File: pzo-web/src/components/CardHand.tsx
 * Uses @dnd-kit/core + @dnd-kit/sortable
 */

import React, { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ── Types ─────────────────────────────────────────────────────────────────────
export type CardType = 'asset' | 'action' | 'event' | 'mechanic' | 'persona' | 'market';

export interface CardData {
  id: string;
  name: string;
  type: CardType;
  cost: number;
  leverage: number;
  description: string;
  comboSynergies?: string[];  // names of cards this combos with
}

export interface CardHandProps {
  cards: CardData[];
  energyAvailable: number;
  onCardPlay?: (cardId: string) => void;
  onOrderChange?: (orderedIds: string[]) => void;
  maxHandSize?: number;
}

// ── Color map ─────────────────────────────────────────────────────────────────
const TYPE_COLORS: Record<CardType, { bg: string; border: string; badge: string }> = {
  asset:    { bg: '#1a2e1a', border: '#4ade80', badge: '#16a34a' },
  action:   { bg: '#1e1a2e', border: '#818cf8', badge: '#4f46e5' },
  event:    { bg: '#2e1a1a', border: '#f87171', badge: '#dc2626' },
  mechanic: { bg: '#1a2530', border: '#38bdf8', badge: '#0284c7' },
  persona:  { bg: '#2e2a1a', border: '#fbbf24', badge: '#d97706' },
  market:   { bg: '#2a1a2e', border: '#e879f9', badge: '#a21caf' },
};

// ── Single Card ───────────────────────────────────────────────────────────────
interface SortableCardProps {
  card: CardData;
  energyAvailable: number;
  onPlay?: (cardId: string) => void;
}

function SortableCard({ card, energyAvailable, onPlay }: SortableCardProps) {
  const [hovered, setHovered] = useState(false);
  const insufficient = card.cost > energyAvailable;
  const colors = TYPE_COLORS[card.type];

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id, disabled: insufficient });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : insufficient ? 0.45 : 1,
    zIndex: isDragging ? 999 : hovered ? 10 : 1,
    position: 'relative',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Card body */}
      <div
        style={{
          width: 130,
          minHeight: 190,
          backgroundColor: insufficient ? '#1a1a1a' : colors.bg,
          border: `2px solid ${insufficient ? '#333' : colors.border}`,
          borderRadius: 10,
          padding: '10px 10px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          cursor: insufficient ? 'not-allowed' : 'grab',
          boxShadow: hovered && !insufficient
            ? `0 0 16px ${colors.border}88`
            : '0 2px 8px #0008',
          transition: 'box-shadow 0.15s ease, transform 0.15s ease',
          transform: hovered && !insufficient && !isDragging ? 'translateY(-14px) scale(1.04)' : undefined,
          filter: insufficient ? 'grayscale(0.8)' : undefined,
          userSelect: 'none',
        }}
      >
        {/* Type badge */}
        <div style={{
          backgroundColor: insufficient ? '#333' : colors.badge,
          color: '#fff',
          fontSize: 9,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 1,
          borderRadius: 4,
          padding: '2px 6px',
          alignSelf: 'flex-start',
        }}>
          {card.type}
        </div>

        {/* Name */}
        <div style={{
          color: insufficient ? '#555' : '#f0f0f0',
          fontWeight: 700,
          fontSize: 12,
          lineHeight: 1.3,
        }}>
          {card.name}
        </div>

        {/* Cost + Leverage row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
          <span style={{
            color: insufficient ? '#f87171' : '#fbbf24',
            fontSize: 11,
            fontWeight: 700,
          }}>
            ⚡ {card.cost}
          </span>
          {card.leverage > 0 && (
            <span style={{ color: '#38bdf8', fontSize: 11, fontWeight: 600 }}>
              {card.leverage}×
            </span>
          )}
        </div>

        {/* Description */}
        <div style={{
          color: insufficient ? '#444' : '#9ca3af',
          fontSize: 10,
          lineHeight: 1.4,
          flexGrow: 1,
        }}>
          {card.description.length > 70 ? card.description.slice(0, 67) + '…' : card.description}
        </div>

        {/* Insufficient energy warning */}
        {insufficient && (
          <div style={{
            color: '#f87171',
            fontSize: 9,
            fontWeight: 700,
            textAlign: 'center',
            borderTop: '1px solid #333',
            paddingTop: 4,
          }}>
            NEED {card.cost - energyAvailable} MORE ⚡
          </div>
        )}

        {/* Play button (hover only, sufficient energy) */}
        {hovered && !insufficient && onPlay && (
          <button
            onClick={e => { e.stopPropagation(); onPlay(card.id); }}
            style={{
              backgroundColor: colors.badge,
              color: '#fff',
              border: 'none',
              borderRadius: 5,
              padding: '4px 0',
              fontSize: 10,
              fontWeight: 700,
              cursor: 'pointer',
              width: '100%',
            }}
          >
            PLAY
          </button>
        )}
      </div>

      {/* Combo synergy tooltip */}
      {hovered && !insufficient && card.comboSynergies && card.comboSynergies.length > 0 && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#0f172a',
          border: '1px solid #334155',
          borderRadius: 8,
          padding: '8px 12px',
          minWidth: 160,
          zIndex: 100,
          pointerEvents: 'none',
          marginBottom: 8,
        }}>
          <div style={{ color: '#94a3b8', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
            Combos With
          </div>
          {card.comboSynergies.map(s => (
            <div key={s} style={{ color: '#e2e8f0', fontSize: 10, padding: '1px 0' }}>
              ✦ {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── CardHand ──────────────────────────────────────────────────────────────────
export function CardHand({
  cards: initialCards,
  energyAvailable,
  onCardPlay,
  onOrderChange,
  maxHandSize = 10,
}: CardHandProps) {
  const [cards, setCards] = useState<CardData[]>(initialCards.slice(0, maxHandSize));
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = cards.findIndex(c => c.id === active.id);
    const newIndex = cards.findIndex(c => c.id === over.id);
    const reordered = arrayMove(cards, oldIndex, newIndex);
    setCards(reordered);
    onOrderChange?.(reordered.map(c => c.id));
  }

  if (cards.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: '#475569', padding: '32px 0', fontStyle: 'italic' }}>
        Hand is empty
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div style={{ padding: '24px 16px 48px', position: 'relative' }}>
        {/* Energy display */}
        <div style={{
          textAlign: 'center',
          color: '#fbbf24',
          fontSize: 12,
          fontWeight: 700,
          marginBottom: 16,
          letterSpacing: 1,
        }}>
          ⚡ {energyAvailable} ENERGY AVAILABLE
        </div>

        <SortableContext items={cards.map(c => c.id)} strategy={horizontalListSortingStrategy}>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            justifyContent: 'center',
            alignItems: 'flex-end',
            minHeight: 220,
          }}>
            {cards.map(card => (
              <SortableCard
                key={card.id}
                card={card}
                energyAvailable={energyAvailable}
                onPlay={onCardPlay}
              />
            ))}
          </div>
        </SortableContext>

        {cards.length >= maxHandSize && (
          <div style={{ textAlign: 'center', color: '#ef4444', fontSize: 10, marginTop: 12, fontWeight: 600 }}>
            HAND LIMIT REACHED ({maxHandSize} cards)
          </div>
        )}
      </div>
    </DndContext>
  );
}

export default CardHand;

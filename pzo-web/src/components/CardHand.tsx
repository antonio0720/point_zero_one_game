/**
 * CardHand.tsx — PZO Strategic Card Hand
 * Logic preserved · Visual layer rebuilt: Syne + IBM Plex Mono · Inline styles · Mobile-first
 * Density6 LLC · Confidential
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

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  void:    '#030308',
  card:    '#0E0E20',
  cardHi:  '#14142E',
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
  blue:    '#4488FF',
  mono:    "'IBM Plex Mono', 'JetBrains Mono', monospace",
  display: "'Syne', 'Outfit', system-ui, sans-serif",
};

// ─── Types (re-exported) ──────────────────────────────────────────────────────
export type DeckType = 'OPPORTUNITY' | 'IPA' | 'FUBAR' | 'MISSED_OPPORTUNITY' | 'PRIVILEGED' | 'SO';

export interface ComboSynergy {
  comboId: string; label: string; description: string;
  requiredCardIds: string[]; bonusDescription: string;
}

export interface Card {
  id: string; name: string; type: DeckType; subtype: string | null;
  description: string; cost: number | null; leverage: number | null;
  downPayment: number | null; cashflowMonthly: number | null;
  roiPct: number | null; cashImpact: number | null;
  turnsLost: number | null; value: number | null;
  energyCost: number; synergies: ComboSynergy[];
  extension?: CardExtension;
  expiresAtTick?: number | null;
  activationDelayTicks?: number | null;
  biasFlag?: BiasState | null;
  counterpartyVisible?: boolean;
  counterpartyLabel?: string | null;
  currentTick?: number;
}

export interface CardHandProps {
  cards: Card[]; playerEnergy: number; activeCardIds?: string[];
  onPlayCard: (cardId: string, targetZone: string) => void;
  onCardHover?: (cardId: string | null) => void;
  currentTick?: number;
  activeBiases?: Partial<Record<BiasState, { intensity: number }>>;
  className?: string;
}

// ─── Deck visual config ───────────────────────────────────────────────────────
const DECK_CFG: Record<DeckType, { bg: string; border: string; accent: string; badge: string; label: string }> = {
  OPPORTUNITY:        { bg:'rgba(34,221,136,0.07)',   border:'rgba(34,221,136,0.35)',  accent:T.green,   badge:'#22DD88', label:'Opportunity' },
  IPA:                { bg:'rgba(68,136,255,0.07)',   border:'rgba(68,136,255,0.35)',  accent:T.blue,    badge:'#4488FF', label:'Income Asset' },
  FUBAR:              { bg:'rgba(255,77,77,0.08)',    border:'rgba(255,77,77,0.35)',   accent:T.red,     badge:'#FF4D4D', label:'FUBAR'        },
  MISSED_OPPORTUNITY: { bg:'rgba(255,140,0,0.07)',    border:'rgba(255,140,0,0.35)',   accent:T.orange,  badge:'#FF8C00', label:'Missed Opp'   },
  PRIVILEGED:         { bg:'rgba(255,215,0,0.07)',    border:'rgba(255,215,0,0.35)',   accent:T.yellow,  badge:'#FFD700', label:'Privileged'   },
  SO:                 { bg:'rgba(144,144,180,0.06)',  border:'rgba(144,144,180,0.25)', accent:T.textSub, badge:'#9090B4', label:'Obstacle'     },
};

const ZONE_COMPAT: Record<ZoneId, DeckType[]> = {
  BUILD:   ['OPPORTUNITY', 'IPA'],
  RESERVE: ['OPPORTUNITY', 'IPA', 'SO'],
  SCALE:   ['OPPORTUNITY', 'IPA', 'PRIVILEGED'],
  LEARN:   ['OPPORTUNITY', 'IPA', 'SO'],
  FLIP:    ['OPPORTUNITY', 'IPA', 'PRIVILEGED'],
};

const ALL_ZONES: ZoneId[] = ['BUILD', 'RESERVE', 'SCALE', 'LEARN', 'FLIP'];
const PLAYABLE: DeckType[] = ['OPPORTUNITY', 'IPA', 'PRIVILEGED', 'SO'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number | null): string {
  if (n === null) return '—';
  const v = Math.abs(n), s = n < 0 ? '-' : '';
  if (v >= 1_000_000) return `${s}$${(v/1e6).toFixed(1)}M`;
  if (v >= 1_000)     return `${s}$${(v/1e3).toFixed(0)}K`;
  return `${s}$${Math.round(v).toLocaleString()}`;
}

const isAffordable = (card: Card, energy: number) => card.energyCost <= energy;

// ─── Terms Modal ──────────────────────────────────────────────────────────────
interface TermsModalProps {
  card: Card;
  onConfirm: (terms: NonNullable<CardExtension['terms']>) => void;
  onCancel: () => void;
}

function TermsModal({ card, onConfirm, onCancel }: TermsModalProps) {
  const [leverage, setLeverage]   = useState(60);
  const [duration, setDuration]   = useState(12);
  const [variable, setVariable]   = useState(false);
  const [insured,  setInsured]    = useState(false);

  const grossCF   = (card.cashflowMonthly ?? 0) * (1 + leverage / 300);
  const debtSvc   = ((card.leverage ?? 0) * (leverage / 100)) * 0.008;
  const netCF     = grossCF - debtSvc;

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:200,
      display:'flex', alignItems:'center', justifyContent:'center',
      background:'rgba(0,0,0,0.85)', backdropFilter:'blur(8px)',
      padding:16,
    }}>
      <div style={{
        background:'#0F0F22', border:'1px solid rgba(255,255,255,0.12)',
        borderRadius:14, padding:'clamp(16px,4vw,24px)',
        width:'100%', maxWidth:340,
        boxShadow:'0 24px 80px rgba(0,0,0,0.8)',
      }}>
        <h3 style={{ fontSize:15, fontWeight:800, color:T.text, fontFamily:T.display, marginBottom:4 }}>
          {card.name}
        </h3>
        <p style={{ fontSize:11, fontFamily:T.mono, color:T.textSub, marginBottom:20 }}>
          Structure this deal before playing.
        </p>

        {/* Leverage */}
        <div style={{ marginBottom:16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
            <label style={{ fontSize:11, fontFamily:T.mono, color:T.textSub }}>Leverage</label>
            <span style={{ fontSize:12, fontFamily:T.mono, fontWeight:700, color:T.text }}>{leverage}%</span>
          </div>
          <input type="range" min={0} max={80} step={5} value={leverage}
            onChange={e => setLeverage(Number(e.target.value))}
            style={{ width:'100%', accentColor:T.indigo }} />
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, fontFamily:T.mono, color:T.textMut, marginTop:4 }}>
            <span>None</span><span>Conservative</span><span>Aggressive</span>
          </div>
        </div>

        {/* Duration */}
        <div style={{ marginBottom:16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
            <label style={{ fontSize:11, fontFamily:T.mono, color:T.textSub }}>Duration</label>
            <span style={{ fontSize:12, fontFamily:T.mono, fontWeight:700, color:T.text }}>{duration} mo</span>
          </div>
          <input type="range" min={1} max={36} step={1} value={duration}
            onChange={e => setDuration(Number(e.target.value))}
            style={{ width:'100%', accentColor:T.indigo }} />
        </div>

        {/* Toggles */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:16 }}>
          {[
            { active:variable, toggle:() => setVariable(!variable), label: variable ? '⚡ Variable Rate' : 'Fixed Rate', color:'#FF8C00' },
            { active:insured,  toggle:() => setInsured(!insured),   label: insured ? '🛡 Insured' : 'No Insurance',       color:T.blue    },
          ].map(({ active, toggle, label, color }) => (
            <button
              key={label}
              onClick={toggle}
              style={{
                padding:'9px 8px', borderRadius:8, cursor:'pointer',
                fontSize:11, fontFamily:T.mono, fontWeight:700,
                border:`1px solid ${active ? color : 'rgba(255,255,255,0.08)'}`,
                background: active ? `${color}18` : 'rgba(255,255,255,0.03)',
                color: active ? color : T.textSub,
                transition:'all 0.2s ease', minHeight:38,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Net CF preview */}
        <div style={{
          padding:'12px 14px', borderRadius:10, marginBottom:18,
          background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)',
        }}>
          {[
            { label:'Gross CF/mo',   value:`+${fmt(Math.round(grossCF))}`, color:'#88EEBB' },
            { label:'Debt Service',  value:`−${fmt(Math.round(debtSvc))}`, color:T.red     },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ display:'flex', justifyContent:'space-between', marginBottom:6, fontSize:11, fontFamily:T.mono }}>
              <span style={{ color:T.textSub }}>{label}</span>
              <span style={{ color, fontWeight:700 }}>{value}</span>
            </div>
          ))}
          <div style={{ height:1, background:'rgba(255,255,255,0.07)', marginBottom:8 }} />
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, fontFamily:T.mono, fontWeight:700 }}>
            <span style={{ color:T.text }}>Net CF/mo</span>
            <span style={{ color: netCF >= 0 ? T.green : T.red }}>
              {netCF >= 0 ? '+' : ''}{fmt(Math.round(netCF))}
            </span>
          </div>
          {variable && (
            <p style={{ fontSize:10, color:T.orange, fontFamily:T.mono, marginTop:8 }}>
              ⚡ Variable: rate can spike with market regime
            </p>
          )}
        </div>

        {/* Actions */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          <button
            onClick={onCancel}
            style={{
              padding:'12px', borderRadius:10, cursor:'pointer',
              fontSize:12, fontFamily:T.mono, fontWeight:700,
              background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)',
              color:T.textSub, minHeight:44,
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm({ leveragePct: leverage, durationMonths: duration, isVariableRate: variable, hasInsuranceAddon: insured })}
            style={{
              padding:'12px', borderRadius:10, cursor:'pointer',
              fontSize:12, fontFamily:T.display, fontWeight:800,
              background:T.indigo, border:'none', color:'#000',
              boxShadow:`0 0 20px rgba(129,140,248,0.35)`, minHeight:44,
            }}
          >
            Confirm Play
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Single Card ──────────────────────────────────────────────────────────────
interface SingleCardProps {
  card: Card; playerEnergy: number; currentTick?: number;
  isBeingDragged?: boolean; isDragOverlay?: boolean;
  isCompatibleWithDragZone?: boolean;
  onHover?: (id: string | null) => void;
  onTapPlay?: (id: string) => void;
}

function SingleCard({
  card, playerEnergy, currentTick = 0,
  isBeingDragged = false, isDragOverlay = false,
  isCompatibleWithDragZone = false,
  onHover, onTapPlay,
}: SingleCardProps) {
  const [showSynergies, setShowSynergies] = useState(false);
  const cfg         = DECK_CFG[card.type];
  const affordable  = isAffordable(card, playerEnergy);
  const badge       = getExpiryBadge(currentTick, card.expiresAtTick ?? null);
  const expired     = badge === 'EXPIRED';
  const hasDelay    = (card.activationDelayTicks ?? 0) > 0;
  const canPlay     = affordable && !expired;

  const opacity = (!canPlay && !isDragOverlay) ? 0.38 : 1;
  const scale   = isBeingDragged ? 'scale(1.05) rotate(2deg)' : 'scale(1)';
  const ring    = isCompatibleWithDragZone ? `0 0 0 2px #818CF8` : 'none';

  return (
    <div
      style={{
        position:'relative', width:140, height:220, borderRadius:10,
        background: cfg.bg, border:`2px solid ${cfg.border}`,
        display:'flex', flexDirection:'column', overflow:'hidden',
        opacity, transform:scale, boxShadow:ring,
        cursor: canPlay ? 'grab' : 'default',
        transition:'opacity 0.2s, transform 0.2s, box-shadow 0.2s',
        flexShrink:0,
      }}
      onMouseEnter={() => { setShowSynergies(true); onHover?.(card.id); }}
      onMouseLeave={() => { setShowSynergies(false); onHover?.(null); }}
    >
      {/* Type badge */}
      <div style={{
        padding:'4px 8px', fontSize:9, fontFamily:T.mono, fontWeight:700,
        color:'#000', background:cfg.badge,
        display:'flex', justifyContent:'space-between', alignItems:'center',
        letterSpacing:'0.08em',
      }}>
        <span>{cfg.label.toUpperCase()}</span>
        {badge && badge !== 'HOT' && (
          <span style={{
            fontSize:8, padding:'1px 5px', borderRadius:3,
            background:'rgba(0,0,0,0.3)', color:'#fff',
            fontWeight:700, letterSpacing:'0.05em',
          }}>
            {badge}
          </span>
        )}
      </div>

      {/* Energy cost bubble */}
      <div style={{
        position:'absolute', top:4, right:4,
        width:26, height:26, borderRadius:'50%',
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:10, fontFamily:T.mono, fontWeight:700,
        background: affordable ? 'rgba(255,255,255,0.15)' : 'rgba(255,77,77,0.25)',
        border:`1px solid ${affordable ? 'rgba(255,255,255,0.2)' : 'rgba(255,77,77,0.4)'}`,
        color: affordable ? '#fff' : T.red,
      }}>
        {card.energyCost >= 1000 ? `${Math.round(card.energyCost/1000)}K` : card.energyCost || '—'}
      </div>

      {/* Card name */}
      <div style={{ padding:'6px 8px 3px' }}>
        <p style={{
          fontSize:11, fontWeight:700, color:T.text, lineHeight:1.35,
          fontFamily:T.display,
          display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden',
        }}>
          {card.name}
        </p>
        {card.subtype && (
          <p style={{ fontSize:9, color:cfg.accent, fontFamily:T.mono, opacity:0.8, marginTop:2 }}>
            {card.subtype}
          </p>
        )}
      </div>

      {/* Inline flags */}
      <div style={{ padding:'0 7px', display:'flex', flexDirection:'column', gap:3 }}>
        {card.biasFlag && (
          <div style={{
            fontSize:9, fontFamily:T.mono, padding:'2px 6px', borderRadius:4,
            background:'rgba(255,140,0,0.15)', border:'1px solid rgba(255,140,0,0.30)',
            color:T.orange,
          }}>
            ⚠️ {BIAS_CARD_MODIFIERS[card.biasFlag].label}
          </div>
        )}
        {hasDelay && (
          <div style={{
            fontSize:9, fontFamily:T.mono, padding:'2px 6px', borderRadius:4,
            background:'rgba(129,140,248,0.12)', border:'1px solid rgba(129,140,248,0.25)',
            color:T.indigo,
          }}>
            ⏳ Activates in {Math.ceil((card.activationDelayTicks ?? 0) / 12)} mo
          </div>
        )}
        {card.counterpartyVisible && card.counterpartyLabel && (() => {
          const reliable = card.counterpartyLabel === 'reliable';
          const risky    = ['fragile','predatory'].includes(card.counterpartyLabel);
          return (
            <div style={{
              fontSize:9, fontFamily:T.mono, padding:'2px 6px', borderRadius:4,
              background: reliable ? 'rgba(34,221,136,0.10)' : risky ? 'rgba(255,77,77,0.10)' : 'rgba(255,255,255,0.04)',
              border:`1px solid ${reliable ? 'rgba(34,221,136,0.25)' : risky ? 'rgba(255,77,77,0.25)' : 'rgba(255,255,255,0.08)'}`,
              color: reliable ? T.green : risky ? T.red : T.textSub,
            }}>
              🤝 {card.counterpartyLabel}
            </div>
          );
        })()}
      </div>

      {/* Stats */}
      <div style={{ flex:1, padding:'4px 8px', display:'flex', flexDirection:'column', gap:2 }}>
        {([
          [card.cashflowMonthly !== null, 'CF/mo',  `+${fmt(card.cashflowMonthly)}`, T.green ],
          [card.downPayment     !== null, 'Down',   fmt(card.downPayment),            T.text  ],
          [card.leverage        !== null, 'Debt',   fmt(card.leverage),               T.orange],
          [card.roiPct          !== null, 'ROI',    `${card.roiPct}%`,                T.yellow],
          [card.cashImpact      !== null, 'Impact', fmt(card.cashImpact),             T.red   ],
          [card.value           !== null, 'Value',  fmt(card.value),                  T.yellow],
          [card.turnsLost       !== null, 'Freeze', `${card.turnsLost}t`,             T.red   ],
        ] as [boolean, string, string, string][]).filter(([show]) => show).map(([, label, value, color]) => (
          <div key={label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:9, fontFamily:T.mono, color:T.textSub }}>{label}</span>
            <span style={{ fontSize:10, fontFamily:T.mono, fontWeight:700, color }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Description */}
      <div style={{ padding:'2px 8px 6px' }}>
        <p style={{
          fontSize:9, color:T.textMut, fontFamily:T.mono, lineHeight:1.4,
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
        }}>
          {card.description}
        </p>
      </div>

      {/* Tap-to-play button */}
      {onTapPlay && canPlay && PLAYABLE.includes(card.type) && (
        <button
          style={{
            position:'absolute', bottom:5, right:5,
            width:22, height:22, borderRadius:'50%',
            background:T.indigo, border:'none', color:'#000',
            fontSize:10, fontWeight:700, cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center',
            zIndex:10, boxShadow:`0 0 12px rgba(129,140,248,0.5)`,
          }}
          onClick={e => { e.stopPropagation(); onTapPlay(card.id); }}
          title="Quick play to Build zone"
        >
          ▶
        </button>
      )}

      {/* Overlays */}
      {!affordable && !expired && (
        <div style={{
          position:'absolute', inset:0, borderRadius:8,
          display:'flex', alignItems:'center', justifyContent:'center',
          background:'rgba(0,0,0,0.45)',
        }}>
          <span style={{
            fontSize:9, fontFamily:T.mono, fontWeight:700, letterSpacing:'0.1em',
            color:T.red, background:'rgba(0,0,0,0.7)',
            padding:'3px 8px', borderRadius:4, textTransform:'uppercase',
          }}>
            Insufficient funds
          </span>
        </div>
      )}
      {expired && (
        <div style={{
          position:'absolute', inset:0, borderRadius:8,
          display:'flex', alignItems:'center', justifyContent:'center',
          background:'rgba(0,0,0,0.6)',
        }}>
          <span style={{
            fontSize:9, fontFamily:T.mono, fontWeight:700,
            color:T.textMut, background:'rgba(0,0,0,0.7)',
            padding:'3px 8px', borderRadius:4, textTransform:'uppercase',
          }}>
            Opportunity Gone
          </span>
        </div>
      )}

      {/* Synergy tooltip */}
      {showSynergies && card.synergies.length > 0 && (
        <div style={{
          position:'absolute', bottom:'105%', left:'50%', transform:'translateX(-50%)',
          width:220, zIndex:60, pointerEvents:'none',
        }}>
          <div style={{
            background:'#181832', border:`1px solid ${T.borderM}`,
            borderRadius:10, padding:'10px 12px',
            boxShadow:'0 12px 40px rgba(0,0,0,0.7)',
          }}>
            <p style={{ fontSize:9, fontFamily:T.mono, color:T.textSub, letterSpacing:'0.15em', textTransform:'uppercase', marginBottom:8 }}>
              Combos
            </p>
            {card.synergies.slice(0, 3).map(s => (
              <div key={s.comboId} style={{ marginBottom:6 }}>
                <p style={{ fontSize:11, fontFamily:T.display, fontWeight:700, color:T.yellow }}>{s.label}</p>
                <p style={{ fontSize:10, fontFamily:T.mono, color:T.textSub }}>{s.bonusDescription}</p>
              </div>
            ))}
          </div>
          <div style={{
            width:8, height:8, background:'#181832',
            borderRight:`1px solid ${T.borderM}`, borderBottom:`1px solid ${T.borderM}`,
            transform:'rotate(45deg)', margin:'-4px auto 0',
          }} />
        </div>
      )}
    </div>
  );
}

// ─── Draggable Card ───────────────────────────────────────────────────────────
function DraggableCard({ card, playerEnergy, currentTick, onHover, onTapPlay, isCompatibleWithDragZone }: {
  card: Card; playerEnergy: number; currentTick?: number;
  onHover?: (id: string | null) => void; onTapPlay?: (id: string) => void;
  isCompatibleWithDragZone?: boolean;
}) {
  const badge   = getExpiryBadge(currentTick ?? 0, card.expiresAtTick ?? null);
  const canDrag = isAffordable(card, playerEnergy) && badge !== 'EXPIRED';

  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({
    id: card.id, disabled: !canDrag,
  });

  return (
    <div
      ref={setNodeRef}
      style={transform ? { transform:`translate3d(${transform.x}px,${transform.y}px,0)` } : undefined}
      {...attributes} {...listeners}
    >
      <SingleCard
        card={card} playerEnergy={playerEnergy} currentTick={currentTick}
        isBeingDragged={isDragging} onHover={onHover} onTapPlay={onTapPlay}
        isCompatibleWithDragZone={isCompatibleWithDragZone}
      />
    </div>
  );
}

// ─── Play Zone ────────────────────────────────────────────────────────────────
function PlayZone({ zoneId, isDragActive, activeCardType, isExpanded }: {
  zoneId: ZoneId; isDragActive: boolean; activeCardType: DeckType | null; isExpanded: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id:`zone-${zoneId}` });
  const cfg        = ZONE_CONFIGS[zoneId];
  const compatible = activeCardType ? ZONE_COMPAT[zoneId].includes(activeCardType) : true;
  const canReceive = isDragActive && compatible;

  const bg     = isOver && canReceive ? 'rgba(129,140,248,0.15)' :
                 isOver && !canReceive ? 'rgba(255,77,77,0.10)' :
                 canReceive ? 'rgba(129,140,248,0.06)' :
                 isDragActive && !compatible ? 'rgba(255,255,255,0.01)' :
                 'rgba(255,255,255,0.03)';
  const border = isOver && canReceive ? '#818CF8' :
                 isOver && !canReceive ? T.red :
                 canReceive ? 'rgba(129,140,248,0.4)' : 'rgba(255,255,255,0.08)';
  const labelColor = isOver && canReceive ? '#818CF8' :
                     isOver && !canReceive ? T.red : T.textSub;

  return (
    <div
      ref={setNodeRef}
      style={{
        flex:1, minWidth:80, borderRadius:8,
        border:`1px dashed ${border}`,
        background: bg,
        display:'flex', flexDirection:'column', alignItems:'center',
        justifyContent:'center', gap:4,
        padding: isExpanded ? '14px 6px' : '8px 4px',
        transition:'all 0.2s ease',
        transform: isOver && canReceive ? 'scale(1.04)' : 'scale(1)',
        opacity: isDragActive && !compatible ? 0.35 : 1,
      }}
    >
      <span style={{ fontSize:10, fontFamily:T.mono, fontWeight:700, color:labelColor, textAlign:'center' }}>
        {cfg.label}
      </span>
      {isExpanded && (
        <>
          <p style={{ fontSize:9, fontFamily:T.mono, color:T.textMut, textAlign:'center', lineHeight:1.4 }}>
            {cfg.description}
          </p>
          <p style={{ fontSize:9, fontFamily:T.mono, color: isOver && canReceive ? '#818CF8' : T.textMut, textAlign:'center' }}>
            {cfg.tooltip}
          </p>
          {!compatible && isDragActive && (
            <p style={{ fontSize:9, color:T.red, fontFamily:T.mono }}>Incompatible</p>
          )}
        </>
      )}
    </div>
  );
}

// ─── Bias Warning Bar ─────────────────────────────────────────────────────────
function BiasWarningBar({ biases }: { biases: Partial<Record<BiasState, { intensity: number }>> }) {
  const entries = Object.entries(biases) as [BiasState, { intensity: number }][];
  if (!entries.length) return null;
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:4 }}>
      {entries.map(([bias, state]) => {
        const mod = BIAS_CARD_MODIFIERS[bias];
        return (
          <div key={bias} style={{
            display:'flex', alignItems:'center', gap:5,
            padding:'3px 10px', borderRadius:20,
            background:'rgba(255,140,0,0.12)', border:'1px solid rgba(255,140,0,0.28)',
          }}>
            <span style={{ fontSize:10, fontFamily:T.mono, fontWeight:700, color:T.orange }}>{mod.label}</span>
            <span style={{ fontSize:10, fontFamily:T.mono, color:'rgba(255,140,0,0.7)' }}>
              {(state.intensity * 100).toFixed(0)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main CardHand ────────────────────────────────────────────────────────────
export default function CardHand({
  cards, playerEnergy, onPlayCard, onCardHover,
  currentTick = 0, activeBiases = {},
}: CardHandProps) {
  const [activeId,     setActiveId]     = useState<string | null>(null);
  const [pendingId,    setPendingId]    = useState<string | null>(null);
  const [expanded,     setExpanded]     = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const activeCard = activeId ? cards.find(c => c.id === activeId) ?? null : null;

  const handleDragStart = useCallback((e: DragStartEvent) => setActiveId(e.active.id as string), []);

  const handleDragEnd = useCallback((e: DragEndEvent) => {
    const { active, over } = e;
    setActiveId(null);
    if (!over) return;
    const zoneId = (over.id as string).replace('zone-', '') as ZoneId;
    const card   = cards.find(c => c.id === active.id);
    if (!card) return;
    if (!PLAYABLE.includes(card.type)) { onPlayCard(active.id as string, zoneId); return; }
    if (card.leverage !== null && card.leverage > 0) { setPendingId(active.id as string); }
    else { onPlayCard(active.id as string, zoneId); }
  }, [cards, onPlayCard]);

  const handleTapPlay = useCallback((id: string) => onPlayCard(id, 'BUILD'), [onPlayCard]);

  const handleTermsConfirm = useCallback((terms: NonNullable<CardExtension['terms']>) => {
    if (!pendingId) return;
    onPlayCard(pendingId, `BUILD|${JSON.stringify(terms)}`);
    setPendingId(null);
  }, [pendingId, onPlayCard]);

  const pendingCard = pendingId ? cards.find(c => c.id === pendingId) ?? null : null;

  const energyPct = Math.min(100, (playerEnergy / 100_000) * 100);
  const energyFmt = playerEnergy >= 1e6 ? `$${(playerEnergy/1e6).toFixed(1)}M`
    : playerEnergy >= 1e3 ? `$${(playerEnergy/1e3).toFixed(1)}K`
    : `$${playerEnergy.toLocaleString()}`;

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter}
        onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div style={{ display:'flex', flexDirection:'column', gap:12, fontFamily:T.display }}>
          <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=IBM+Plex+Mono:wght@400;600;700&display=swap');`}</style>

          {Object.keys(activeBiases).length > 0 && <BiasWarningBar biases={activeBiases} />}

          {/* Zone header */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:10, fontFamily:T.mono, fontWeight:700, color:T.textSub, letterSpacing:'0.15em', textTransform:'uppercase' }}>
              Play Zones
            </span>
            <button
              onClick={() => setExpanded(v => !v)}
              style={{
                fontSize:10, fontFamily:T.mono, color:T.textMut, background:'transparent',
                border:'none', cursor:'pointer', padding:0,
              }}
            >
              {expanded ? '▲ collapse' : '▼ details'}
            </button>
          </div>

          {/* Play zones */}
          <div style={{ display:'flex', gap:6 }}>
            {ALL_ZONES.map(z => (
              <PlayZone key={z} zoneId={z} isDragActive={activeId !== null}
                activeCardType={activeCard?.type ?? null} isExpanded={expanded} />
            ))}
          </div>

          {/* Energy / cash bar */}
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:10, fontFamily:T.mono, fontWeight:700, color:T.textSub, letterSpacing:'0.12em', textTransform:'uppercase', flexShrink:0 }}>
              Cash
            </span>
            <div style={{ flex:1, height:5, background:'#1A1A2E', borderRadius:3, overflow:'hidden' }}>
              <div style={{
                height:'100%', borderRadius:3, width:`${energyPct}%`,
                background:`linear-gradient(90deg, #11AA66, ${T.green})`,
                transition:'width 0.5s ease',
              }} />
            </div>
            <span style={{ fontSize:12, fontFamily:T.mono, fontWeight:700, color:T.green, flexShrink:0 }}>
              {energyFmt}
            </span>
          </div>

          {/* Card hand */}
          <div style={{
            display:'flex', gap:10, overflowX:'auto', paddingBottom:8,
            scrollSnapType:'x mandatory',
          }}>
            {cards.length === 0 ? (
              <div style={{ padding:'24px 0', textAlign:'center', color:T.textMut, fontSize:13, fontFamily:T.mono, width:'100%' }}>
                No cards in hand — drawing soon
              </div>
            ) : cards.map(card => (
              <div key={card.id} style={{ scrollSnapAlign:'start', flexShrink:0 }}>
                <DraggableCard
                  card={{ ...card, currentTick }}
                  playerEnergy={playerEnergy}
                  currentTick={currentTick}
                  onHover={onCardHover}
                  onTapPlay={handleTapPlay}
                  isCompatibleWithDragZone={activeId !== null && activeId !== card.id && !!activeCard && ZONE_COMPAT['BUILD'].includes(activeCard.type)}
                />
              </div>
            ))}
          </div>

          {/* Zone legend */}
          <div style={{ display:'flex', flexWrap:'wrap', gap:'4px 14px' }}>
            {ALL_ZONES.map(z => {
              const cfg = ZONE_CONFIGS[z];
              return (
                <div key={z} style={{ display:'flex', gap:4 }}>
                  <span style={{ fontSize:9, fontFamily:T.mono, color:T.textSub }}>{cfg.label.split(' ')[0]}</span>
                  <span style={{ fontSize:9, fontFamily:T.mono, color:T.textMut }}>{cfg.tooltip}</span>
                </div>
              );
            })}
          </div>
        </div>

        <DragOverlay>
          {activeCard && <SingleCard card={activeCard} playerEnergy={playerEnergy} currentTick={currentTick} isDragOverlay />}
        </DragOverlay>
      </DndContext>

      {pendingCard && (
        <TermsModal card={pendingCard}
          onConfirm={handleTermsConfirm}
          onCancel={() => setPendingId(null)}
        />
      )}
    </>
  );
}
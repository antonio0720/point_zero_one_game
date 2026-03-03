/**
 * ChatPanel.tsx — PZO Sovereign Chat · Engine-Integrated
 * Engine: battle/types · zero/types · pressure/types
 * Scale: 20M concurrent · Mobile-first · Syne + IBM Plex Mono
 * No Tailwind — inline styles + design token system (matches LeagueUI)
 * Density6 LLC · Point Zero One · Confidential
 */

import React, { useRef, useEffect, useState, useCallback, memo } from 'react';
import type { ChatMessage } from './chatTypes';
import { useChatEngine } from './useChatEngine';
import type { SabotageEvent } from './useChatEngine';

export type { SabotageEvent };

// ─── Design Tokens ─────────────────────────────────────────────────────────────
const T = {
  void:    '#030308',
  card:    '#0C0C1E',
  cardHi:  '#131328',
  cardEl:  '#191934',
  border:  'rgba(255,255,255,0.08)',
  borderM: 'rgba(255,255,255,0.16)',
  text:    '#F2F2FF',
  textSub: '#9090B4',
  textMut: '#505074',
  green:   '#22DD88',
  red:     '#FF4D4D',
  orange:  '#FF8C00',
  yellow:  '#FFD700',
  indigo:  '#818CF8',
  teal:    '#22D3EE',
  purple:  '#A855F7',
  mono:    "'IBM Plex Mono', 'JetBrains Mono', monospace",
  display: "'Syne', 'Outfit', system-ui, sans-serif",
};

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');`;

// ─── Message kind visual configs ───────────────────────────────────────────────
interface KindConfig {
  barColor:  string;
  bg:        string;
  border:    string;
  nameColor: string;
  accent:    string;
}

const KIND_CFG: Record<ChatMessage['kind'], KindConfig> = {
  PLAYER: {
    barColor:  'transparent',
    bg:        'transparent',
    border:    'transparent',
    nameColor: T.textSub,
    accent:    T.textSub,
  },
  SYSTEM: {
    barColor:  T.indigo,
    bg:        'rgba(129,140,248,0.07)',
    border:    'rgba(129,140,248,0.18)',
    nameColor: T.indigo,
    accent:    T.indigo,
  },
  MARKET_ALERT: {
    barColor:  T.orange,
    bg:        'rgba(255,140,0,0.07)',
    border:    'rgba(255,140,0,0.22)',
    nameColor: T.orange,
    accent:    T.orange,
  },
  ACHIEVEMENT: {
    barColor:  T.green,
    bg:        'rgba(34,221,136,0.07)',
    border:    'rgba(34,221,136,0.20)',
    nameColor: T.green,
    accent:    T.green,
  },
  BOT_TAUNT: {
    barColor:  T.red,
    bg:        'rgba(255,77,77,0.07)',
    border:    'rgba(255,77,77,0.22)',
    nameColor: T.red,
    accent:    T.red,
  },
  BOT_ATTACK: {
    barColor:  '#FF4D4D',
    bg:        'rgba(255,77,77,0.10)',
    border:    'rgba(255,77,77,0.32)',
    nameColor: '#FF4D4D',
    accent:    '#FF4D4D',
  },
  SHIELD_EVENT: {
    barColor:  T.teal,
    bg:        'rgba(34,211,238,0.07)',
    border:    'rgba(34,211,238,0.20)',
    nameColor: T.teal,
    accent:    T.teal,
  },
  CASCADE_ALERT: {
    barColor:  T.purple,
    bg:        'rgba(168,85,247,0.07)',
    border:    'rgba(168,85,247,0.22)',
    nameColor: T.purple,
    accent:    T.purple,
  },
  DEAL_RECAP: {
    barColor:  T.yellow,
    bg:        'rgba(255,215,0,0.07)',
    border:    'rgba(255,215,0,0.22)',
    nameColor: T.yellow,
    accent:    T.yellow,
  },
};

const RANK_COLOR: Record<string, string> = {
  'Managing Partner': T.yellow,
  'Senior Partner':   '#F6A623',
  'Partner':          T.indigo,
  'Junior Partner':   T.textSub,
  'Associate':        T.textMut,
  'You':              T.green,
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
function timeStr(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function initials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

// ─── System / Engine card message ──────────────────────────────────────────────
const SystemCard = memo(function SystemCard({ msg }: { msg: ChatMessage }) {
  const cfg = KIND_CFG[msg.kind];

  return (
    <div style={{
      display: 'flex', gap: 10, margin: '4px 8px',
      background: cfg.bg, border: `1px solid ${cfg.border}`,
      borderLeft: `3px solid ${cfg.barColor}`,
      borderRadius: 8, padding: '9px 11px',
    }}>
      {msg.emoji && (
        <span style={{ fontSize: 16, lineHeight: 1.4, flexShrink: 0 }}>{msg.emoji}</span>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: T.display, fontSize: 12, color: cfg.nameColor,
          fontWeight: 700, lineHeight: 1.45,
        }}>
          {msg.body}
        </div>

        {/* Bot source metadata */}
        {msg.botSource && (
          <div style={{
            marginTop: 5, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
          }}>
            <span style={{
              fontFamily: T.mono, fontSize: 8, color: cfg.accent,
              background: `${cfg.accent}14`, border: `1px solid ${cfg.accent}28`,
              padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.09em',
            }}>
              {msg.botSource.botState}
            </span>
            <span style={{
              fontFamily: T.mono, fontSize: 8, color: T.textMut, letterSpacing: '0.06em',
            }}>
              {msg.botSource.attackType.replace(/_/g, ' ')}
            </span>
          </div>
        )}

        {/* Proof hash */}
        {msg.proofHash && (
          <div style={{
            fontFamily: T.mono, fontSize: 9, color: T.yellow,
            marginTop: 5, wordBreak: 'break-all',
          }}>
            HASH: {msg.proofHash}
          </div>
        )}

        {/* Pressure / tick tier badges */}
        {(msg.pressureTier || msg.tickTier) && (
          <div style={{ display: 'flex', gap: 5, marginTop: 5 }}>
            {msg.pressureTier && (
              <span style={{
                fontFamily: T.mono, fontSize: 8, color: cfg.accent,
                background: `${cfg.accent}14`, padding: '2px 5px', borderRadius: 4,
                textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>
                {msg.pressureTier}
              </span>
            )}
            {msg.tickTier && (
              <span style={{
                fontFamily: T.mono, fontSize: 8, color: T.textMut,
                background: 'rgba(255,255,255,0.05)', padding: '2px 5px', borderRadius: 4,
                textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>
                {msg.tickTier}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

// ─── Player / NPC bubble message ───────────────────────────────────────────────
const PlayerBubble = memo(function PlayerBubble({ msg }: { msg: ChatMessage }) {
  const isMe      = msg.senderId === 'player-local';
  const rankColor = msg.senderRank ? (RANK_COLOR[msg.senderRank] ?? T.textSub) : T.textSub;

  return (
    <div style={{
      display: 'flex', gap: 8, padding: '4px 8px',
      flexDirection: isMe ? 'row-reverse' : 'row',
      alignItems: 'flex-start',
    }}>
      {/* Avatar — FIX: removed duplicate flexShrink */}
      <div style={{
        flexShrink: 0, width: 28, height: 28, borderRadius: '50%',
        background: isMe ? 'rgba(129,140,248,0.20)' : T.cardEl,
        border: `1px solid ${isMe ? 'rgba(129,140,248,0.35)' : T.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: T.mono, fontSize: 9, fontWeight: 700,
        color: isMe ? T.indigo : T.textSub, marginTop: 2,
      }}>
        {initials(msg.senderName)}
      </div>

      {/* Content */}
      <div style={{
        maxWidth: '78%', display: 'flex', flexDirection: 'column',
        alignItems: isMe ? 'flex-end' : 'flex-start',
      }}>
        {/* Name + rank + time */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4,
          flexDirection: isMe ? 'row-reverse' : 'row', flexWrap: 'wrap',
        }}>
          <span style={{
            fontFamily: T.mono, fontSize: 10, fontWeight: 700,
            color: isMe ? T.green : T.text,
          }}>
            {msg.senderName}
          </span>
          {msg.senderRank && (
            <span style={{
              fontFamily: T.mono, fontSize: 8, color: rankColor, fontWeight: 600,
            }}>
              {msg.senderRank}
            </span>
          )}
          <span style={{ fontFamily: T.mono, fontSize: 8, color: T.textMut }}>
            {timeStr(msg.ts)}
          </span>
        </div>

        {/* Bubble */}
        <div style={{
          fontFamily: T.display, fontSize: 12, lineHeight: 1.55,
          padding: '9px 13px', borderRadius: isMe ? '12px 2px 12px 12px' : '2px 12px 12px 12px',
          background: isMe
            ? 'linear-gradient(135deg, rgba(79,70,229,0.85) 0%, rgba(109,40,217,0.80) 100%)'
            : T.cardEl,
          border: isMe ? '1px solid rgba(129,140,248,0.30)' : `1px solid ${T.border}`,
          color: isMe ? T.text : '#D8D8F4',
          wordBreak: 'break-word',
        }}>
          {msg.body}
        </div>

        {msg.immutable && (
          <span style={{
            fontFamily: T.mono, fontSize: 8, color: T.textMut, marginTop: 3,
          }}>
            🔒 transcript locked
          </span>
        )}
      </div>
    </div>
  );
});

// ─── Message Router ────────────────────────────────────────────────────────────
const MessageRow = memo(function MessageRow({ msg }: { msg: ChatMessage }) {
  if (msg.kind === 'PLAYER') return <PlayerBubble msg={msg} />;
  return <SystemCard msg={msg} />;
});

// ─── Tab Button ────────────────────────────────────────────────────────────────
const TabBtn = memo(function TabBtn({
  label, icon, isActive, unread, onClick,
}: {
  label: string; icon: string; isActive: boolean; unread: number; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        position: 'relative', display: 'flex', alignItems: 'center', gap: 5,
        padding: '10px 12px', background: 'transparent', border: 'none', cursor: 'pointer',
        fontFamily: T.mono, fontSize: 9, fontWeight: 800, letterSpacing: '0.10em',
        textTransform: 'uppercase',
        color: isActive ? T.text : T.textMut,
        borderBottom: `2px solid ${isActive ? T.indigo : 'transparent'}`,
        transition: 'color 0.15s, border-color 0.15s',
        minHeight: 40, flexShrink: 0,
      }}
    >
      <span style={{ fontSize: 12 }}>{icon}</span>
      <span>{label}</span>
      {unread > 0 && (
        <span style={{
          position: 'absolute', top: 6, right: 4,
          minWidth: 15, height: 15, borderRadius: 99,
          background: T.red, color: '#fff',
          fontFamily: T.mono, fontSize: 8, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 2px',
          animation: 'pzo-badge-pulse 1.4s ease-in-out infinite',
        }}>
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  );
});

// ─── Online count (pseudo) ─────────────────────────────────────────────────────
function onlineCount(tick: number): number {
  return 12400 + (tick % 113) * 7;
}
function fmtOnline(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

// ─── ChatPanel Props ───────────────────────────────────────────────────────────
interface ChatPanelProps {
  gameCtx:      import('./chatTypes').GameChatContext;
  onSabotage?:  (event: SabotageEvent) => void;
  accessToken?: string | null;
}

// ─── ChatPanel ─────────────────────────────────────────────────────────────────
export const ChatPanel = memo(function ChatPanel({
  gameCtx, onSabotage, accessToken,
}: ChatPanelProps) {
  const {
    messages, activeTab, switchTab,
    chatOpen, toggleChat, sendMessage,
    unread, totalUnread, connected,
  } = useChatEngine(gameCtx, accessToken, onSabotage);

  const [draft,    setDraft]    = useState('');
  const [flashNew, setFlashNew] = useState(false);
  const bottomRef              = useRef<HTMLDivElement>(null);
  const prevMsgLen             = useRef(0);
  const inputRef               = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (chatOpen) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, chatOpen]);

  useEffect(() => {
    if (!chatOpen && messages.length > prevMsgLen.current) {
      setFlashNew(true);
      const t = setTimeout(() => setFlashNew(false), 1200);
      prevMsgLen.current = messages.length;
      return () => clearTimeout(t);
    }
    prevMsgLen.current = messages.length;
  }, [messages.length, chatOpen]);

  const handleSend = useCallback(() => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    sendMessage(trimmed);
    setDraft('');
    inputRef.current?.focus();
  }, [draft, sendMessage]);

  const visibleMsgs = messages.filter(m => m.channel === activeTab);

  const tabInputPlaceholder =
    activeTab === 'DEAL_ROOM'   ? 'Deal Room — transcript recorded...'
    : activeTab === 'SYNDICATE' ? 'Message your syndicate...'
    :                              'Message global...';

  return (
    <>
      <style>{FONT_IMPORT}</style>
      <style>{`
        @keyframes pzo-badge-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.7; transform: scale(0.92); }
        }
        @keyframes pzo-bubble-flash {
          0%, 100% { box-shadow: 0 0 0 0 rgba(129,140,248,0.4); }
          50%       { box-shadow: 0 0 0 8px rgba(129,140,248,0); }
        }
        @keyframes pzo-panel-in {
          from { opacity: 0; transform: translateY(20px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes pzo-online-dot {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
        .pzo-chat-scroll::-webkit-scrollbar { width: 3px; }
        .pzo-chat-scroll::-webkit-scrollbar-track { background: transparent; }
        .pzo-chat-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.10); border-radius: 99px; }
      `}</style>

      {/* ── Collapsed bubble ─────────────────────────────────────────────── */}
      {!chatOpen && (
        <button
          onClick={toggleChat}
          title="Open Chat"
          style={{
            position: 'fixed', bottom: 20, right: 16, zIndex: 50,
            width: 52, height: 52, borderRadius: '50%',
            background: T.card,
            border: `1.5px solid ${totalUnread > 0 ? T.indigo : T.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: 22,
            boxShadow: `0 4px 20px rgba(0,0,0,0.6), ${flashNew ? '0 0 0 4px rgba(129,140,248,0.30)' : 'none'}`,
            transition: 'all 0.2s',
            animation: flashNew ? 'pzo-bubble-flash 0.6s ease-out' : 'none',
          }}
        >
          💬
          {totalUnread > 0 && (
            <span style={{
              position: 'absolute', top: -4, right: -4,
              minWidth: 18, height: 18, borderRadius: 99,
              background: T.red, color: '#fff',
              fontFamily: T.mono, fontSize: 9, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 3px',
              boxShadow: '0 2px 8px rgba(255,77,77,0.50)',
              animation: 'pzo-badge-pulse 1.4s ease-in-out infinite',
            }}>
              {totalUnread > 99 ? '99' : totalUnread}
            </span>
          )}
        </button>
      )}

      {/* ── Expanded panel ───────────────────────────────────────────────── */}
      {chatOpen && (
        <div style={{
          position: 'fixed', bottom: 0, right: 0, zIndex: 50,
          width: 'min(100vw, 368px)',
          height: 'min(100dvh, 500px)',
          display: 'flex', flexDirection: 'column',
          background: `${T.void}FA`,
          backdropFilter: 'blur(12px)',
          border: `1px solid ${T.border}`,
          borderBottom: 'none', borderRight: 'none',
          borderTopLeftRadius: 16,
          boxShadow: '0 -4px 40px rgba(0,0,0,0.70), 0 0 0 1px rgba(255,255,255,0.04)',
          overflow: 'hidden',
          animation: 'pzo-panel-in 0.22s cubic-bezier(0.34,1.56,0.64,1) both',
          fontFamily: T.display,
        }}>

          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px',
            background: `${T.card}CC`,
            borderBottom: `1px solid ${T.border}`,
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 16 }}>💬</span>
            <span style={{
              fontFamily: T.display, fontSize: 12, fontWeight: 800,
              color: T.text, flex: 1, letterSpacing: '0.04em',
            }}>
              PZO CHAT
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: connected ? T.green : T.orange,
                animation: 'pzo-online-dot 2s ease-in-out infinite',
              }} />
              <span style={{ fontFamily: T.mono, fontSize: 9, color: T.textSub }}>
                {fmtOnline(onlineCount(gameCtx.tick))} online
              </span>
            </div>
            <button
              onClick={toggleChat}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                fontFamily: T.mono, fontSize: 13, color: T.textMut, padding: '4px',
                lineHeight: 1, borderRadius: 4,
                minWidth: 28, minHeight: 28,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              title="Minimize"
            >
              ╲╱
            </button>
          </div>

          {/* Tabs */}
          <div style={{
            display: 'flex', borderBottom: `1px solid ${T.border}`,
            background: `${T.cardHi}80`, flexShrink: 0, overflowX: 'auto',
          }}>
            <TabBtn label="GLOBAL"    icon="🌐" isActive={activeTab === 'GLOBAL'}    unread={unread.GLOBAL}    onClick={() => switchTab('GLOBAL')}    />
            <TabBtn label="SYNDICATE" icon="🏛️" isActive={activeTab === 'SYNDICATE'} unread={unread.SYNDICATE} onClick={() => switchTab('SYNDICATE')} />
            <TabBtn label="DEAL ROOM" icon="⚡" isActive={activeTab === 'DEAL_ROOM'} unread={unread.DEAL_ROOM} onClick={() => switchTab('DEAL_ROOM')} />
          </div>

          {/* Deal Room notice */}
          {activeTab === 'DEAL_ROOM' && (
            <div style={{
              flexShrink: 0, padding: '5px 14px',
              background: 'rgba(255,215,0,0.05)',
              borderBottom: '1px solid rgba(255,215,0,0.14)',
            }}>
              <span style={{
                fontFamily: T.mono, fontSize: 8, color: T.yellow,
                fontWeight: 700, letterSpacing: '0.10em',
              }}>
                🔒 TRANSCRIPT INTEGRITY ENFORCED — Logs are the official rivalry record
              </span>
            </div>
          )}

          {/* Messages */}
          <div
            className="pzo-chat-scroll"
            style={{
              flex: 1, overflowY: 'auto', padding: '4px 0',
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(255,255,255,0.08) transparent',
            }}
          >
            {visibleMsgs.length === 0 && (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', height: '100%', gap: 10,
                color: T.textMut,
              }}>
                <span style={{ fontSize: 28 }}>
                  {activeTab === 'DEAL_ROOM' ? '⚡' : activeTab === 'SYNDICATE' ? '🏛️' : '🌐'}
                </span>
                <span style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: '0.10em' }}>
                  NO MESSAGES YET
                </span>
              </div>
            )}
            {visibleMsgs.map(msg => (
              <MessageRow key={msg.id} msg={msg} />
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{
            flexShrink: 0, padding: '8px 10px',
            borderTop: `1px solid ${T.border}`,
            background: `${T.card}CC`,
          }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                ref={inputRef}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                }}
                placeholder={tabInputPlaceholder}
                maxLength={280}
                style={{
                  flex: 1, fontFamily: T.display, fontSize: 12,
                  background: T.cardEl, border: `1px solid ${T.border}`,
                  borderRadius: 10, padding: '10px 12px',
                  color: T.text, outline: 'none',
                  transition: 'border-color 0.15s',
                  minHeight: 42,
                }}
                onFocus={e => { (e.target as HTMLInputElement).style.borderColor = 'rgba(129,140,248,0.50)'; }}
                onBlur={e  => { (e.target as HTMLInputElement).style.borderColor = T.border; }}
              />
              <button
                onClick={handleSend}
                disabled={!draft.trim()}
                style={{
                  padding: '10px 14px', borderRadius: 10,
                  cursor: draft.trim() ? 'pointer' : 'not-allowed',
                  fontFamily: T.mono, fontSize: 13, fontWeight: 800,
                  background: draft.trim()
                    ? 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)'
                    : T.cardEl,
                  border: `1px solid ${draft.trim() ? 'rgba(129,140,248,0.40)' : T.border}`,
                  color: draft.trim() ? T.text : T.textMut,
                  opacity: draft.trim() ? 1 : 0.5,
                  transition: 'all 0.15s',
                  minHeight: 42, minWidth: 42,
                }}
              >
                ↑
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

export default ChatPanel;
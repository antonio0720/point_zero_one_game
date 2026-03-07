/**
 * ChatPanel.tsx — PZO Sovereign Chat · v4 · Full Game Chat UI
 * ─────────────────────────────────────────────────────────────────────────────
 * UPGRADED from pzo-web/src/components/chat/ChatPanel.tsx
 *
 * v4 CHANGES:
 *   - Multi-channel tabs (GLOBAL/SYNDICATE/DM/DEAL_ROOM)
 *   - Mute/block/report context menu on messages
 *   - Helper character styling (distinct from bot taunts)
 *   - Player response highlighting
 *   - Adaptive bot reaction indicators
 *   - Privacy controls UI
 *   - Works in Next.js (no Vite imports)
 *
 * FILE LOCATION: frontend/apps/web/components/chat/ChatPanel.tsx
 * Density6 LLC · Point Zero One · Confidential
 */

'use client';

import React, { useRef, useEffect, useState, useCallback, memo } from 'react';
import type { ChatMessage, ChatChannel } from './chatTypes';
import { useChatEngine } from './useChatEngine';
import type { GameEventType } from './GameEventChatBridge';

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
  mono:    'var(--font-dm-mono, "DM Mono", "JetBrains Mono", monospace)',
  display: 'var(--font-barlow, "Barlow Condensed", "Syne", system-ui, sans-serif)',
  body:    'var(--font-dm-sans, "DM Sans", system-ui, sans-serif)',
};

// ─── Kind Config ──────────────────────────────────────────────────────────────

interface KindConfig {
  barColor:  string;
  bg:        string;
  nameColor: string;
}

const KIND_CFG: Record<string, KindConfig> = {
  PLAYER:          { barColor: 'transparent',  bg: 'transparent',             nameColor: T.textSub },
  SYSTEM:          { barColor: T.indigo,       bg: 'rgba(129,140,248,0.05)',  nameColor: T.indigo },
  MARKET_ALERT:    { barColor: T.orange,       bg: 'rgba(255,140,0,0.05)',    nameColor: T.orange },
  ACHIEVEMENT:     { barColor: T.green,        bg: 'rgba(34,221,136,0.05)',   nameColor: T.green },
  BOT_TAUNT:       { barColor: T.red,          bg: 'rgba(255,77,77,0.05)',    nameColor: T.red },
  BOT_ATTACK:      { barColor: '#FF4D4D',      bg: 'rgba(255,77,77,0.08)',    nameColor: '#FF4D4D' },
  SHIELD_EVENT:    { barColor: T.teal,         bg: 'rgba(34,211,238,0.05)',   nameColor: T.teal },
  CASCADE_ALERT:   { barColor: T.purple,       bg: 'rgba(168,85,247,0.05)',   nameColor: T.purple },
  DEAL_RECAP:      { barColor: T.yellow,       bg: 'rgba(255,215,0,0.05)',    nameColor: T.yellow },
  HELPER_TIP:      { barColor: T.green,        bg: 'rgba(34,221,136,0.06)',   nameColor: T.green },
  PLAYER_RESPONSE: { barColor: T.indigo,       bg: 'rgba(129,140,248,0.04)', nameColor: T.indigo },
};

// ─── Channel Tab Config ───────────────────────────────────────────────────────

const CHANNEL_LABELS: Record<ChatChannel, { label: string; emoji: string }> = {
  GLOBAL:    { label: 'GLOBAL',    emoji: '🌐' },
  SYNDICATE: { label: 'SYNDICATE', emoji: '🤝' },
  DM:        { label: 'DM',        emoji: '💬' },
  DEAL_ROOM: { label: 'DEALS',    emoji: '📜' },
  SPECTATOR: { label: 'SPECTATE', emoji: '👁️' },
};

// ─── Message Row ──────────────────────────────────────────────────────────────

const MessageRow = memo(({ msg, onMute, onBlock, onReport }: {
  msg: ChatMessage;
  onMute:   (id: string, name: string) => void;
  onBlock:  (id: string) => void;
  onReport: (msg: ChatMessage) => void;
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const cfg = KIND_CFG[msg.kind] ?? KIND_CFG.PLAYER;
  const isPlayer = msg.senderId === 'player-local';
  const isBot    = msg.kind === 'BOT_TAUNT' || msg.kind === 'BOT_ATTACK';
  const isHelper = msg.kind === 'HELPER_TIP';

  return (
    <div
      style={{
        padding: '7px 12px', position: 'relative',
        borderLeft: `2px solid ${cfg.barColor}`,
        background: cfg.bg,
        animation: 'chatFadeIn 0.3s ease',
      }}
      onContextMenu={(e) => {
        if (!isPlayer) { e.preventDefault(); setShowMenu(true); }
      }}
      onMouseLeave={() => setShowMenu(false)}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        {msg.emoji && <span style={{ fontSize: 14, lineHeight: 1.5, flexShrink: 0 }}>{msg.emoji}</span>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 1 }}>
            <span style={{
              fontSize: 10, fontFamily: T.mono, fontWeight: 700,
              color: isPlayer ? T.indigo : cfg.nameColor,
              textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              {msg.senderName}
            </span>
            {msg.senderRank && (
              <span style={{ fontSize: 9, fontFamily: T.mono, color: T.textMut }}>{msg.senderRank}</span>
            )}
            {msg.wasAdapted && (
              <span style={{ fontSize: 8, fontFamily: T.mono, color: T.purple, letterSpacing: '0.1em' }}>ML</span>
            )}
          </div>
          <div style={{
            fontSize: 12, lineHeight: 1.55,
            color: msg.kind === 'SYSTEM' ? T.textSub : T.text,
            fontFamily: msg.kind === 'SYSTEM' ? T.mono : T.body,
            fontWeight: isBot ? 500 : 400,
            fontStyle: isBot ? 'italic' : 'normal',
            wordBreak: 'break-word',
          }}>
            {msg.body}
          </div>
        </div>
      </div>

      {/* Context menu */}
      {showMenu && !isPlayer && (
        <div style={{
          position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
          background: T.cardEl, border: `1px solid ${T.borderM}`,
          borderRadius: 8, padding: 4, zIndex: 100,
          display: 'flex', gap: 2,
        }}>
          {(isBot || msg.senderId.startsWith('npc_')) && (
            <button type="button" onClick={() => { onMute(msg.senderId, msg.senderName); setShowMenu(false); }}
              style={menuBtnStyle}>🔇</button>
          )}
          {!isBot && !msg.senderId.startsWith('npc_') && msg.senderId !== 'SYSTEM' && (
            <button type="button" onClick={() => { onBlock(msg.senderId); setShowMenu(false); }}
              style={menuBtnStyle}>🚫</button>
          )}
          <button type="button" onClick={() => { onReport(msg); setShowMenu(false); }}
            style={menuBtnStyle}>⚠️</button>
        </div>
      )}
    </div>
  );
});
MessageRow.displayName = 'MessageRow';

const menuBtnStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)', border: 'none',
  borderRadius: 4, padding: '4px 8px', cursor: 'pointer',
  fontSize: 12,
};

// ─── Chat Panel Props ─────────────────────────────────────────────────────────

export interface ChatPanelProps {
  /** Game context for in-run mode. Null for standalone/lobby. */
  gameContext?:  any;
  /** Game mode */
  mode?:        string;
  /** Accent color (hex) */
  accent?:      string;
  accentRgb?:   string;
  /** Whether to start open */
  defaultOpen?: boolean;
  /** Height override */
  height?:      number | string;
  /** Panel position style */
  position?:    'fixed' | 'relative' | 'absolute';
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ChatPanel({
  gameContext = null,
  mode = 'solo',
  accent = '#818CF8',
  accentRgb = '129,140,248',
  defaultOpen = false,
  height = 480,
  position = 'relative',
}: ChatPanelProps) {
  const {
    messages, activeTab, switchTab, chatOpen, toggleChat,
    sendMessage, unread, totalUnread, availableChannels,
    muteSender, blockSender, reportMessage,
  } = useChatEngine({ gameContext, mode, isLobby: !gameContext });

  const [input, setInput] = useState('');
  const scrollRef         = useRef<HTMLDivElement>(null);
  const inputRef          = useRef<HTMLInputElement>(null);

  // Force open on mount if defaultOpen
  useEffect(() => {
    if (defaultOpen && !chatOpen) toggleChat();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleSend = useCallback(() => {
    if (!input.trim()) return;
    sendMessage(input);
    setInput('');
    inputRef.current?.focus();
  }, [input, sendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleMute = useCallback((id: string, name: string) => {
    const type = id.startsWith('BOT_') ? 'BOT' as const : id.startsWith('npc_') ? 'NPC' as const : 'PLAYER' as const;
    muteSender(id, name, type);
  }, [muteSender]);

  const handleReport = useCallback((msg: ChatMessage) => {
    reportMessage(msg, 'INAPPROPRIATE');
  }, [reportMessage]);

  return (
    <>
      <style>{`
        @keyframes chatFadeIn { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div style={{
        position: position as any,
        width: '100%',
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius: 12, overflow: 'hidden',
        background: 'rgba(6,6,15,0.95)',
        border: `1px solid rgba(${accentRgb},0.15)`,
        backdropFilter: 'blur(16px)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header + channel tabs */}
        <div style={{
          padding: '8px 12px',
          borderBottom: `1px solid ${T.border}`,
          background: `rgba(${accentRgb},0.03)`,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 6,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: T.green, boxShadow: `0 0 6px ${T.green}50` }} />
              <span style={{ fontSize: 10, fontFamily: T.mono, fontWeight: 700, letterSpacing: '0.2em', color: accent, textTransform: 'uppercase' }}>
                PZO CHAT
              </span>
            </div>
            <span style={{ fontSize: 9, fontFamily: T.mono, color: T.textMut }}>
              {messages.length} msgs
            </span>
          </div>

          {/* Channel tabs */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {availableChannels.map(ch => {
              const active = activeTab === ch;
              const cfg = CHANNEL_LABELS[ch];
              const count = unread[ch] ?? 0;
              return (
                <button
                  key={ch}
                  type="button"
                  onClick={() => switchTab(ch)}
                  style={{
                    padding: '3px 8px', borderRadius: 4, cursor: 'pointer',
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
                    textTransform: 'uppercase', fontFamily: T.mono,
                    color: active ? accent : T.textMut,
                    background: active ? `rgba(${accentRgb},0.10)` : 'transparent',
                    border: `1px solid ${active ? `rgba(${accentRgb},0.30)` : 'transparent'}`,
                    transition: 'all 0.15s ease',
                    position: 'relative',
                  }}
                >
                  {cfg?.emoji} {cfg?.label ?? ch}
                  {count > 0 && (
                    <span style={{
                      position: 'absolute', top: -4, right: -4,
                      width: 14, height: 14, borderRadius: '50%',
                      background: T.red, color: '#fff',
                      fontSize: 8, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {count > 9 ? '9+' : count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          style={{
            flex: 1, overflowY: 'auto', overflowX: 'hidden',
            padding: '4px 0',
          }}
        >
          {messages.length === 0 ? (
            <div style={{
              padding: 24, textAlign: 'center',
              color: T.textMut, fontSize: 11, fontFamily: T.mono,
              letterSpacing: '0.06em',
            }}>
              {activeTab === 'GLOBAL' ? 'The game is listening...' : `No messages in ${activeTab}`}
            </div>
          ) : (
            messages.map(msg => (
              <MessageRow
                key={msg.id}
                msg={msg}
                onMute={handleMute}
                onBlock={blockSender}
                onReport={handleReport}
              />
            ))
          )}
        </div>

        {/* Input */}
        <div style={{
          padding: '8px 10px', borderTop: `1px solid ${T.border}`,
          display: 'flex', gap: 6,
        }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={activeTab === 'DM' ? 'Private message...' : 'Talk back to the game...'}
            style={{
              flex: 1, padding: '8px 12px', borderRadius: 8,
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${T.border}`,
              color: T.text, fontSize: 12, fontFamily: T.body,
              outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim()}
            style={{
              padding: '8px 14px', borderRadius: 8,
              background: input.trim() ? accent : 'rgba(255,255,255,0.05)',
              border: 'none', color: input.trim() ? '#000' : T.textMut,
              fontSize: 10, fontWeight: 700, fontFamily: T.mono,
              cursor: input.trim() ? 'pointer' : 'default',
              letterSpacing: '0.1em', textTransform: 'uppercase',
              transition: 'all 0.15s ease',
            }}
          >
            SEND
          </button>
        </div>
      </div>
    </>
  );
}

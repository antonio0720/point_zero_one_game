/**
 * LobbyChatWidget.tsx — PZO Sovereign Chat · Lobby Component
 * ─────────────────────────────────────────────────────────────────────────────
 * Displays chat in the lobby (play page) BEFORE a run starts.
 * Bots are already sizing up the player. NPCs are chatting.
 * The game feels alive from the moment they log in.
 *
 * Usage in play/page.tsx:
 *   import LobbyChatWidget from '../../../components/chat/LobbyChatWidget';
 *   <LobbyChatWidget selectedMode={selected} accent={mode.accent} accentRgb={mode.accentRgb} />
 *
 * FILE LOCATION: frontend/apps/web/components/chat/LobbyChatWidget.tsx
 * Density6 LLC · Point Zero One · Confidential
 */

'use client';

import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import type { ChatMessage, ChatChannel } from './chatTypes';
import { useChatEngine } from './useChatEngine';

// ─── Design Tokens (match play/page.tsx zinc/indigo system) ──────────────────

const T = {
  card:     '#0C0C1E',
  cardHi:   '#131328',
  border:   'rgba(255,255,255,0.08)',
  borderM:  'rgba(255,255,255,0.16)',
  text:     '#F2F2FF',
  textSub:  '#9090B4',
  textMut:  '#505074',
  green:    '#22DD88',
  red:      '#FF4D4D',
  orange:   '#FF8C00',
  yellow:   '#FFD700',
  indigo:   '#818CF8',
  teal:     '#22D3EE',
  purple:   '#A855F7',
  mono:     'var(--font-dm-mono, "DM Mono", monospace)',
  display:  'var(--font-barlow, "Barlow Condensed", Impact, system-ui, sans-serif)',
  body:     'var(--font-dm-sans, "DM Sans", system-ui, sans-serif)',
};

// ─── Kind colors ──────────────────────────────────────────────────────────────

function kindColor(kind: ChatMessage['kind']): string {
  switch (kind) {
    case 'BOT_TAUNT':     return T.red;
    case 'BOT_ATTACK':    return T.red;
    case 'SYSTEM':        return T.indigo;
    case 'MARKET_ALERT':  return T.orange;
    case 'ACHIEVEMENT':   return T.green;
    case 'SHIELD_EVENT':  return T.teal;
    case 'CASCADE_ALERT': return T.purple;
    case 'HELPER_TIP':    return T.green;
    default:              return 'transparent';
  }
}

// ─── Message Row ──────────────────────────────────────────────────────────────

const MessageRow = memo(({ msg }: { msg: ChatMessage }) => {
  const barColor = kindColor(msg.kind);
  const isPlayer = msg.kind === 'PLAYER' && msg.senderId === 'player-local';
  const isSystem = msg.kind === 'SYSTEM' || msg.kind === 'MARKET_ALERT';
  const isBot    = msg.kind === 'BOT_TAUNT' || msg.kind === 'BOT_ATTACK';
  const isHelper = msg.kind === 'HELPER_TIP';

  return (
    <div style={{
      padding: '6px 10px', display: 'flex', gap: 8, alignItems: 'flex-start',
      borderLeft: `2px solid ${barColor}`,
      background: isBot ? 'rgba(255,77,77,0.04)' : isHelper ? 'rgba(34,221,136,0.04)' : 'transparent',
      animation: 'fadeIn 0.3s ease',
    }}>
      {msg.emoji && <span style={{ fontSize: 14, lineHeight: 1.4, flexShrink: 0 }}>{msg.emoji}</span>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 1 }}>
          <span style={{
            fontSize: 10, fontFamily: T.mono, fontWeight: 700,
            color: isPlayer ? T.indigo : isBot ? T.red : isHelper ? T.green : isSystem ? T.indigo : T.textSub,
            textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>
            {msg.senderName}
          </span>
          {msg.senderRank && (
            <span style={{ fontSize: 9, fontFamily: T.mono, color: T.textMut }}>
              {msg.senderRank}
            </span>
          )}
        </div>
        <div style={{
          fontSize: 12, lineHeight: 1.55, color: isSystem ? T.textSub : T.text,
          fontFamily: isSystem ? T.mono : T.body, fontWeight: isBot ? 500 : 400,
          fontStyle: isBot ? 'italic' : 'normal',
          wordBreak: 'break-word',
        }}>
          {msg.body}
        </div>
      </div>
    </div>
  );
});
MessageRow.displayName = 'MessageRow';

// ─── Component ────────────────────────────────────────────────────────────────

interface LobbyChatWidgetProps {
  selectedMode?: string;
  accent?:       string;
  accentRgb?:    string;
}

export default function LobbyChatWidget({
  selectedMode = 'solo',
  accent = '#818CF8',
  accentRgb = '129,140,248',
}: LobbyChatWidgetProps) {
  const {
    messages, sendMessage, chatOpen, toggleChat, totalUnread,
  } = useChatEngine({ isLobby: true, mode: selectedMode });

  const [input, setInput]   = useState('');
  const scrollRef           = useRef<HTMLDivElement>(null);
  const inputRef            = useRef<HTMLInputElement>(null);

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

  // ── Collapsed state ─────────────────────────────────────────────────────

  if (!chatOpen) {
    return (
      <button
        type="button"
        onClick={toggleChat}
        style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 1000,
          width: 56, height: 56, borderRadius: '50%',
          background: `rgba(${accentRgb},0.15)`,
          border: `1px solid rgba(${accentRgb},0.35)`,
          color: accent, fontSize: 22, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 4px 24px rgba(0,0,0,0.4), 0 0 40px rgba(${accentRgb},0.15)`,
          transition: 'all 0.2s ease',
        }}
      >
        💬
        {totalUnread > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            width: 20, height: 20, borderRadius: '50%',
            background: T.red, color: '#fff',
            fontSize: 10, fontWeight: 700, fontFamily: T.mono,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {totalUnread > 9 ? '9+' : totalUnread}
          </span>
        )}
      </button>
    );
  }

  // ── Expanded state ──────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div style={{
        position: 'fixed', bottom: 20, right: 20, zIndex: 1000,
        width: 'min(380px, calc(100vw - 40px))', height: 440,
        borderRadius: 16, overflow: 'hidden',
        background: 'rgba(6,6,15,0.96)',
        border: `1px solid rgba(${accentRgb},0.20)`,
        boxShadow: `0 8px 48px rgba(0,0,0,0.6), 0 0 60px rgba(${accentRgb},0.08)`,
        backdropFilter: 'blur(20px)',
        display: 'flex', flexDirection: 'column',
        animation: 'slideUp 0.3s ease',
      }}>
        {/* Header */}
        <div style={{
          padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: `1px solid ${T.border}`,
          background: `rgba(${accentRgb},0.04)`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', background: T.green,
              boxShadow: `0 0 8px ${T.green}50`,
            }} />
            <span style={{
              fontSize: 11, fontFamily: T.mono, fontWeight: 700,
              letterSpacing: '0.2em', textTransform: 'uppercase', color: accent,
            }}>
              PZO GLOBAL
            </span>
          </div>
          <button
            type="button"
            onClick={toggleChat}
            style={{
              background: 'none', border: 'none', color: T.textMut,
              cursor: 'pointer', fontSize: 16, padding: '2px 6px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          style={{
            flex: 1, overflowY: 'auto', overflowX: 'hidden',
            padding: '6px 0',
          }}
        >
          {messages.length === 0 ? (
            <div style={{
              padding: 20, textAlign: 'center',
              color: T.textMut, fontSize: 11, fontFamily: T.mono,
            }}>
              The game is listening...
            </div>
          ) : (
            messages.map(msg => <MessageRow key={msg.id} msg={msg} />)
          )}
        </div>

        {/* Input */}
        <div style={{
          padding: '8px 10px', borderTop: `1px solid ${T.border}`,
          display: 'flex', gap: 8,
        }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Talk back..."
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
              fontSize: 11, fontWeight: 700, fontFamily: T.mono,
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

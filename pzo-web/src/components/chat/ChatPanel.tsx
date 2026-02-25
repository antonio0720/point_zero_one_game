/**
 * ChatPanel.tsx — PZO Sovereign Chat
 * ─────────────────────────────────────────────────────────────────────────────
 * Fixed bottom-right collapsible chat panel.
 * Mobile Strike / Rise of Kingdoms retention pattern:
 *   - Always visible during run (bottom-right corner)
 *   - Unread badge pulses to pull attention
 *   - NPC activity makes it feel alive at all times
 *   - 3 tabs: GLOBAL | SYNDICATE | DEAL ROOM
 *   - Message types: player, system, market alert, achievement, rival taunt
 *   - Game events auto-broadcast as system cards
 *   - Fast/snappy — no lag, no flicker
 *
 * Wires into App.tsx run screen as a fixed overlay.
 * Props: pass game state from App.tsx. Zero new App state needed except chatOpen.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { ChatChannel, ChatMessage, GameChatContext } from './chatTypes';
import { useChatEngine } from './useChatEngine';
import type { SabotageEvent } from './useChatEngine';

// ─── Message renderer ─────────────────────────────────────────────────────────

const RANK_COLOR: Record<string, string> = {
  'Managing Partner': 'text-yellow-400',
  'Senior Partner':   'text-amber-400',
  'Partner':          'text-indigo-400',
  'Junior Partner':   'text-zinc-400',
  'Associate':        'text-zinc-500',
  'You':              'text-emerald-400',
};

const KIND_STYLE: Record<string, { bar: string; bg: string; nameColor: string }> = {
  PLAYER:       { bar: 'bg-transparent',  bg: '',                                  nameColor: 'text-zinc-300' },
  SYSTEM:       { bar: 'bg-indigo-500',   bg: 'bg-indigo-950/40 border border-indigo-800/30', nameColor: 'text-indigo-300' },
  MARKET_ALERT: { bar: 'bg-amber-500',    bg: 'bg-amber-950/40 border border-amber-700/30',   nameColor: 'text-amber-300' },
  ACHIEVEMENT:  { bar: 'bg-emerald-500',  bg: 'bg-emerald-950/40 border border-emerald-800/30', nameColor: 'text-emerald-300' },
  RIVAL_TAUNT:  { bar: 'bg-red-500',      bg: 'bg-red-950/40 border border-red-800/30',        nameColor: 'text-red-300' },
  DEAL_RECAP:   { bar: 'bg-yellow-500',   bg: 'bg-yellow-950/40 border border-yellow-700/30',  nameColor: 'text-yellow-300' },
};

function MessageRow({ msg }: { msg: ChatMessage }) {
  const style  = KIND_STYLE[msg.kind] ?? KIND_STYLE.PLAYER;
  const isSystem = msg.kind !== 'PLAYER';
  const rankColor = msg.senderRank ? (RANK_COLOR[msg.senderRank] ?? 'text-zinc-400') : '';
  const isMe   = msg.senderId === 'player-local';

  const timeStr = new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isSystem) {
    return (
      <div className={`flex gap-1.5 my-1 mx-1 rounded-lg px-2.5 py-2 ${style.bg}`}>
        {msg.emoji && <span className="text-sm flex-shrink-0 mt-0.5">{msg.emoji}</span>}
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-semibold ${style.nameColor} leading-relaxed`}>{msg.body}</p>
          {msg.proofHash && (
            <p className="text-[10px] font-mono text-yellow-500 mt-1 truncate">HASH: {msg.proofHash}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-2 px-2 py-1 ${isMe ? 'flex-row-reverse' : ''} group`}>
      {/* Avatar */}
      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-400 mt-0.5">
        {msg.senderName.charAt(0).toUpperCase()}
      </div>
      <div className={`max-w-[78%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
        <div className={`flex items-center gap-1.5 mb-0.5 ${isMe ? 'flex-row-reverse' : ''}`}>
          <span className={`text-[10px] font-bold ${isMe ? 'text-emerald-400' : 'text-zinc-300'} truncate max-w-[120px]`}>
            {msg.senderName}
          </span>
          {msg.senderRank && (
            <span className={`text-[9px] ${rankColor} font-medium`}>
              {msg.senderRank}
            </span>
          )}
          <span className="text-[9px] text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity">{timeStr}</span>
        </div>
        <div className={`text-xs leading-relaxed px-2.5 py-1.5 rounded-xl ${
          isMe
            ? 'bg-indigo-600/80 text-white rounded-tr-sm'
            : 'bg-zinc-800/80 text-zinc-200 rounded-tl-sm'
        }`}>
          {msg.body}
        </div>
        {msg.immutable && (
          <span className="text-[9px] text-zinc-600 mt-0.5">🔒 locked</span>
        )}
      </div>
    </div>
  );
}

// ─── Tab button ───────────────────────────────────────────────────────────────

function Tab({
  label, icon, isActive, unread, onClick,
}: {
  label: string; icon: string; isActive: boolean; unread: number; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold tracking-wider transition-all ${
        isActive
          ? 'text-white border-b-2 border-indigo-400'
          : 'text-zinc-500 hover:text-zinc-300 border-b-2 border-transparent'
      }`}
    >
      <span>{icon}</span>
      <span>{label}</span>
      {unread > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center px-0.5 animate-pulse">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  );
}

// ─── ChatPanel ────────────────────────────────────────────────────────────────

interface ChatPanelProps {
  gameCtx:      GameChatContext;
  /** Wire App.tsx handleSabotage here — engine fires it on hater:sabotage events */
  onSabotage?:  (event: SabotageEvent) => void;
  /** Optional access token for live socket.io connection */
  accessToken?: string | null;
}

export function ChatPanel({ gameCtx, onSabotage, accessToken }: ChatPanelProps) {
  const {
    messages, activeTab, switchTab,
    chatOpen, toggleChat, sendMessage,
    unread, totalUnread,
  } = useChatEngine(gameCtx, accessToken, onSabotage);

  const [draft, setDraft]       = useState('');
  const [flashNew, setFlashNew] = useState(false);
  const bottomRef               = useRef<HTMLDivElement>(null);
  const prevMsgLen              = useRef(0);
  const inputRef                = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatOpen) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, chatOpen]);

  // Flash pulse on collapsed bubble when new messages arrive
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

  const visibleMessages = messages.filter((m) => m.channel === activeTab);

  return (
    <>
      {/* ── Collapsed bubble ───────────────────────────────────────────── */}
      {!chatOpen && (
        <button
          onClick={toggleChat}
          className={`
            fixed bottom-6 right-4 z-50
            w-12 h-12 rounded-full
            bg-zinc-900 border border-zinc-700
            flex items-center justify-center
            shadow-xl shadow-black/60
            transition-all duration-200
            hover:scale-110 hover:border-indigo-500
            active:scale-95
            ${flashNew ? 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-zinc-950 animate-pulse' : ''}
          `}
          title="Open Chat"
        >
          <span className="text-xl">💬</span>
          {totalUnread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center px-1 shadow-lg">
              {totalUnread > 99 ? '99' : totalUnread}
            </span>
          )}
        </button>
      )}

      {/* ── Expanded chat panel ────────────────────────────────────────── */}
      {chatOpen && (
        <div className="
          fixed bottom-0 right-0 z-50
          w-80 h-[480px]
          flex flex-col
          bg-zinc-950/98 backdrop-blur-sm
          border border-zinc-800
          border-b-0 border-r-0
          rounded-tl-2xl
          shadow-2xl shadow-black/80
          overflow-hidden
        ">
          {/* Header */}
          <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900/80 border-b border-zinc-800 flex-shrink-0">
            <span className="text-sm">💬</span>
            <span className="text-xs font-bold text-white tracking-wide flex-1">PZO CHAT</span>
            {/* Online pulse */}
            <span className="flex items-center gap-1 text-[10px] text-zinc-500">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block"></span>
              {12 + Math.floor(Math.random() * 8)} online
            </span>
            <button
              onClick={toggleChat}
              className="text-zinc-500 hover:text-white transition-colors text-base leading-none ml-1"
            >
              ╲╱
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-zinc-800 bg-zinc-900/50 px-1 flex-shrink-0">
            <Tab label="GLOBAL"    icon="🌐" isActive={activeTab === 'GLOBAL'}    unread={unread.GLOBAL}    onClick={() => switchTab('GLOBAL')}    />
            <Tab label="SYNDICATE" icon="🏛️" isActive={activeTab === 'SYNDICATE'} unread={unread.SYNDICATE} onClick={() => switchTab('SYNDICATE')} />
            <Tab label="DEAL ROOM" icon="⚡" isActive={activeTab === 'DEAL_ROOM'} unread={unread.DEAL_ROOM} onClick={() => switchTab('DEAL_ROOM')} />
          </div>

          {/* Deal Room transcript integrity notice */}
          {activeTab === 'DEAL_ROOM' && (
            <div className="flex-shrink-0 px-3 py-1 bg-yellow-950/30 border-b border-yellow-800/20">
              <p className="text-[9px] text-yellow-600 font-semibold tracking-wide">
                🔒 TRANSCRIPT INTEGRITY ENFORCED — Logs are the official rivalry record
              </p>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto py-1 scroll-smooth" style={{ scrollbarWidth: 'thin', scrollbarColor: '#27272a transparent' }}>
            {visibleMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-zinc-600">
                <span className="text-2xl">{activeTab === 'DEAL_ROOM' ? '⚡' : activeTab === 'SYNDICATE' ? '🏛️' : '🌐'}</span>
                <p className="text-xs">No messages yet.</p>
              </div>
            )}
            {visibleMessages.map((msg) => (
              <MessageRow key={msg.id} msg={msg} />
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex-shrink-0 px-2 py-2 border-t border-zinc-800 bg-zinc-900/50">
            <div className="flex gap-1.5">
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder={
                  activeTab === 'DEAL_ROOM'
                    ? 'Deal Room — transcript recorded...'
                    : activeTab === 'SYNDICATE'
                      ? 'Message your syndicate...'
                      : 'Message global...'
                }
                maxLength={280}
                className="
                  flex-1 text-xs bg-zinc-800/60 border border-zinc-700 rounded-lg
                  px-3 py-2 text-zinc-100 placeholder-zinc-600
                  outline-none focus:border-indigo-500 transition-colors
                "
              />
              <button
                onClick={handleSend}
                disabled={!draft.trim()}
                className="
                  px-3 py-2 rounded-lg text-xs font-bold
                  bg-indigo-600 text-white
                  hover:bg-indigo-500 active:bg-indigo-700
                  disabled:opacity-30 disabled:cursor-not-allowed
                  transition-all
                "
              >
                ↑
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default ChatPanel;
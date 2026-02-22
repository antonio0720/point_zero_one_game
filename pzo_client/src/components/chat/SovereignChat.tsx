/**
 * ============================================================================
 * FILE: pzo_client/src/components/chat/SovereignChat.tsx
 * Point Zero One — Sovereign Chat UI
 * 
 * Game of War / Mobile Strike-inspired compact chat panel
 * Channels: GLOBAL | SERVER | ALLIANCE | OFFICER | ROOM | DM
 * Features: Channel tabs, Rank badges, Stickers, Block, Unsend (15s),
 *           War Alerts, System messages, Unread counts, Presence dots
 * ============================================================================
 */

import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from 'react';

// ─── TYPES ────────────────────────────────────────────────────────────────────

type ChannelType = 'GLOBAL' | 'SERVER' | 'ALLIANCE' | 'OFFICER' | 'ROOM' | 'DM';
type MessageType = 'TEXT' | 'STICKER' | 'SYSTEM' | 'WAR_ALERT' | 'DEAL_INVITE' | 'PROOF_SHARE';
type MessageStatus = 'SENT' | 'DELIVERED' | 'READ' | 'UNSENT' | 'DELETED_BY_MOD';

interface Message {
  id:          string;
  channelId:   string;
  senderId:    string;
  senderName:  string;
  senderRank:  string | null;
  senderTitle: string | null;
  type:        MessageType;
  body:        string;
  status:      MessageStatus;
  sentAt:      Date;
  replyToId:   string | null;
  isMine:      boolean;
}

interface Channel {
  id:          string;
  type:        ChannelType;
  label:       string;
  unread:      number;
  isLocked:    boolean;
  minRank?:    number;   // 3 for OFFICER
}

interface SovereignChatProps {
  playerId:    string;
  playerRank:  string | null;   // "R1"–"R5"
  playerTitle: string | null;
  allianceId:  string | null;
  serverId:    string;
  // Callbacks wired to ChatService
  onSend:      (channelId: string, body: string, type?: MessageType) => Promise<Message | { error: string }>;
  onUnsend:    (messageId: string) => Promise<{ success: boolean; reason?: string }>;
  onBlock:     (targetId: string) => Promise<void>;
  onLoadHistory: (channelId: string, before?: Date) => Promise<Message[]>;
  onOpenDM:    (targetId: string, targetName: string) => void;
}

// ─── STICKERS ─────────────────────────────────────────────────────────────────

const STICKERS: Array<{ id: string; emoji: string; label: string }> = [
  { id: 'pzo_fist',       emoji: '✊',  label: 'Fist' },
  { id: 'pzo_fire',       emoji: '🔥',  label: 'Fire' },
  { id: 'pzo_money_bag',  emoji: '💰',  label: 'Bag' },
  { id: 'pzo_crown',      emoji: '👑',  label: 'Crown' },
  { id: 'pzo_skull',      emoji: '💀',  label: 'Skull' },
  { id: 'pzo_swords',     emoji: '⚔️', label: 'War' },
  { id: 'pzo_handshake',  emoji: '🤝',  label: 'Deal' },
  { id: 'pzo_chart_up',   emoji: '📈',  label: 'Up' },
  { id: 'pzo_fubar',      emoji: '💥',  label: 'FUBAR' },
  { id: 'pzo_missed',     emoji: '😬',  label: 'Missed' },
  { id: 'pzo_privileged', emoji: '🎩',  label: 'Priv' },
  { id: 'pzo_receipt',    emoji: '🧾',  label: 'Receipt' },
];

// ─── RANK BADGE ───────────────────────────────────────────────────────────────

const RANK_COLORS: Record<string, string> = {
  R5: '#FFD700', R4: '#C0C0C0', R3: '#CD7F32', R2: '#4FC3F7', R1: '#78909C',
};

function RankBadge({ rank }: { rank: string }) {
  return (
    <span style={{
      display: 'inline-block',
      fontSize: '9px',
      fontWeight: 700,
      padding: '1px 4px',
      borderRadius: '3px',
      background: RANK_COLORS[rank] ?? '#666',
      color: rank === 'R5' ? '#000' : '#fff',
      marginRight: 4,
      letterSpacing: '0.5px',
    }}>
      {rank}
    </span>
  );
}

// ─── TITLE BADGE ──────────────────────────────────────────────────────────────

const TITLE_DISPLAY: Record<string, string> = {
  THE_SOVEREIGN: '⚡ Sovereign',
  THE_ARCHITECT: '🏗 Architect',
  FUBAR_PROOF:   '🛡 FUBAR-Proof',
  THE_CLOSER:    '🤝 Closer',
  VAULT_LORD:    '🏦 Vault Lord',
  WAR_GENERAL:   '⚔️ General',
};

function TitleBadge({ title }: { title: string }) {
  const label = TITLE_DISPLAY[title] ?? title;
  return (
    <span style={{
      fontSize: '9px', color: '#FFD700', marginRight: 4, fontStyle: 'italic',
    }}>
      {label}
    </span>
  );
}

// ─── MESSAGE BUBBLE ───────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  onUnsend,
  onBlock,
  onReply,
  onOpenDM,
  playerId,
}: {
  msg:       Message;
  onUnsend:  (id: string) => void;
  onBlock:   (id: string, name: string) => void;
  onReply:   (id: string, name: string) => void;
  onOpenDM:  (id: string, name: string) => void;
  playerId:  string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [canUnsend, setCanUnsend] = useState(msg.isMine && msg.status !== 'UNSENT');
  const menuRef = useRef<HTMLDivElement>(null);

  // Disable unsend after 15s
  useEffect(() => {
    if (!msg.isMine || msg.status === 'UNSENT') return;
    const age  = Date.now() - new Date(msg.sentAt).getTime();
    const left = 15000 - age;
    if (left <= 0) { setCanUnsend(false); return; }
    const t = setTimeout(() => setCanUnsend(false), left);
    return () => clearTimeout(t);
  }, [msg]);

  // Close context menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const isSystem    = msg.type === 'SYSTEM' || msg.type === 'WAR_ALERT';
  const isUnsent    = msg.status === 'UNSENT' || msg.status === 'DELETED_BY_MOD';
  const isWarAlert  = msg.type === 'WAR_ALERT';

  if (isSystem) {
    return (
      <div style={{
        textAlign: 'center',
        fontSize: '10px',
        color: isWarAlert ? '#FF4444' : '#888',
        padding: '2px 0',
        fontStyle: isWarAlert ? 'normal' : 'italic',
        fontWeight: isWarAlert ? 700 : 400,
      }}>
        {isWarAlert && '⚔️ '}
        {msg.body}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 2, position: 'relative' }}
         onContextMenu={e => { e.preventDefault(); setMenuOpen(true); }}>
      {/* Sender line */}
      <div style={{ fontSize: '10px', marginBottom: 1, lineHeight: '14px' }}>
        {msg.senderRank && <RankBadge rank={msg.senderRank} />}
        {msg.senderTitle && <TitleBadge title={msg.senderTitle} />}
        <span style={{
          color: msg.isMine ? '#FFD700' : '#90CAF9',
          fontWeight: 600,
          cursor: msg.isMine ? 'default' : 'pointer',
        }}
          onClick={() => !msg.isMine && setMenuOpen(true)}
        >
          {msg.senderName}
        </span>
        <span style={{ color: '#555', marginLeft: 4, fontSize: '9px' }}>
          {new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* Body */}
      <div style={{
        fontSize: '11px',
        color: isUnsent ? '#555' : '#E0E0E0',
        fontStyle: isUnsent ? 'italic' : 'normal',
        wordBreak: 'break-word',
        paddingLeft: 2,
      }}>
        {isUnsent
          ? (msg.status === 'DELETED_BY_MOD' ? '[message removed]' : '[message unsent]')
          : msg.type === 'STICKER'
            ? <span style={{ fontSize: 20 }}>
                {STICKERS.find(s => s.id === msg.body)?.emoji ?? '?'}
              </span>
            : msg.body
        }
      </div>

      {/* Context Menu */}
      {menuOpen && (
        <div ref={menuRef} style={{
          position: 'absolute', top: 0, left: msg.isMine ? 'auto' : '0', right: msg.isMine ? 0 : 'auto',
          background: '#1E1E2E',
          border: '1px solid #333',
          borderRadius: 6,
          padding: '4px 0',
          zIndex: 100,
          minWidth: 130,
          boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
        }}>
          {[
            { label: '↩ Reply', action: () => { onReply(msg.id, msg.senderName); setMenuOpen(false); } },
            !msg.isMine && { label: '✉️ DM', action: () => { onOpenDM(msg.senderId, msg.senderName); setMenuOpen(false); } },
            canUnsend && { label: '↩ Unsend', action: () => { onUnsend(msg.id); setMenuOpen(false); }, color: '#FFA726' },
            !msg.isMine && { label: '🚫 Block', action: () => { onBlock(msg.senderId, msg.senderName); setMenuOpen(false); }, color: '#EF5350' },
          ].filter(Boolean).map((item: unknown) => {
            const it = item as { label: string; action: () => void; color?: string };
            return (
              <div key={it.label}
                style={{
                  padding: '5px 12px',
                  fontSize: '11px',
                  color: it.color ?? '#E0E0E0',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#2A2A3E')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                onClick={it.action}
              >
                {it.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── CHANNEL TAB ──────────────────────────────────────────────────────────────

function ChannelTab({
  channel, active, onClick,
}: { channel: Channel; active: boolean; onClick: () => void }) {
  const TAB_COLORS: Record<ChannelType, string> = {
    GLOBAL:   '#4FC3F7', SERVER:   '#81C784',
    ALLIANCE: '#FFD700', OFFICER: '#FF8A65',
    ROOM:     '#CE93D8', DM:      '#F48FB1',
  };
  return (
    <button
      onClick={onClick}
      style={{
        background:   active ? TAB_COLORS[channel.type] + '22' : 'transparent',
        border:       'none',
        borderBottom: active ? `2px solid ${TAB_COLORS[channel.type]}` : '2px solid transparent',
        color:        active ? TAB_COLORS[channel.type] : '#666',
        padding:      '4px 8px',
        fontSize:     '10px',
        fontWeight:   active ? 700 : 400,
        cursor:       'pointer',
        position:     'relative',
        whiteSpace:   'nowrap',
        transition:   'all 0.15s',
      }}
    >
      {channel.label}
      {channel.unread > 0 && (
        <span style={{
          position: 'absolute', top: 1, right: 1,
          background: '#EF5350',
          color: '#fff',
          fontSize: '8px',
          fontWeight: 700,
          borderRadius: '50%',
          width: 14, height: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          lineHeight: 1,
        }}>
          {channel.unread > 9 ? '9+' : channel.unread}
        </span>
      )}
    </button>
  );
}

// ─── STICKER PICKER ───────────────────────────────────────────────────────────

function StickerPicker({ onSelect, onClose }: { onSelect: (id: string) => void; onClose: () => void }) {
  return (
    <div style={{
      position: 'absolute',
      bottom: '100%',
      right: 0,
      background: '#1E1E2E',
      border: '1px solid #333',
      borderRadius: 8,
      padding: 8,
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 4,
      zIndex: 50,
      boxShadow: '0 4px 16px rgba(0,0,0,0.7)',
    }}>
      {STICKERS.map(s => (
        <button key={s.id}
          title={s.label}
          onClick={() => { onSelect(s.id); onClose(); }}
          style={{
            background: 'transparent', border: 'none',
            fontSize: 20, cursor: 'pointer',
            borderRadius: 4, padding: '2px 4px',
            transition: 'background 0.1s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#2A2A3E')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          {s.emoji}
        </button>
      ))}
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function SovereignChat({
  playerId,
  playerRank,
  playerTitle,
  allianceId,
  serverId,
  onSend,
  onUnsend,
  onBlock,
  onLoadHistory,
  onOpenDM,
}: SovereignChatProps) {

  const rankNum = playerRank ? parseInt(playerRank.replace('R', '')) : 0;

  const channels = useMemo<Channel[]>(() => [
    { id: 'global',              type: 'GLOBAL',   label: 'GLOBAL',   unread: 0, isLocked: false },
    { id: `server_${serverId}`,  type: 'SERVER',   label: 'SERVER',   unread: 0, isLocked: false },
    ...(allianceId ? [
      { id: `alliance_${allianceId}`, type: 'ALLIANCE' as ChannelType, label: 'ALLIANCE', unread: 0, isLocked: false },
      ...(rankNum >= 3 ? [{ id: `officer_${allianceId}`, type: 'OFFICER' as ChannelType, label: 'OFFICER', unread: 0, isLocked: false, minRank: 3 }] : []),
    ] : []),
  ], [allianceId, serverId, rankNum]);

  const [activeChannelId, setActiveChannelId] = useState(channels[0].id);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [showStickers, setShowStickers] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [sending, setSending] = useState(false);

  const listRef    = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLTextAreaElement>(null);

  const activeChannel = channels.find(c => c.id === activeChannelId) ?? channels[0];
  const activeMsgs    = messages[activeChannelId] ?? [];

  // Load history when channel changes
  useEffect(() => {
    if (messages[activeChannelId]) return;
    onLoadHistory(activeChannelId).then(msgs => {
      setMessages(prev => ({
        ...prev,
        [activeChannelId]: [...msgs].reverse(),
      }));
    });
    // Mark channel as read
    setUnreadCounts(prev => ({ ...prev, [activeChannelId]: 0 }));
  }, [activeChannelId]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [activeMsgs.length, isMinimized]);

  const handleSend = useCallback(async (body: string, type: MessageType = 'TEXT') => {
    if (!body.trim() && type === 'TEXT') return;
    if (sending) return;
    setSending(true);
    setDraft('');
    setReplyTo(null);

    const result = await onSend(activeChannelId, body, type);
    setSending(false);

    if ('error' in result) {
      // Show inline error briefly
      console.warn('Chat send error:', result.error);
      return;
    }

    setMessages(prev => ({
      ...prev,
      [activeChannelId]: [...(prev[activeChannelId] ?? []), result],
    }));
  }, [activeChannelId, onSend, sending]);

  const handleUnsend = useCallback(async (messageId: string) => {
    const result = await onUnsend(messageId);
    if (!result.success) return;
    setMessages(prev => ({
      ...prev,
      [activeChannelId]: (prev[activeChannelId] ?? []).map(m =>
        m.id === messageId ? { ...m, status: 'UNSENT' } : m
      ),
    }));
  }, [activeChannelId, onUnsend]);

  const handleBlock = useCallback(async (targetId: string, _targetName: string) => {
    await onBlock(targetId);
    // Hide all messages from that user in current channel
    setMessages(prev => ({
      ...prev,
      [activeChannelId]: (prev[activeChannelId] ?? []).filter(m => m.senderId !== targetId),
    }));
  }, [activeChannelId, onBlock]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(draft);
    }
  }, [draft, handleSend]);

  if (isMinimized) {
    const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);
    return (
      <button
        onClick={() => setIsMinimized(false)}
        style={{
          position: 'fixed', bottom: 16, left: 16,
          background: '#1A1A2E',
          border: '1px solid #333',
          borderRadius: 20,
          padding: '6px 14px',
          color: '#E0E0E0',
          fontSize: '12px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          zIndex: 1000,
        }}
      >
        💬 Chat
        {totalUnread > 0 && (
          <span style={{ background: '#EF5350', color: '#fff', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
      </button>
    );
  }

  return (
    <div style={{
      position:     'fixed',
      bottom:       16,
      left:         16,
      width:        280,
      height:       340,
      background:   'rgba(10, 10, 20, 0.95)',
      border:       '1px solid #2A2A3E',
      borderRadius: 10,
      display:      'flex',
      flexDirection: 'column',
      overflow:     'hidden',
      zIndex:       1000,
      boxShadow:    '0 8px 32px rgba(0,0,0,0.7)',
      fontFamily:   '"Inter", "Segoe UI", sans-serif',
      backdropFilter: 'blur(12px)',
    }}>

      {/* ── Header ── */}
      <div style={{
        display:    'flex',
        alignItems: 'center',
        padding:    '4px 6px',
        background: 'rgba(26, 26, 46, 0.8)',
        borderBottom: '1px solid #1E1E2E',
        gap: 2,
        flexShrink: 0,
      }}>
        {/* Channel tabs */}
        <div style={{ display: 'flex', flex: 1, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {channels.map(ch => (
            <ChannelTab key={ch.id} channel={{ ...ch, unread: unreadCounts[ch.id] ?? 0 }}
              active={activeChannelId === ch.id}
              onClick={() => setActiveChannelId(ch.id)}
            />
          ))}
        </div>
        {/* Minimize */}
        <button onClick={() => setIsMinimized(true)} style={{
          background: 'transparent', border: 'none',
          color: '#555', cursor: 'pointer', fontSize: 14, padding: '0 4px', flexShrink: 0,
        }}>—</button>
      </div>

      {/* ── Message List ── */}
      <div ref={listRef} style={{
        flex:     1,
        overflowY: 'auto',
        padding:  '6px 8px',
        display:  'flex',
        flexDirection: 'column',
        gap:      1,
        scrollbarWidth: 'thin',
        scrollbarColor: '#333 transparent',
      }}>
        {activeMsgs.length === 0 && (
          <div style={{ color: '#444', fontSize: '11px', textAlign: 'center', marginTop: 20 }}>
            No messages yet.
          </div>
        )}
        {activeMsgs.map(msg => (
          <MessageBubble key={msg.id} msg={msg}
            onUnsend={handleUnsend}
            onBlock={handleBlock}
            onReply={(id, name) => setReplyTo({ id, name })}
            onOpenDM={onOpenDM}
            playerId={playerId}
          />
        ))}
      </div>

      {/* ── Reply Banner ── */}
      {replyTo && (
        <div style={{
          display:    'flex',
          alignItems: 'center',
          padding:    '3px 8px',
          background: '#1E1E2E',
          fontSize:   '10px',
          color:      '#90CAF9',
          borderTop:  '1px solid #2A2A3E',
          gap: 6,
          flexShrink: 0,
        }}>
          ↩ Replying to <strong>{replyTo.name}</strong>
          <button onClick={() => setReplyTo(null)} style={{
            marginLeft: 'auto', background: 'transparent', border: 'none',
            color: '#555', cursor: 'pointer', fontSize: 12,
          }}>✕</button>
        </div>
      )}

      {/* ── Input Area ── */}
      <div style={{
        display:    'flex',
        alignItems: 'flex-end',
        padding:    '4px 6px',
        borderTop:  '1px solid #1E1E2E',
        gap: 4,
        position:   'relative',
        flexShrink: 0,
      }}>
        {/* Sticker toggle */}
        <button
          onClick={() => setShowStickers(s => !s)}
          style={{
            background: 'transparent', border: 'none',
            fontSize: 16, cursor: 'pointer', padding: '0 2px',
            opacity: 0.7, flexShrink: 0,
          }}
          title="Stickers"
        >
          😀
        </button>

        {/* Sticker picker */}
        {showStickers && (
          <StickerPicker
            onSelect={id => handleSend(id, 'STICKER')}
            onClose={() => setShowStickers(false)}
          />
        )}

        {/* Text input */}
        <textarea
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={activeChannel.isLocked ? '🔒 Channel locked' : 'Message...'}
          disabled={activeChannel.isLocked || sending}
          maxLength={500}
          rows={1}
          style={{
            flex:       1,
            background: '#1E1E2E',
            border:     '1px solid #333',
            borderRadius: 6,
            color:      '#E0E0E0',
            fontSize:   '11px',
            padding:    '5px 8px',
            resize:     'none',
            outline:    'none',
            lineHeight: '15px',
            maxHeight:  60,
            overflowY:  'auto',
            fontFamily: 'inherit',
          }}
        />

        {/* Send button */}
        <button
          onClick={() => handleSend(draft)}
          disabled={!draft.trim() || sending}
          style={{
            background: draft.trim() ? '#FFD700' : '#333',
            border:     'none',
            borderRadius: 6,
            width:      28,
            height:     28,
            cursor:     draft.trim() ? 'pointer' : 'default',
            display:    'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize:   14,
            flexShrink: 0,
            transition: 'background 0.15s',
          }}
          title="Send (Enter)"
        >
          {sending ? '…' : '➤'}
        </button>
      </div>
    </div>
  );
}

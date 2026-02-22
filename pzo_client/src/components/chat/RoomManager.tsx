/**
 * ============================================================================
 * FILE: pzo_client/src/components/chat/RoomManager.tsx
 * Point Zero One — Private Room Manager
 * 
 * Views: ROOM LIST (your rooms + discover) | CREATE | ROOM DETAIL
 * Room Types: HOUSEHOLD_TABLE | RIVALRY_ROOM | CUSTOM
 * Features: Create with name/type/max members/invite-only toggle,
 *           Join by invite code, Leave, Manage members (room owner),
 *           Copy invite link, Room member list with presence
 * ============================================================================
 */

import React, { useState, useCallback } from 'react';

// ─── TYPES ───────────────────────────────────────────────────────────────────

export type RoomType = 'HOUSEHOLD_TABLE' | 'RIVALRY_ROOM' | 'CUSTOM';

export interface RoomMember {
  userId:      string;
  displayName: string;
  isOwner:     boolean;
  isOnline:    boolean;
  joinedAt:    string;
}

export interface Room {
  id:            string;
  name:          string;
  type:          RoomType;
  creatorId:     string;
  maxMembers:    number;
  memberCount:   number;
  isInviteOnly:  boolean;
  inviteToken:   string | null;
  createdAt:     string;
  expiresAt:     string | null;
  isWarRoom:     boolean;
  members?:      RoomMember[];
}

interface RoomManagerProps {
  myId:          string;
  myRooms:       Room[];
  onCreateRoom:  (name: string, type: RoomType, maxMembers: number, inviteOnly: boolean) => Promise<string>;
  onJoinRoom:    (roomId: string, inviteToken?: string) => Promise<void>;
  onLeaveRoom:   (roomId: string) => Promise<void>;
  onSelectRoom:  (roomId: string) => void;   // opens the chat tab for this room
  onClose:       () => void;
}

// ─── ROOM TYPE CONFIG ─────────────────────────────────────────────────────────

const ROOM_TYPE_META: Record<RoomType, { emoji: string; label: string; description: string; defaultMax: number }> = {
  HOUSEHOLD_TABLE: {
    emoji:       '🏠',
    label:       'Household Table',
    description: 'Play co-op with family or close friends. Shared ledger, binding contracts.',
    defaultMax:  4,
  },
  RIVALRY_ROOM: {
    emoji:       '🏆',
    label:       'Rivalry Room',
    description: 'Private PvP arena. Ghost runs, decision diffs, pace lines. Trash talk stays here.',
    defaultMax:  8,
  },
  CUSTOM: {
    emoji:       '🎯',
    label:       'Custom Room',
    description: 'Private space for any group. You define the purpose.',
    defaultMax:  10,
  },
};

// ─── ROOM CARD ────────────────────────────────────────────────────────────────

function RoomCard({
  room, isOwner, onSelect, onLeave,
}: { room: Room; isOwner: boolean; onSelect: () => void; onLeave: () => void }) {
  const meta     = ROOM_TYPE_META[room.type];
  const isFull   = room.memberCount >= room.maxMembers;
  const isWar    = room.isWarRoom;

  return (
    <div style={{
      background:  '#1A1A2E',
      borderRadius: 8,
      padding:     '10px 12px',
      marginBottom: 8,
      border:      isWar ? '1px solid #EF5350' : '1px solid transparent',
      cursor:      'pointer',
    }}
    onClick={onSelect}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 20 }}>{isWar ? '⚔️' : meta.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '12px', fontWeight: 600,
            color: isWar ? '#EF5350' : '#E0E0E0',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {room.name}
          </div>
          <div style={{ fontSize: '9px', color: '#555' }}>
            {isWar ? 'War Room' : meta.label} · {room.memberCount}/{room.maxMembers}
            {room.isInviteOnly ? ' 🔒' : ' 🔓'}
          </div>
        </div>
        {/* Capacity indicator */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: '10px', color: isFull ? '#EF5350' : '#4CAF50' }}>
            {isFull ? 'FULL' : 'OPEN'}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
        <button
          onClick={onSelect}
          style={{
            flex: 1, background: '#FFD700', border: 'none', borderRadius: 5,
            color: '#000', fontSize: '11px', fontWeight: 700, padding: '4px 0', cursor: 'pointer',
          }}
        >
          Open Chat
        </button>
        {room.inviteToken && (
          <button
            onClick={() => {
              navigator.clipboard?.writeText(room.inviteToken!);
            }}
            title="Copy invite code"
            style={{
              background: '#1E1E2E', border: '1px solid #333', borderRadius: 5,
              color: '#90CAF9', fontSize: '11px', padding: '4px 8px', cursor: 'pointer',
            }}
          >
            🔗
          </button>
        )}
        {!isWar && (
          <button
            onClick={() => {
              if (confirm(`Leave "${room.name}"?`)) onLeave();
            }}
            style={{
              background: '#4A0000', border: 'none', borderRadius: 5,
              color: '#EF9A9A', fontSize: '11px', padding: '4px 8px', cursor: 'pointer',
            }}
          >
            Leave
          </button>
        )}
      </div>
    </div>
  );
}

// ─── CREATE FORM ──────────────────────────────────────────────────────────────

function CreateRoomForm({
  onSubmit, onCancel,
}: { onSubmit: (name: string, type: RoomType, max: number, inviteOnly: boolean) => Promise<void>; onCancel: () => void }) {
  const [name,        setName]        = useState('');
  const [type,        setType]        = useState<RoomType>('CUSTOM');
  const [maxMembers,  setMaxMembers]  = useState(ROOM_TYPE_META['CUSTOM'].defaultMax);
  const [inviteOnly,  setInviteOnly]  = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');

  const meta = ROOM_TYPE_META[type];

  const handleTypeChange = (t: RoomType) => {
    setType(t);
    setMaxMembers(ROOM_TYPE_META[t].defaultMax);
  };

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Room name is required.'); return; }
    if (name.length > 50) { setError('Name max 50 characters.'); return; }
    setLoading(true);
    setError('');
    try {
      await onSubmit(name.trim(), type, maxMembers, inviteOnly);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create room.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ fontSize: '12px', color: '#FFD700', fontWeight: 700, marginBottom: 12 }}>
        Create New Room
      </div>

      {/* Room type selector */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: '11px', color: '#888', marginBottom: 6 }}>Room Type:</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(Object.keys(ROOM_TYPE_META) as RoomType[]).map(t => {
            const m = ROOM_TYPE_META[t];
            return (
              <div key={t}
                onClick={() => handleTypeChange(t)}
                style={{
                  display:    'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  padding:    '8px 10px',
                  borderRadius: 6,
                  background: type === t ? 'rgba(255,215,0,0.08)' : '#111',
                  border:     type === t ? '1px solid rgba(255,215,0,0.3)' : '1px solid #222',
                  cursor:     'pointer',
                }}
              >
                <span style={{ fontSize: 18, marginTop: 1 }}>{m.emoji}</span>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: type === t ? 700 : 400, color: type === t ? '#FFD700' : '#E0E0E0' }}>
                    {m.label}
                  </div>
                  <div style={{ fontSize: '10px', color: '#666', marginTop: 1 }}>{m.description}</div>
                </div>
                {type === t && <span style={{ marginLeft: 'auto', color: '#FFD700', fontSize: 14 }}>✓</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Room name */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: '11px', color: '#888', marginBottom: 4 }}>Room Name:</div>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={`e.g. "Sunday Game Night"`}
          maxLength={50}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: '#1A1A2E', border: '1px solid #333', borderRadius: 6,
            padding: '6px 10px', color: '#E0E0E0', fontSize: '11px', outline: 'none',
          }}
        />
      </div>

      {/* Max members */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: '11px', color: '#888', marginBottom: 4 }}>Max Members: {maxMembers}</div>
        <input
          type="range" min={2} max={50} value={maxMembers}
          onChange={e => setMaxMembers(parseInt(e.target.value))}
          style={{ width: '100%', accentColor: '#FFD700' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#555' }}>
          <span>2</span><span>50</span>
        </div>
      </div>

      {/* Invite only toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: '11px', color: '#E0E0E0' }}>Invite-Only</div>
          <div style={{ fontSize: '10px', color: '#555' }}>Generate invite code, players must use code to join</div>
        </div>
        <div
          onClick={() => setInviteOnly(!inviteOnly)}
          style={{
            width: 40, height: 22, borderRadius: 11,
            background: inviteOnly ? '#FFD700' : '#333',
            position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
            flexShrink: 0,
          }}
        >
          <div style={{
            position: 'absolute', top: 3, left: inviteOnly ? 21 : 3,
            width: 16, height: 16, borderRadius: '50%',
            background: '#fff', transition: 'left 0.2s',
          }} />
        </div>
      </div>

      {error && (
        <div style={{ color: '#EF5350', fontSize: '11px', marginBottom: 8 }}>{error}</div>
      )}

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onCancel} style={{
          flex: 1, background: '#1E1E2E', border: '1px solid #333',
          borderRadius: 6, color: '#999', fontSize: '11px', padding: '7px 0', cursor: 'pointer',
        }}>
          Cancel
        </button>
        <button onClick={handleSubmit} disabled={loading} style={{
          flex: 2, background: loading ? '#555' : '#FFD700',
          border: 'none', borderRadius: 6, color: '#000',
          fontSize: '11px', fontWeight: 700, padding: '7px 0', cursor: loading ? 'default' : 'pointer',
        }}>
          {loading ? 'Creating...' : `Create ${meta.label}`}
        </button>
      </div>
    </div>
  );
}

// ─── JOIN BY CODE ────────────────────────────────────────────────────────────

function JoinByCodeForm({ onJoin, onCancel }: { onJoin: (roomId: string, token: string) => Promise<void>; onCancel: () => void }) {
  const [code,    setCode]    = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const handleJoin = async () => {
    const parts = code.trim().split(':');
    if (parts.length < 1 || !parts[0]) { setError('Enter a valid invite code.'); return; }
    setLoading(true);
    setError('');
    try {
      // Invite code format: "roomId:token" or just "token" 
      const [roomId, token] = parts.length === 2 ? parts : [parts[0], parts[0]];
      await onJoin(roomId, token);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to join room.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ fontSize: '12px', color: '#90CAF9', fontWeight: 700, marginBottom: 10 }}>
        Join by Invite Code
      </div>
      <input
        value={code}
        onChange={e => setCode(e.target.value)}
        placeholder="Paste invite code here..."
        style={{
          width: '100%', boxSizing: 'border-box',
          background: '#1A1A2E', border: '1px solid #333', borderRadius: 6,
          padding: '7px 10px', color: '#E0E0E0', fontSize: '11px', outline: 'none',
          marginBottom: 8,
        }}
        onKeyDown={e => e.key === 'Enter' && handleJoin()}
      />
      {error && <div style={{ color: '#EF5350', fontSize: '11px', marginBottom: 6 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onCancel} style={{ flex: 1, background: '#1E1E2E', border: '1px solid #333', borderRadius: 6, color: '#999', fontSize: '11px', padding: '6px 0', cursor: 'pointer' }}>
          Cancel
        </button>
        <button onClick={handleJoin} disabled={loading || !code.trim()} style={{ flex: 2, background: '#90CAF9', border: 'none', borderRadius: 6, color: '#000', fontSize: '11px', fontWeight: 700, padding: '6px 0', cursor: 'pointer' }}>
          {loading ? 'Joining...' : 'Join Room'}
        </button>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

type View = 'LIST' | 'CREATE' | 'JOIN_CODE';

export default function RoomManager({
  myId, myRooms, onCreateRoom, onJoinRoom, onLeaveRoom, onSelectRoom, onClose,
}: RoomManagerProps) {
  const [view, setView] = useState<View>('LIST');

  const handleCreate = useCallback(async (
    name: string, type: RoomType, max: number, inviteOnly: boolean
  ) => {
    await onCreateRoom(name, type, max, inviteOnly);
    setView('LIST');
  }, [onCreateRoom]);

  const handleJoin = useCallback(async (roomId: string, token: string) => {
    await onJoinRoom(roomId, token);
    setView('LIST');
  }, [onJoinRoom]);

  return (
    <div style={{
      position:      'fixed',
      top:           '50%',
      left:          '50%',
      transform:     'translate(-50%, -50%)',
      width:         380,
      maxHeight:     520,
      background:    'rgba(8, 8, 18, 0.97)',
      border:        '1px solid #2A2A3E',
      borderRadius:  12,
      display:       'flex',
      flexDirection: 'column',
      zIndex:        2000,
      boxShadow:     '0 16px 48px rgba(0,0,0,0.8)',
      fontFamily:    '"Inter", "Segoe UI", sans-serif',
      overflow:      'hidden',
    }}>

      {/* ── Header ── */}
      <div style={{
        display:    'flex',
        alignItems: 'center',
        padding:    '10px 14px',
        background: '#0D0D1E',
        borderBottom: '1px solid #1E1E2E',
        flexShrink: 0,
      }}>
        {view !== 'LIST' && (
          <button onClick={() => setView('LIST')} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: 16, marginRight: 8, padding: 0 }}>
            ←
          </button>
        )}
        <span style={{ fontSize: '14px', fontWeight: 700, color: '#E0E0E0', flex: 1 }}>
          {view === 'LIST' ? '🎯 Private Rooms' : view === 'CREATE' ? 'Create Room' : 'Join by Code'}
        </span>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', fontSize: 18 }}>
          ✕
        </button>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', scrollbarWidth: 'thin', scrollbarColor: '#333 transparent' }}>

        {/* ── LIST ── */}
        {view === 'LIST' && (
          <div>
            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <button onClick={() => setView('CREATE')} style={{
                flex: 1, background: '#FFD700', border: 'none', borderRadius: 6,
                color: '#000', fontSize: '11px', fontWeight: 700, padding: '7px 0', cursor: 'pointer',
              }}>
                + Create Room
              </button>
              <button onClick={() => setView('JOIN_CODE')} style={{
                flex: 1, background: '#1E1E2E', border: '1px solid #333', borderRadius: 6,
                color: '#90CAF9', fontSize: '11px', padding: '7px 0', cursor: 'pointer',
              }}>
                🔗 Join by Code
              </button>
            </div>

            {/* Room list */}
            {myRooms.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: '#444' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🎯</div>
                <div style={{ fontSize: '12px' }}>No rooms yet.</div>
                <div style={{ fontSize: '11px', marginTop: 4 }}>Create a Household Table or Rivalry Room to get started.</div>
              </div>
            ) : (
              myRooms.map(room => (
                <RoomCard
                  key={room.id}
                  room={room}
                  isOwner={room.creatorId === myId}
                  onSelect={() => onSelectRoom(room.id)}
                  onLeave={() => onLeaveRoom(room.id)}
                />
              ))
            )}

            {/* Room type guide */}
            <div style={{ marginTop: 14, padding: '10px', background: '#0D0D1E', borderRadius: 8, border: '1px solid #1A1A2E' }}>
              <div style={{ fontSize: '10px', color: '#666', fontWeight: 700, marginBottom: 6 }}>ROOM TYPES</div>
              {(Object.entries(ROOM_TYPE_META) as [RoomType, typeof ROOM_TYPE_META[RoomType]][]).map(([key, m]) => (
                <div key={key} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 13 }}>{m.emoji}</span>
                  <div>
                    <span style={{ fontSize: '10px', color: '#E0E0E0', fontWeight: 600 }}>{m.label}</span>
                    <span style={{ fontSize: '10px', color: '#555' }}> — {m.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── CREATE ── */}
        {view === 'CREATE' && (
          <CreateRoomForm onSubmit={handleCreate} onCancel={() => setView('LIST')} />
        )}

        {/* ── JOIN BY CODE ── */}
        {view === 'JOIN_CODE' && (
          <JoinByCodeForm onJoin={handleJoin} onCancel={() => setView('LIST')} />
        )}
      </div>
    </div>
  );
}

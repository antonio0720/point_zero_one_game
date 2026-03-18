/**
 * ============================================================================
 * @pzo/engine/components/chat — RoomManager
 * FILE: frontend/packages/engine/src/components/chat/RoomManager.tsx
 * ============================================================================
 */

import React, { useCallback, useState } from 'react';
import type { PackageChatRoom, RoomType } from '../../chat';

export interface RoomManagerProps {
  readonly myId: string;
  readonly myRooms: readonly PackageChatRoom[];
  readonly onCreateRoom: (name: string, type: RoomType, maxMembers: number, inviteOnly: boolean) => Promise<string>;
  readonly onJoinRoom: (roomId: string, inviteToken?: string) => Promise<void>;
  readonly onLeaveRoom: (roomId: string) => Promise<void>;
  readonly onSelectRoom: (roomId: string) => void;
  readonly onClose: () => void;
}

const ROOM_TYPE_META: Record<RoomType, { emoji: string; label: string; description: string; defaultMax: number }> = {
  HOUSEHOLD_TABLE: {
    emoji: '🏠',
    label: 'Household Table',
    description: 'Play co-op with family or close allies. Shared ledger, binding contracts.',
    defaultMax: 4,
  },
  RIVALRY_ROOM: {
    emoji: '🏆',
    label: 'Rivalry Room',
    description: 'Private PvP arena. Ghost diffs, pace lines, receipts, and pressure.',
    defaultMax: 8,
  },
  CUSTOM: {
    emoji: '🎯',
    label: 'Custom Room',
    description: 'Private operating room. You define the purpose.',
    defaultMax: 10,
  },
};

function RoomCard({
  room,
  isOwner,
  onSelect,
  onLeave,
}: {
  readonly room: PackageChatRoom;
  readonly isOwner: boolean;
  readonly onSelect: () => void;
  readonly onLeave: () => void;
}) {
  const meta = ROOM_TYPE_META[room.type];
  const isFull = room.memberCount >= room.maxMembers;
  const war = room.isWarRoom;

  return (
    <div
      style={{
        background: '#1A1A2E',
        borderRadius: 8,
        padding: '10px 12px',
        marginBottom: 8,
        border: war ? '1px solid #EF5350' : '1px solid transparent',
        cursor: 'pointer',
      }}
      onClick={onSelect}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 20 }}>{war ? '⚔️' : meta.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: war ? '#EF5350' : '#E0E0E0',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {room.name}
          </div>
          <div style={{ fontSize: '9px', color: '#555' }}>
            {war ? 'War Room' : meta.label} · {room.memberCount}/{room.maxMembers}
            {room.isInviteOnly ? ' 🔒' : ' 🔓'}
            {isOwner ? ' · OWNER' : ''}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: '10px', color: isFull ? '#EF5350' : '#4CAF50' }}>{isFull ? 'FULL' : 'OPEN'}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6 }} onClick={(event) => event.stopPropagation()}>
        <button
          onClick={onSelect}
          style={{
            flex: 1,
            background: '#FFD700',
            border: 'none',
            borderRadius: 5,
            color: '#000',
            fontSize: '11px',
            fontWeight: 700,
            padding: '4px 0',
            cursor: 'pointer',
          }}
        >
          Open Chat
        </button>
        {room.inviteToken ? (
          <button
            onClick={() => {
              navigator.clipboard?.writeText(`${room.id}:${room.inviteToken}`);
            }}
            title="Copy invite code"
            style={{
              background: '#1E1E2E',
              border: '1px solid #333',
              borderRadius: 5,
              color: '#90CAF9',
              fontSize: '11px',
              padding: '4px 8px',
              cursor: 'pointer',
            }}
          >
            🔗
          </button>
        ) : null}
        {!war ? (
          <button
            onClick={() => {
              if (window.confirm(`Leave "${room.name}"?`)) onLeave();
            }}
            style={{
              background: '#4A0000',
              border: 'none',
              borderRadius: 5,
              color: '#EF9A9A',
              fontSize: '11px',
              padding: '4px 8px',
              cursor: 'pointer',
            }}
          >
            Leave
          </button>
        ) : null}
      </div>
    </div>
  );
}

function CreateRoomForm({
  onSubmit,
  onCancel,
}: {
  readonly onSubmit: (name: string, type: RoomType, max: number, inviteOnly: boolean) => Promise<void>;
  readonly onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<RoomType>('CUSTOM');
  const [maxMembers, setMaxMembers] = useState(ROOM_TYPE_META.CUSTOM.defaultMax);
  const [inviteOnly, setInviteOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const meta = ROOM_TYPE_META[type];
  const handleTypeChange = (nextType: RoomType) => {
    setType(nextType);
    setMaxMembers(ROOM_TYPE_META[nextType].defaultMax);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Room name is required.');
      return;
    }
    if (name.length > 50) {
      setError('Name max 50 characters.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onSubmit(name.trim(), type, maxMembers, inviteOnly);
    } catch (errorValue) {
      setError(errorValue instanceof Error ? errorValue.message : 'Failed to create room.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ fontSize: '12px', color: '#FFD700', fontWeight: 700, marginBottom: 12 }}>Create New Room</div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: '11px', color: '#888', marginBottom: 6 }}>Room Type:</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(Object.keys(ROOM_TYPE_META) as RoomType[]).map((roomType) => {
            const roomMeta = ROOM_TYPE_META[roomType];
            const active = type === roomType;
            return (
              <div
                key={roomType}
                onClick={() => handleTypeChange(roomType)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  padding: '8px 10px',
                  borderRadius: 6,
                  background: active ? 'rgba(255,215,0,0.08)' : '#111',
                  border: active ? '1px solid rgba(255,215,0,0.3)' : '1px solid #222',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 18, marginTop: 1 }}>{roomMeta.emoji}</span>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: active ? 700 : 400, color: active ? '#FFD700' : '#E0E0E0' }}>{roomMeta.label}</div>
                  <div style={{ fontSize: '10px', color: '#666', marginTop: 1 }}>{roomMeta.description}</div>
                </div>
                {active ? <span style={{ marginLeft: 'auto', color: '#FFD700', fontSize: 14 }}>✓</span> : null}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: '11px', color: '#888', marginBottom: 4 }}>Room Name:</div>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder='e.g. “Sunday Game Night”'
          maxLength={50}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            background: '#1A1A2E',
            border: '1px solid #333',
            borderRadius: 6,
            padding: '6px 10px',
            color: '#E0E0E0',
            fontSize: '11px',
            outline: 'none',
          }}
        />
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: '11px', color: '#888', marginBottom: 4 }}>Max Members: {maxMembers}</div>
        <input
          type='range'
          min={2}
          max={50}
          value={maxMembers}
          onChange={(event) => setMaxMembers(parseInt(event.target.value, 10))}
          style={{ width: '100%', accentColor: '#FFD700' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#555' }}>
          <span>2</span>
          <span>50</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: '11px', color: '#E0E0E0' }}>Invite-Only</div>
          <div style={{ fontSize: '10px', color: '#555' }}>Generate invite code. Players must use code to join.</div>
        </div>
        <div
          onClick={() => setInviteOnly(!inviteOnly)}
          style={{
            width: 40,
            height: 22,
            borderRadius: 11,
            background: inviteOnly ? '#FFD700' : '#333',
            position: 'relative',
            cursor: 'pointer',
            transition: 'background 0.2s',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 3,
              left: inviteOnly ? 21 : 3,
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: '#fff',
              transition: 'left 0.2s',
            }}
          />
        </div>
      </div>

      {error ? <div style={{ color: '#EF5350', fontSize: '11px', marginBottom: 8 }}>{error}</div> : null}

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onCancel} style={{ flex: 1, background: '#1E1E2E', border: '1px solid #333', borderRadius: 6, color: '#999', fontSize: '11px', padding: '7px 0', cursor: 'pointer' }}>
          Cancel
        </button>
        <button onClick={handleSubmit} disabled={loading} style={{ flex: 2, background: loading ? '#555' : '#FFD700', border: 'none', borderRadius: 6, color: '#000', fontSize: '11px', fontWeight: 700, padding: '7px 0', cursor: loading ? 'default' : 'pointer' }}>
          {loading ? 'Creating...' : `Create ${meta.label}`}
        </button>
      </div>
    </div>
  );
}

function JoinByCodeForm({
  onJoin,
  onCancel,
}: {
  readonly onJoin: (roomId: string, token: string) => Promise<void>;
  readonly onCancel: () => void;
}) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleJoin = async () => {
    const parts = code.trim().split(':');
    if (parts.length < 1 || !parts[0]) {
      setError('Enter a valid invite code.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [roomId, token] = parts.length === 2 ? parts : [parts[0], parts[0]];
      await onJoin(roomId, token);
    } catch (errorValue) {
      setError(errorValue instanceof Error ? errorValue.message : 'Failed to join room.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ fontSize: '12px', color: '#90CAF9', fontWeight: 700, marginBottom: 10 }}>Join by Invite Code</div>
      <input
        value={code}
        onChange={(event) => setCode(event.target.value)}
        placeholder='Paste invite code here...'
        style={{ width: '100%', boxSizing: 'border-box', background: '#1A1A2E', border: '1px solid #333', borderRadius: 6, padding: '7px 10px', color: '#E0E0E0', fontSize: '11px', outline: 'none', marginBottom: 8 }}
        onKeyDown={(event) => event.key === 'Enter' && handleJoin()}
      />
      {error ? <div style={{ color: '#EF5350', fontSize: '11px', marginBottom: 6 }}>{error}</div> : null}
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

type View = 'LIST' | 'CREATE' | 'JOIN_CODE';

export default function RoomManager({
  myId,
  myRooms,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  onSelectRoom,
  onClose,
}: RoomManagerProps) {
  const [view, setView] = useState<View>('LIST');

  const handleCreate = useCallback(
    async (name: string, type: RoomType, max: number, inviteOnly: boolean) => {
      await onCreateRoom(name, type, max, inviteOnly);
      setView('LIST');
    },
    [onCreateRoom],
  );

  const handleJoin = useCallback(
    async (roomId: string, token: string) => {
      await onJoinRoom(roomId, token);
      setView('LIST');
    },
    [onJoinRoom],
  );

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 420,
        maxHeight: 560,
        background: 'rgba(8,8,18,0.97)',
        border: '1px solid #2A2A3E',
        borderRadius: 12,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 16px 48px rgba(0,0,0,0.8)',
        fontFamily: 'Inter, system-ui, sans-serif',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', background: '#0D0D1E', borderBottom: '1px solid #1E1E2E', flexShrink: 0 }}>
        {view !== 'LIST' ? (
          <button onClick={() => setView('LIST')} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: 16, marginRight: 8, padding: 0 }}>
            ←
          </button>
        ) : null}
        <span style={{ fontSize: '14px', fontWeight: 700, color: '#E0E0E0', flex: 1 }}>
          {view === 'LIST' ? '🎯 Private Rooms' : view === 'CREATE' ? 'Create Room' : 'Join by Code'}
        </span>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', fontSize: 18 }}>
          ✕
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', scrollbarWidth: 'thin', scrollbarColor: '#333 transparent' }}>
        {view === 'LIST' ? (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <button onClick={() => setView('CREATE')} style={{ flex: 1, background: '#FFD700', border: 'none', borderRadius: 6, color: '#000', fontSize: '11px', fontWeight: 700, padding: '7px 0', cursor: 'pointer' }}>
                + Create Room
              </button>
              <button onClick={() => setView('JOIN_CODE')} style={{ flex: 1, background: '#1E1E2E', border: '1px solid #333', borderRadius: 6, color: '#90CAF9', fontSize: '11px', padding: '7px 0', cursor: 'pointer' }}>
                🔗 Join by Code
              </button>
            </div>

            {myRooms.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: '#444' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🎯</div>
                <div style={{ fontSize: '12px' }}>No rooms yet.</div>
                <div style={{ fontSize: '11px', marginTop: 4 }}>Create a Household Table or Rivalry Room to get started.</div>
              </div>
            ) : (
              myRooms.map((room) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  isOwner={room.creatorId === myId}
                  onSelect={() => onSelectRoom(room.id)}
                  onLeave={() => onLeaveRoom(room.id)}
                />
              ))
            )}

            <div style={{ marginTop: 14, padding: '10px', background: '#0D0D1E', borderRadius: 8, border: '1px solid #1A1A2E' }}>
              <div style={{ fontSize: '10px', color: '#666', fontWeight: 700, marginBottom: 6 }}>ROOM TYPES</div>
              {(Object.entries(ROOM_TYPE_META) as [RoomType, (typeof ROOM_TYPE_META)[RoomType]][]).map(([key, meta]) => (
                <div key={key} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 13 }}>{meta.emoji}</span>
                  <div>
                    <span style={{ fontSize: '10px', color: '#E0E0E0', fontWeight: 600 }}>{meta.label}</span>
                    <span style={{ fontSize: '10px', color: '#555' }}> — {meta.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {view === 'CREATE' ? <CreateRoomForm onSubmit={handleCreate} onCancel={() => setView('LIST')} /> : null}
        {view === 'JOIN_CODE' ? <JoinByCodeForm onJoin={handleJoin} onCancel={() => setView('LIST')} /> : null}
      </div>
    </div>
  );
}

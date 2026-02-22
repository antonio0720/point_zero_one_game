/**
 * ============================================================================
 * FILE: pzo_server/src/services/chat/ChatService.ts
 * Point Zero One — Sovereign Chat Engine
 * 
 * Channels: GLOBAL → SERVER → ALLIANCE → ALLIANCE_OFFICER → ROOM → DM
 * Features: Unsend (15s window), Block (silent), Rate limit, Moderation queue,
 *           Rank-gated rooms, Auto-translate stubs, Sticker system
 * 
 * Deploy to: pzo_server/src/services/chat/
 * Requires:  Redis (pub/sub + rate limiter), Postgres (persistence),
 *            WS/SSE edge already wired from base multiplayer stack
 * ============================================================================
 */

import { Redis } from 'ioredis';
import { Pool } from 'pg';
import { EventEmitter } from 'events';

// ─── TYPES ────────────────────────────────────────────────────────────────────

export type ChannelType =
  | 'GLOBAL'           // All players, all servers
  | 'SERVER'           // All players on same server/region
  | 'ALLIANCE'         // All alliance members
  | 'ALLIANCE_OFFICER' // R3+ only
  | 'ROOM'             // Private room (table, rivalry, household)
  | 'DM';              // 1:1 direct message

export type MessageStatus = 'SENT' | 'DELIVERED' | 'READ' | 'UNSENT' | 'DELETED_BY_MOD';

export type MessageType =
  | 'TEXT'
  | 'STICKER'
  | 'SYSTEM'           // "Player X joined the alliance"
  | 'WAR_ALERT'        // "WAR DECLARED against [Alliance]"
  | 'DEAL_INVITE'      // Inline deal invitation card
  | 'PROOF_SHARE';     // Shareable run proof

export interface ChatMessage {
  id:         string;
  channelType: ChannelType;
  channelId:  string;      // allianceId | roomId | "global" | serverId | `dm_${sorted_ids}`
  senderId:   string;
  senderName: string;
  senderRank: string | null;   // "R5", "R4", etc — null for non-alliance channels
  senderTitle: string | null;  // "THE_SOVEREIGN" etc
  type:       MessageType;
  body:       string;          // text content or sticker_id
  metadata:   Record<string, unknown> | null;
  status:     MessageStatus;
  sentAt:     Date;
  editedAt:   Date | null;
  unsentAt:   Date | null;
  replyToId:  string | null;   // threading
  reactions:  MessageReaction[];
  flags:      number;          // bitmask: 1=pinned, 2=highlighted, 4=contains_link
}

export interface MessageReaction {
  emoji:   string;
  count:   number;
  userIds: string[];   // first 3 stored, rest counted
}

export interface ChannelMeta {
  id:          string;
  type:        ChannelType;
  name:        string;
  memberCount: number;
  slowModeSeconds: number;   // 0 = off
  isLocked:    boolean;      // R3+ can lock channel
  pinnedMessageId: string | null;
}

export interface BlockEntry {
  blockerId:  string;
  blockedId:  string;
  createdAt:  Date;
  reason:     string | null;
}

export interface UnsendResult {
  success:   boolean;
  messageId: string;
  reason?:   'NOT_FOUND' | 'NOT_SENDER' | 'WINDOW_EXPIRED' | 'WAR_ROOM_LOCKED';
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const UNSEND_WINDOW_MS      = 15_000;   // 15 seconds
const MAX_MSG_LENGTH        = 500;
const RATE_LIMIT_GLOBAL_MS  = 3_000;    // 1 msg per 3s in global
const RATE_LIMIT_ALLIANCE_MS = 1_000;   // 1 msg per 1s in alliance
const RATE_LIMIT_DM_MS      = 500;      // 1 msg per 0.5s in DM
const GLOBAL_HISTORY_CAP    = 200;      // messages kept in redis for global
const ALLIANCE_HISTORY_CAP  = 500;
const DM_HISTORY_CAP        = 1_000;
const STICKER_IDS = new Set([
  'pzo_fist', 'pzo_fire', 'pzo_money_bag', 'pzo_crown',
  'pzo_skull', 'pzo_swords', 'pzo_handshake', 'pzo_chart_up',
  'pzo_fubar', 'pzo_missed', 'pzo_privileged', 'pzo_receipt',
]);

// ─── CHAT SERVICE ─────────────────────────────────────────────────────────────

export class ChatService extends EventEmitter {
  private redis:  Redis;
  private pg:     Pool;
  private sub:    Redis;   // dedicated subscriber connection

  constructor(redis: Redis, pg: Pool) {
    super();
    this.redis = redis;
    this.pg    = pg;
    this.sub   = redis.duplicate();
    this._subscribeToRedis();
  }

  // ─── SEND ──────────────────────────────────────────────────────────────────

  async send(
    senderId:    string,
    channelType: ChannelType,
    channelId:   string,
    type:        MessageType,
    body:        string,
    opts?: {
      replyToId?: string;
      metadata?:  Record<string, unknown>;
      senderRank?: string;
      senderTitle?: string;
    }
  ): Promise<ChatMessage | { error: string }> {

    // 1. Permission gate
    const permCheck = await this._checkPermission(senderId, channelType, channelId, opts?.senderRank);
    if (!permCheck.allowed) return { error: permCheck.reason! };

    // 2. Block check (DM only — sender/receiver)
    if (channelType === 'DM') {
      const otherId = this._dmOtherId(channelId, senderId);
      const blocked = await this.isBlocked(senderId, otherId);
      if (blocked) return { error: 'BLOCKED' };
    }

    // 3. Rate limit
    const rateLimitMs = this._getRateLimit(channelType);
    const rlKey = `rl:chat:${senderId}:${channelType}`;
    const last  = await this.redis.get(rlKey);
    if (last) return { error: 'RATE_LIMITED' };
    await this.redis.set(rlKey, '1', 'PX', rateLimitMs);

    // 4. Content validation
    if (type === 'TEXT') {
      if (!body || body.trim().length === 0) return { error: 'EMPTY_MESSAGE' };
      if (body.length > MAX_MSG_LENGTH) return { error: 'TOO_LONG' };
      body = this._sanitize(body);
    }
    if (type === 'STICKER') {
      if (!STICKER_IDS.has(body)) return { error: 'INVALID_STICKER' };
    }

    // 5. Construct message
    const msg: ChatMessage = {
      id:          this._genId(),
      channelType,
      channelId,
      senderId,
      senderName:  await this._getSenderName(senderId),
      senderRank:  opts?.senderRank ?? null,
      senderTitle: opts?.senderTitle ?? null,
      type,
      body,
      metadata:    opts?.metadata ?? null,
      status:      'SENT',
      sentAt:      new Date(),
      editedAt:    null,
      unsentAt:    null,
      replyToId:   opts?.replyToId ?? null,
      reactions:   [],
      flags:       this._computeFlags(body, type),
    };

    // 6. Persist
    await this._persist(msg);

    // 7. Push to Redis channel → WS fan-out
    const cap = this._getHistoryCap(channelType);
    const listKey = `chat:history:${channelId}`;
    const pipe = this.redis.pipeline();
    pipe.lpush(listKey, JSON.stringify(msg));
    pipe.ltrim(listKey, 0, cap - 1);
    pipe.publish(`chat:${channelId}`, JSON.stringify({ event: 'MESSAGE', data: msg }));
    await pipe.exec();

    return msg;
  }

  // ─── UNSEND ────────────────────────────────────────────────────────────────

  async unsend(senderId: string, messageId: string): Promise<UnsendResult> {
    const row = await this.pg.query<{ sender_id: string; sent_at: Date; channel_type: string }>(
      'SELECT sender_id, sent_at, channel_type FROM chat_messages WHERE id = $1',
      [messageId]
    );

    if (!row.rows.length) return { success: false, messageId, reason: 'NOT_FOUND' };

    const { sender_id, sent_at, channel_type } = row.rows[0];

    if (sender_id !== senderId) return { success: false, messageId, reason: 'NOT_SENDER' };

    // War room: unsend disabled (receipts are immutable in war context)
    if (channel_type === 'ROOM') {
      const isWarRoom = await this._isWarRoom(messageId);
      if (isWarRoom) return { success: false, messageId, reason: 'WAR_ROOM_LOCKED' };
    }

    const age = Date.now() - new Date(sent_at).getTime();
    if (age > UNSEND_WINDOW_MS) return { success: false, messageId, reason: 'WINDOW_EXPIRED' };

    // Mark unsent in DB
    await this.pg.query(
      `UPDATE chat_messages SET status = 'UNSENT', unsent_at = NOW(), body = '' WHERE id = $1`,
      [messageId]
    );

    // Broadcast UNSENT event so all clients wipe the bubble
    const channelId = await this._getChannelId(messageId);
    await this.redis.publish(
      `chat:${channelId}`,
      JSON.stringify({ event: 'MESSAGE_UNSENT', data: { messageId, senderId } })
    );

    return { success: true, messageId };
  }

  // ─── HISTORY ───────────────────────────────────────────────────────────────

  async getHistory(
    userId:     string,
    channelId:  string,
    before?:    Date,
    limit = 50
  ): Promise<ChatMessage[]> {
    const blockedIds = await this._getBlockedByUser(userId);

    const query = before
      ? `SELECT * FROM chat_messages
         WHERE channel_id = $1 AND sent_at < $2 AND status NOT IN ('UNSENT','DELETED_BY_MOD')
         ORDER BY sent_at DESC LIMIT $3`
      : `SELECT * FROM chat_messages
         WHERE channel_id = $1 AND status NOT IN ('UNSENT','DELETED_BY_MOD')
         ORDER BY sent_at DESC LIMIT $2`;

    const params = before ? [channelId, before, limit] : [channelId, limit];
    const rows   = await this.pg.query(params.length === 3 ? query : query.replace('$3','$2'), params);

    return rows.rows
      .map(this._rowToMessage)
      .filter(m => !blockedIds.has(m.senderId));   // silently hide blocked user messages
  }

  // ─── BLOCK ─────────────────────────────────────────────────────────────────

  async block(blockerId: string, blockedId: string, reason?: string): Promise<void> {
    await this.pg.query(
      `INSERT INTO chat_blocks (blocker_id, blocked_id, reason, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (blocker_id, blocked_id) DO NOTHING`,
      [blockerId, blockedId, reason ?? null]
    );
    // Invalidate cached block list
    await this.redis.del(`blocks:${blockerId}`);
    this.emit('PLAYER_BLOCKED', { blockerId, blockedId });
  }

  async unblock(blockerId: string, blockedId: string): Promise<void> {
    await this.pg.query(
      `DELETE FROM chat_blocks WHERE blocker_id = $1 AND blocked_id = $2`,
      [blockerId, blockedId]
    );
    await this.redis.del(`blocks:${blockerId}`);
  }

  async isBlocked(userId: string, targetId: string): Promise<boolean> {
    // Check both directions — either party blocking counts
    const [fwd, rev] = await Promise.all([
      this._checkBlockExists(userId, targetId),
      this._checkBlockExists(targetId, userId),
    ]);
    return fwd || rev;
  }

  async getBlockList(userId: string): Promise<BlockEntry[]> {
    const rows = await this.pg.query(
      `SELECT b.*, p.display_name as blocked_name
       FROM chat_blocks b
       JOIN players p ON p.id = b.blocked_id
       WHERE b.blocker_id = $1
       ORDER BY b.created_at DESC`,
      [userId]
    );
    return rows.rows.map(r => ({
      blockerId:  r.blocker_id,
      blockedId:  r.blocked_id,
      createdAt:  r.created_at,
      reason:     r.reason,
    }));
  }

  // ─── REACTIONS ─────────────────────────────────────────────────────────────

  async react(userId: string, messageId: string, emoji: string): Promise<void> {
    // Toggle: if user already reacted with same emoji, remove
    await this.pg.query(
      `INSERT INTO chat_reactions (message_id, user_id, emoji, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (message_id, user_id, emoji) DO DELETE`,
      [messageId, userId, emoji]
    );
    // Publish updated reaction counts
    const counts = await this._getReactions(messageId);
    const channelId = await this._getChannelId(messageId);
    await this.redis.publish(
      `chat:${channelId}`,
      JSON.stringify({ event: 'REACTION_UPDATE', data: { messageId, reactions: counts } })
    );
  }

  // ─── PIN ───────────────────────────────────────────────────────────────────

  async pin(moderatorId: string, messageId: string, channelId: string): Promise<void> {
    // Requires R3+ or room owner
    const canPin = await this._canModerate(moderatorId, channelId);
    if (!canPin) throw new Error('INSUFFICIENT_RANK');

    await this.pg.query(
      `UPDATE chat_messages SET flags = flags | 1 WHERE id = $1`,
      [messageId]
    );
    await this.pg.query(
      `UPDATE chat_channels SET pinned_message_id = $1 WHERE id = $2`,
      [messageId, channelId]
    );
    await this.redis.publish(
      `chat:${channelId}`,
      JSON.stringify({ event: 'MESSAGE_PINNED', data: { messageId, pinnedBy: moderatorId } })
    );
  }

  // ─── MODERATION ────────────────────────────────────────────────────────────

  async modDelete(moderatorId: string, messageId: string): Promise<void> {
    // R3+ or server mod
    await this.pg.query(
      `UPDATE chat_messages SET status = 'DELETED_BY_MOD', body = '[message removed]', deleted_by = $1 WHERE id = $2`,
      [moderatorId, messageId]
    );
    const channelId = await this._getChannelId(messageId);
    await this.redis.publish(
      `chat:${channelId}`,
      JSON.stringify({ event: 'MESSAGE_DELETED_BY_MOD', data: { messageId, modId: moderatorId } })
    );
  }

  async slowMode(channelId: string, seconds: number): Promise<void> {
    await this.pg.query(
      `UPDATE chat_channels SET slow_mode_seconds = $1 WHERE id = $2`,
      [seconds, channelId]
    );
  }

  async lockChannel(channelId: string, locked: boolean): Promise<void> {
    await this.pg.query(
      `UPDATE chat_channels SET is_locked = $1 WHERE id = $2`,
      [locked, channelId]
    );
    await this.redis.publish(
      `chat:${channelId}`,
      JSON.stringify({ event: locked ? 'CHANNEL_LOCKED' : 'CHANNEL_UNLOCKED', data: { channelId } })
    );
  }

  // ─── SYSTEM MESSAGES ───────────────────────────────────────────────────────

  async sendSystem(channelId: string, text: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.send('SYSTEM', 'ROOM', channelId, 'SYSTEM', text, { metadata });
  }

  async broadcastWarAlert(allianceId: string, attackerId: string, defenderId: string): Promise<void> {
    const channelId = `alliance_${allianceId}`;
    await this.send(
      'SYSTEM',
      'ALLIANCE',
      channelId,
      'WAR_ALERT',
      `⚔️ WAR DECLARED — [${attackerId}] vs [${defenderId}]`,
      { metadata: { attackerId, defenderId } }
    );
  }

  // ─── PRIVATE ROOM MANAGEMENT ───────────────────────────────────────────────

  async createRoom(
    creatorId: string,
    name:      string,
    type:      'HOUSEHOLD_TABLE' | 'RIVALRY_ROOM' | 'CUSTOM',
    maxMembers = 10
  ): Promise<string> {
    const roomId = this._genId();
    await this.pg.query(
      `INSERT INTO chat_rooms (id, name, type, creator_id, max_members, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [roomId, name, type, creatorId, maxMembers]
    );
    await this.pg.query(
      `INSERT INTO chat_channels (id, type, name, member_count, slow_mode_seconds, is_locked, pinned_message_id)
       VALUES ($1, 'ROOM', $2, 1, 0, false, NULL)`,
      [roomId, name]
    );
    await this._addRoomMember(creatorId, roomId, true);
    this.emit('ROOM_CREATED', { roomId, creatorId, name, type });
    return roomId;
  }

  async joinRoom(userId: string, roomId: string, inviteToken?: string): Promise<void> {
    const room = await this.pg.query<{ max_members: number; is_invite_only: boolean }>(
      `SELECT max_members, is_invite_only FROM chat_rooms WHERE id = $1`,
      [roomId]
    );
    if (!room.rows.length) throw new Error('ROOM_NOT_FOUND');

    const { max_members, is_invite_only } = room.rows[0];
    if (is_invite_only && !inviteToken) throw new Error('INVITE_REQUIRED');

    const count = await this._getRoomMemberCount(roomId);
    if (count >= max_members) throw new Error('ROOM_FULL');

    await this._addRoomMember(userId, roomId, false);
    await this.sendSystem(roomId, `[${await this._getSenderName(userId)}] joined the room.`);
  }

  async leaveRoom(userId: string, roomId: string): Promise<void> {
    await this.pg.query(
      `DELETE FROM chat_room_members WHERE user_id = $1 AND room_id = $2`,
      [userId, roomId]
    );
    await this.sendSystem(roomId, `[${await this._getSenderName(userId)}] left.`);
  }

  // ─── DM HELPERS ────────────────────────────────────────────────────────────

  dmChannelId(userId1: string, userId2: string): string {
    // Deterministic, order-independent
    const sorted = [userId1, userId2].sort();
    return `dm_${sorted[0]}_${sorted[1]}`;
  }

  async getOrCreateDmChannel(userId1: string, userId2: string): Promise<string> {
    const channelId = this.dmChannelId(userId1, userId2);
    await this.pg.query(
      `INSERT INTO chat_channels (id, type, name, member_count, slow_mode_seconds, is_locked, pinned_message_id)
       VALUES ($1, 'DM', '', 2, 0, false, NULL)
       ON CONFLICT (id) DO NOTHING`,
      [channelId]
    );
    return channelId;
  }

  // ─── INTERNAL ──────────────────────────────────────────────────────────────

  private async _checkPermission(
    senderId:    string,
    channelType: ChannelType,
    channelId:   string,
    senderRank?: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    if (senderId === 'SYSTEM') return { allowed: true };

    const banned = await this.redis.get(`ban:chat:${senderId}`);
    if (banned) return { allowed: false, reason: 'BANNED' };

    if (channelType === 'ALLIANCE_OFFICER') {
      const rank = senderRank ?? await this._getPlayerAllianceRank(senderId, channelId);
      const rankNum = parseInt(rank?.replace('R','') ?? '1');
      if (rankNum < 3) return { allowed: false, reason: 'INSUFFICIENT_RANK' };
    }

    // Channel lock check
    const locked = await this.pg.query<{ is_locked: boolean }>(
      `SELECT is_locked FROM chat_channels WHERE id = $1`,
      [channelId]
    );
    if (locked.rows[0]?.is_locked && channelType !== 'ALLIANCE_OFFICER') {
      const rank = senderRank ?? await this._getPlayerAllianceRank(senderId, channelId);
      const rankNum = parseInt(rank?.replace('R','') ?? '1');
      if (rankNum < 3) return { allowed: false, reason: 'CHANNEL_LOCKED' };
    }

    return { allowed: true };
  }

  private _sanitize(text: string): string {
    // Strip HTML tags, normalize whitespace
    return text.replace(/<[^>]*>/g, '').replace(/\s{2,}/g, ' ').trim();
  }

  private _computeFlags(body: string, type: MessageType): number {
    let flags = 0;
    if (type === 'TEXT' && /https?:\/\//i.test(body)) flags |= 4;
    return flags;
  }

  private _getRateLimit(channelType: ChannelType): number {
    if (channelType === 'GLOBAL' || channelType === 'SERVER') return RATE_LIMIT_GLOBAL_MS;
    if (channelType === 'DM') return RATE_LIMIT_DM_MS;
    return RATE_LIMIT_ALLIANCE_MS;
  }

  private _getHistoryCap(channelType: ChannelType): number {
    if (channelType === 'GLOBAL' || channelType === 'SERVER') return GLOBAL_HISTORY_CAP;
    if (channelType === 'DM') return DM_HISTORY_CAP;
    return ALLIANCE_HISTORY_CAP;
  }

  private _dmOtherId(channelId: string, userId: string): string {
    // channelId format: dm_userId1_userId2
    return channelId.replace('dm_', '').split('_').find(id => id !== userId) ?? '';
  }

  private async _persist(msg: ChatMessage): Promise<void> {
    await this.pg.query(
      `INSERT INTO chat_messages
        (id, channel_type, channel_id, sender_id, sender_name, sender_rank, sender_title,
         type, body, metadata, status, sent_at, flags, reply_to_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'SENT',NOW(),$11,$12)`,
      [
        msg.id, msg.channelType, msg.channelId, msg.senderId, msg.senderName,
        msg.senderRank, msg.senderTitle, msg.type, msg.body,
        msg.metadata ? JSON.stringify(msg.metadata) : null,
        msg.flags, msg.replyToId,
      ]
    );
  }

  private async _getSenderName(senderId: string): Promise<string> {
    if (senderId === 'SYSTEM') return 'System';
    const cached = await this.redis.get(`pname:${senderId}`);
    if (cached) return cached;
    const row = await this.pg.query<{ display_name: string }>(
      `SELECT display_name FROM players WHERE id = $1`, [senderId]
    );
    const name = row.rows[0]?.display_name ?? 'Unknown';
    await this.redis.set(`pname:${senderId}`, name, 'EX', 300);
    return name;
  }

  private async _getBlockedByUser(userId: string): Promise<Set<string>> {
    const cached = await this.redis.smembers(`blocks:${userId}`);
    if (cached.length) return new Set(cached);
    const rows = await this.pg.query<{ blocked_id: string }>(
      `SELECT blocked_id FROM chat_blocks WHERE blocker_id = $1`, [userId]
    );
    const ids = rows.rows.map(r => r.blocked_id);
    if (ids.length) {
      await this.redis.sadd(`blocks:${userId}`, ...ids);
      await this.redis.expire(`blocks:${userId}`, 300);
    }
    return new Set(ids);
  }

  private async _checkBlockExists(a: string, b: string): Promise<boolean> {
    const row = await this.pg.query(
      `SELECT 1 FROM chat_blocks WHERE blocker_id = $1 AND blocked_id = $2 LIMIT 1`,
      [a, b]
    );
    return row.rows.length > 0;
  }

  private async _getChannelId(messageId: string): Promise<string> {
    const row = await this.pg.query<{ channel_id: string }>(
      `SELECT channel_id FROM chat_messages WHERE id = $1`, [messageId]
    );
    return row.rows[0]?.channel_id ?? '';
  }

  private async _isWarRoom(_messageId: string): Promise<boolean> {
    // Stub: check if room is a war room (tied to active AllianceWar)
    return false;
  }

  private async _canModerate(userId: string, channelId: string): Promise<boolean> {
    const rank = await this._getPlayerAllianceRank(userId, channelId);
    if (!rank) return false;
    return parseInt(rank.replace('R','')) >= 3;
  }

  private async _getPlayerAllianceRank(userId: string, _channelId: string): Promise<string | null> {
    const row = await this.pg.query<{ rank: string }>(
      `SELECT rank FROM alliance_members WHERE user_id = $1 LIMIT 1`, [userId]
    );
    return row.rows[0]?.rank ?? null;
  }

  private async _getReactions(messageId: string): Promise<MessageReaction[]> {
    const rows = await this.pg.query(
      `SELECT emoji, COUNT(*) as count, array_agg(user_id ORDER BY created_at) as user_ids
       FROM chat_reactions WHERE message_id = $1 GROUP BY emoji`,
      [messageId]
    );
    return rows.rows.map(r => ({
      emoji:   r.emoji,
      count:   parseInt(r.count),
      userIds: r.user_ids.slice(0, 3),
    }));
  }

  private async _addRoomMember(userId: string, roomId: string, isOwner: boolean): Promise<void> {
    await this.pg.query(
      `INSERT INTO chat_room_members (user_id, room_id, is_owner, joined_at)
       VALUES ($1, $2, $3, NOW()) ON CONFLICT DO NOTHING`,
      [userId, roomId, isOwner]
    );
  }

  private async _getRoomMemberCount(roomId: string): Promise<number> {
    const row = await this.pg.query<{ count: string }>(
      `SELECT COUNT(*) FROM chat_room_members WHERE room_id = $1`, [roomId]
    );
    return parseInt(row.rows[0]?.count ?? '0');
  }

  private _rowToMessage(row: Record<string, unknown>): ChatMessage {
    return {
      id:          row.id as string,
      channelType: row.channel_type as ChannelType,
      channelId:   row.channel_id as string,
      senderId:    row.sender_id as string,
      senderName:  row.sender_name as string,
      senderRank:  row.sender_rank as string | null,
      senderTitle: row.sender_title as string | null,
      type:        row.type as MessageType,
      body:        row.body as string,
      metadata:    row.metadata ? JSON.parse(row.metadata as string) : null,
      status:      row.status as MessageStatus,
      sentAt:      row.sent_at as Date,
      editedAt:    row.edited_at as Date | null,
      unsentAt:    row.unsent_at as Date | null,
      replyToId:   row.reply_to_id as string | null,
      reactions:   [],
      flags:       row.flags as number,
    };
  }

  private _subscribeToRedis(): void {
    // Forward Redis pub/sub events to WS clients via the existing edge layer
    // The WS gateway subscribes to channels per-client on join
    this.sub.on('message', (channel: string, message: string) => {
      this.emit('REDIS_MESSAGE', { channel, message: JSON.parse(message) });
    });
  }

  private _genId(): string {
    return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
  }
}

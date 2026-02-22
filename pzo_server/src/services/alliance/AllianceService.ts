/**
 * ============================================================================
 * FILE: pzo_server/src/services/alliance/AllianceService.ts
 * Point Zero One — Alliance Sovereignty Engine
 * 
 * Ranks: R1 (Recruit) → R2 (Soldier) → R3 (Officer) → R4 (Commander) → R5 (Sovereign)
 * Features: Create, Join, Leave, Kick, Promote, Demote, Transfer Leadership,
 *           Alliance Aid, Vault, War Declaration, Tag/Banner, Leaderboards
 * 
 * Deploy to: pzo_server/src/services/alliance/
 * ============================================================================
 */

import { Redis } from 'ioredis';
import { Pool }  from 'pg';
import { EventEmitter } from 'events';

// ─── TYPES ────────────────────────────────────────────────────────────────────

export type AllianceRank = 'R1' | 'R2' | 'R3' | 'R4' | 'R5';

export const RANK_NUM: Record<AllianceRank, number> = {
  R1: 1, R2: 2, R3: 3, R4: 4, R5: 5
};

export const RANK_LABELS: Record<AllianceRank, string> = {
  R1: 'Recruit',
  R2: 'Soldier',
  R3: 'Officer',
  R4: 'Commander',
  R5: 'Sovereign',
};

// Permission: can actor perform action on target?
export const PERMISSIONS = {
  DISBAND:             (r: AllianceRank) => r === 'R5',
  RENAME:              (r: AllianceRank) => r === 'R5',
  DECLARE_WAR:         (r: AllianceRank) => r === 'R5',
  SET_TAX:             (r: AllianceRank) => r === 'R5',
  TRANSFER_LEADERSHIP: (r: AllianceRank) => r === 'R5',
  SET_SETTINGS:        (r: AllianceRank) => r === 'R5',
  ACCESS_VAULT:        (r: AllianceRank) => r === 'R5' || r === 'R4',
  MANAGE_SHOP:         (r: AllianceRank) => r === 'R5' || r === 'R4',
  ACCEPT_MEMBERS:      (r: AllianceRank) => RANK_NUM[r] >= 4,
  KICK_MEMBER:         (r: AllianceRank, targetRank: AllianceRank) =>
                         RANK_NUM[r] > RANK_NUM[targetRank] && RANK_NUM[r] >= 4,
  PROMOTE:             (r: AllianceRank, targetRank: AllianceRank) =>
                         RANK_NUM[r] > RANK_NUM[targetRank] + 1,
  DEMOTE:              (r: AllianceRank, targetRank: AllianceRank) =>
                         RANK_NUM[r] > RANK_NUM[targetRank] && RANK_NUM[r] >= 4,
  MODERATE_CHAT:       (r: AllianceRank) => RANK_NUM[r] >= 3,
  PIN_MESSAGES:        (r: AllianceRank) => RANK_NUM[r] >= 3,
  APPROVE_AID:         (r: AllianceRank) => RANK_NUM[r] >= 3,
  MANAGE_EVENTS:       (r: AllianceRank) => RANK_NUM[r] >= 3,
  SEND_AID:            (r: AllianceRank) => RANK_NUM[r] >= 2,
  VOTE:                (r: AllianceRank) => RANK_NUM[r] >= 2,
  USE_BOOSTS:          (r: AllianceRank) => RANK_NUM[r] >= 2,
  PARTICIPATE_WAR:     (r: AllianceRank) => RANK_NUM[r] >= 2,
  CHAT:                (_r: AllianceRank) => true,
  VIEW_ROSTER:         (_r: AllianceRank) => true,
  RECEIVE_AID:         (_r: AllianceRank) => true,
};

export interface Alliance {
  id:           string;
  tag:          string;
  name:         string;
  description:  string;
  level:        number;
  xp:           number;
  capacity:     number;
  memberCount:  number;
  vault:        number;
  isOpen:       boolean;
  requirementMinLevel: number;
  language:     string;
  createdAt:    Date;
  r5Id:         string;
  activeWarId:  string | null;
  banner: {
    colorPrimary:   string;
    colorSecondary: string;
    iconId:         string;
  };
}

export interface AllianceMember {
  userId:          string;
  allianceId:      string;
  rank:            AllianceRank;
  displayName:     string;
  joinedAt:        Date;
  lastActive:      Date;
  warPoints:       number;
  totalContributed: number;
  isOnline:        boolean;
}

export interface AllianceApplication {
  id:          string;
  allianceId:  string;
  userId:      string;
  message:     string;
  appliedAt:   Date;
  status:      'PENDING' | 'ACCEPTED' | 'REJECTED';
}

export interface AidRequest {
  id:          string;
  allianceId:  string;
  requesterId: string;
  type:        'COINS' | 'BOOST' | 'SHIELD';
  amount:      number;
  fulfilled:   number;
  target:      number;
  createdAt:   Date;
  expiresAt:   Date;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const MAX_TAG_LENGTH   = 6;
const MAX_NAME_LENGTH  = 50;
const MAX_DESC_LENGTH  = 300;
const JOIN_COOLDOWN_H  = 24;
const MAX_APPLICATIONS_PENDING = 50;
const AID_EXPIRE_H     = 8;
const VAULT_CONTRIBUTE_DAILY_CAP = 100_000;

// ─── ALLIANCE SERVICE ─────────────────────────────────────────────────────────

export class AllianceService extends EventEmitter {
  constructor(
    private redis: Redis,
    private pg:    Pool
  ) { super(); }

  // ─── CREATE ────────────────────────────────────────────────────────────────

  async create(
    founderId: string,
    opts: {
      tag:          string;
      name:         string;
      description:  string;
      isOpen:       boolean;
      language?:    string;
      bannerIconId?: string;
    }
  ): Promise<Alliance> {
    // Validate tag
    const tag = opts.tag.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (tag.length < 2 || tag.length > MAX_TAG_LENGTH) throw new Error('INVALID_TAG');
    if (opts.name.length > MAX_NAME_LENGTH) throw new Error('NAME_TOO_LONG');
    if (opts.description.length > MAX_DESC_LENGTH) throw new Error('DESC_TOO_LONG');

    // Unique tag check
    const exists = await this.pg.query(`SELECT id FROM alliances WHERE tag = $1`, [tag]);
    if (exists.rows.length) throw new Error('TAG_TAKEN');

    // Founder must not be in an alliance
    const inAlliance = await this._getMembership(founderId);
    if (inAlliance) throw new Error('ALREADY_IN_ALLIANCE');

    const id = this._genId();
    const now = new Date();

    await this.pg.query(
      `INSERT INTO alliances
        (id, tag, name, description, level, xp, capacity, member_count, vault,
         is_open, requirement_min_level, language, created_at, r5_id,
         banner_color_primary, banner_color_secondary, banner_icon_id)
       VALUES ($1,$2,$3,$4,1,0,25,1,0,$5,0,$6,$7,$8,'#FFD700','#1A1A2E',$9)`,
      [id, tag, opts.name, opts.description, opts.isOpen,
       opts.language ?? 'en', now, founderId, opts.bannerIconId ?? 'icon_star']
    );

    await this.pg.query(
      `INSERT INTO alliance_members
        (user_id, alliance_id, rank, joined_at, last_active, war_points, total_contributed)
       VALUES ($1,$2,'R5',NOW(),NOW(),0,0)`,
      [founderId, id]
    );

    this.emit('ALLIANCE_CREATED', { allianceId: id, founderId });
    return this._getById(id);
  }

  // ─── JOIN / APPLY ──────────────────────────────────────────────────────────

  async join(userId: string, allianceId: string): Promise<void> {
    const alliance = await this._getById(allianceId);

    // Cooldown check
    await this._checkJoinCooldown(userId);

    // Already in alliance?
    const membership = await this._getMembership(userId);
    if (membership) throw new Error('ALREADY_IN_ALLIANCE');

    // Capacity check
    if (alliance.memberCount >= alliance.capacity) throw new Error('ALLIANCE_FULL');

    if (!alliance.isOpen) throw new Error('INVITE_ONLY_USE_APPLY');

    await this._addMember(userId, allianceId, 'R1');
    this.emit('PLAYER_JOINED_ALLIANCE', { userId, allianceId, rank: 'R1' });
  }

  async apply(userId: string, allianceId: string, message: string): Promise<AllianceApplication> {
    const membership = await this._getMembership(userId);
    if (membership) throw new Error('ALREADY_IN_ALLIANCE');

    await this._checkJoinCooldown(userId);

    // Pending application limit
    const pending = await this.pg.query(
      `SELECT COUNT(*) FROM alliance_applications WHERE alliance_id = $1 AND status = 'PENDING'`,
      [allianceId]
    );
    if (parseInt(pending.rows[0].count) >= MAX_APPLICATIONS_PENDING) {
      throw new Error('APPLICATION_QUEUE_FULL');
    }

    const id = this._genId();
    await this.pg.query(
      `INSERT INTO alliance_applications (id, alliance_id, user_id, message, applied_at, status)
       VALUES ($1,$2,$3,$4,NOW(),'PENDING')`,
      [id, allianceId, userId, message.slice(0, 200)]
    );

    this.emit('ALLIANCE_APPLICATION_SUBMITTED', { id, allianceId, userId });
    return { id, allianceId, userId, message, appliedAt: new Date(), status: 'PENDING' };
  }

  async acceptApplication(
    moderatorId: string,
    applicationId: string
  ): Promise<void> {
    const app = await this._getApplication(applicationId);
    const modRank = await this._getMemberRank(moderatorId, app.allianceId);
    if (!modRank || !PERMISSIONS.ACCEPT_MEMBERS(modRank)) throw new Error('INSUFFICIENT_RANK');

    await this.pg.query(
      `UPDATE alliance_applications SET status = 'ACCEPTED' WHERE id = $1`,
      [applicationId]
    );

    const alliance = await this._getById(app.allianceId);
    if (alliance.memberCount >= alliance.capacity) throw new Error('ALLIANCE_FULL');

    await this._addMember(app.userId, app.allianceId, 'R1');
    this.emit('PLAYER_JOINED_ALLIANCE', { userId: app.userId, allianceId: app.allianceId, rank: 'R1' });
  }

  // ─── LEAVE / KICK ──────────────────────────────────────────────────────────

  async leave(userId: string): Promise<void> {
    const membership = await this._getMembership(userId);
    if (!membership) throw new Error('NOT_IN_ALLIANCE');

    if (membership.rank === 'R5') {
      const memberCount = await this._getMemberCount(membership.allianceId);
      if (memberCount > 1) throw new Error('R5_MUST_TRANSFER_FIRST');
      // Last member — auto-disband
      await this.disband(userId, membership.allianceId);
      return;
    }

    await this._removeMember(userId, membership.allianceId);
    await this._setJoinCooldown(userId);
    this.emit('PLAYER_LEFT_ALLIANCE', { userId, allianceId: membership.allianceId, wasKicked: false });
  }

  async kick(
    actorId: string,
    targetId: string,
    allianceId: string,
    reason?: string
  ): Promise<void> {
    const actorRank  = await this._getMemberRank(actorId, allianceId);
    const targetRank = await this._getMemberRank(targetId, allianceId);
    if (!actorRank || !targetRank) throw new Error('NOT_IN_ALLIANCE');
    if (!PERMISSIONS.KICK_MEMBER(actorRank, targetRank)) throw new Error('INSUFFICIENT_RANK');

    await this._removeMember(targetId, allianceId);
    await this._setJoinCooldown(targetId);

    // Log kick
    await this.pg.query(
      `INSERT INTO alliance_audit_log (alliance_id, actor_id, target_id, action, reason, created_at)
       VALUES ($1,$2,$3,'KICK',$4,NOW())`,
      [allianceId, actorId, targetId, reason ?? null]
    );

    this.emit('PLAYER_LEFT_ALLIANCE', { userId: targetId, allianceId, wasKicked: true, kickedBy: actorId });
  }

  // ─── RANK MANAGEMENT ───────────────────────────────────────────────────────

  async promote(actorId: string, targetId: string, allianceId: string): Promise<AllianceRank> {
    const actorRank  = await this._getMemberRank(actorId, allianceId);
    const targetRank = await this._getMemberRank(targetId, allianceId);
    if (!actorRank || !targetRank) throw new Error('NOT_IN_ALLIANCE');
    if (!PERMISSIONS.PROMOTE(actorRank, targetRank)) throw new Error('INSUFFICIENT_RANK');
    if (RANK_NUM[targetRank] >= 4) throw new Error('CANNOT_PROMOTE_TO_R5_USE_TRANSFER');

    const newRank = `R${RANK_NUM[targetRank] + 1}` as AllianceRank;
    await this.pg.query(
      `UPDATE alliance_members SET rank = $1 WHERE user_id = $2 AND alliance_id = $3`,
      [newRank, targetId, allianceId]
    );

    await this._auditLog(allianceId, actorId, targetId, 'PROMOTE', `${targetRank} → ${newRank}`);
    this.emit('RANK_PROMOTED', { userId: targetId, allianceId, from: targetRank, to: newRank });
    return newRank;
  }

  async demote(actorId: string, targetId: string, allianceId: string): Promise<AllianceRank> {
    const actorRank  = await this._getMemberRank(actorId, allianceId);
    const targetRank = await this._getMemberRank(targetId, allianceId);
    if (!actorRank || !targetRank) throw new Error('NOT_IN_ALLIANCE');
    if (!PERMISSIONS.DEMOTE(actorRank, targetRank)) throw new Error('INSUFFICIENT_RANK');
    if (RANK_NUM[targetRank] <= 1) throw new Error('ALREADY_LOWEST_RANK');

    const newRank = `R${RANK_NUM[targetRank] - 1}` as AllianceRank;
    await this.pg.query(
      `UPDATE alliance_members SET rank = $1 WHERE user_id = $2 AND alliance_id = $3`,
      [newRank, targetId, allianceId]
    );

    await this._auditLog(allianceId, actorId, targetId, 'DEMOTE', `${targetRank} → ${newRank}`);
    this.emit('RANK_DEMOTED', { userId: targetId, allianceId, from: targetRank, to: newRank });
    return newRank;
  }

  async transferLeadership(currentR5Id: string, newR5Id: string, allianceId: string): Promise<void> {
    const myRank = await this._getMemberRank(currentR5Id, allianceId);
    if (myRank !== 'R5') throw new Error('ONLY_R5_CAN_TRANSFER');

    const targetRank = await this._getMemberRank(newR5Id, allianceId);
    if (!targetRank) throw new Error('TARGET_NOT_IN_ALLIANCE');

    await this.pg.query(`
      UPDATE alliance_members SET rank = CASE
        WHEN user_id = $1 THEN 'R4'
        WHEN user_id = $2 THEN 'R5'
      END
      WHERE alliance_id = $3 AND user_id IN ($1, $2)
    `, [currentR5Id, newR5Id, allianceId]);

    await this.pg.query(`UPDATE alliances SET r5_id = $1 WHERE id = $2`, [newR5Id, allianceId]);
    await this._auditLog(allianceId, currentR5Id, newR5Id, 'TRANSFER_LEADERSHIP', null);
    this.emit('RANK_PROMOTED', { userId: newR5Id, allianceId, from: targetRank, to: 'R5' });
  }

  // ─── ALLIANCE SETTINGS ─────────────────────────────────────────────────────

  async updateSettings(
    actorId: string,
    allianceId: string,
    settings: Partial<{
      name:        string;
      description: string;
      isOpen:      boolean;
      requirementMinLevel: number;
      language:    string;
      banner: { colorPrimary: string; colorSecondary: string; iconId: string };
    }>
  ): Promise<void> {
    const rank = await this._getMemberRank(actorId, allianceId);
    if (!rank || !PERMISSIONS.SET_SETTINGS(rank)) throw new Error('INSUFFICIENT_RANK');

    const updates: string[] = [];
    const params: unknown[] = [allianceId];
    let i = 2;

    if (settings.name)        { updates.push(`name = $${i++}`);        params.push(settings.name.slice(0, MAX_NAME_LENGTH)); }
    if (settings.description) { updates.push(`description = $${i++}`); params.push(settings.description.slice(0, MAX_DESC_LENGTH)); }
    if (settings.isOpen !== undefined) { updates.push(`is_open = $${i++}`); params.push(settings.isOpen); }
    if (settings.requirementMinLevel !== undefined) { updates.push(`requirement_min_level = $${i++}`); params.push(settings.requirementMinLevel); }
    if (settings.language)    { updates.push(`language = $${i++}`);    params.push(settings.language); }
    if (settings.banner?.colorPrimary)   { updates.push(`banner_color_primary = $${i++}`);   params.push(settings.banner.colorPrimary); }
    if (settings.banner?.colorSecondary) { updates.push(`banner_color_secondary = $${i++}`); params.push(settings.banner.colorSecondary); }
    if (settings.banner?.iconId)         { updates.push(`banner_icon_id = $${i++}`);         params.push(settings.banner.iconId); }

    if (!updates.length) return;
    await this.pg.query(`UPDATE alliances SET ${updates.join(', ')} WHERE id = $1`, params);
  }

  // ─── VAULT & AID ───────────────────────────────────────────────────────────

  async contributeToVault(userId: string, allianceId: string, amount: number): Promise<void> {
    const rank = await this._getMemberRank(userId, allianceId);
    if (!rank) throw new Error('NOT_IN_ALLIANCE');
    if (amount <= 0) throw new Error('INVALID_AMOUNT');

    // Daily cap per player
    const todayKey = `vault:contrib:${userId}:${allianceId}:${new Date().toDateString()}`;
    const contributed = parseInt(await this.redis.get(todayKey) ?? '0');
    if (contributed + amount > VAULT_CONTRIBUTE_DAILY_CAP) throw new Error('DAILY_CAP_EXCEEDED');

    // Deduct from player, add to vault (atomic)
    await this.pg.query('BEGIN');
    try {
      await this.pg.query(
        `UPDATE players SET coins = coins - $1 WHERE id = $2 AND coins >= $1`,
        [amount, userId]
      );
      await this.pg.query(
        `UPDATE alliances SET vault = vault + $1 WHERE id = $2`,
        [amount, allianceId]
      );
      await this.pg.query(
        `UPDATE alliance_members SET total_contributed = total_contributed + $1
         WHERE user_id = $2 AND alliance_id = $3`,
        [amount, userId, allianceId]
      );
      await this.pg.query('COMMIT');
    } catch (e) {
      await this.pg.query('ROLLBACK');
      throw e;
    }

    await this.redis.incrby(todayKey, amount);
    await this.redis.expire(todayKey, 86400);
  }

  async requestAid(userId: string, allianceId: string, type: AidRequest['type'], amount: number): Promise<AidRequest> {
    const rank = await this._getMemberRank(userId, allianceId);
    if (!rank) throw new Error('NOT_IN_ALLIANCE');

    const id = this._genId();
    const expiresAt = new Date(Date.now() + AID_EXPIRE_H * 3_600_000);
    await this.pg.query(
      `INSERT INTO alliance_aid_requests (id, alliance_id, requester_id, type, amount, fulfilled, target, created_at, expires_at)
       VALUES ($1,$2,$3,$4,$5,0,$5,NOW(),$6)`,
      [id, allianceId, userId, type, amount, expiresAt]
    );

    this.emit('AID_REQUESTED', { id, allianceId, userId, type, amount });
    return { id, allianceId, requesterId: userId, type, amount, fulfilled: 0, target: amount, createdAt: new Date(), expiresAt };
  }

  // ─── DISBAND ───────────────────────────────────────────────────────────────

  async disband(actorId: string, allianceId: string): Promise<void> {
    const rank = await this._getMemberRank(actorId, allianceId);
    if (!PERMISSIONS.DISBAND(rank!)) throw new Error('ONLY_R5_CAN_DISBAND');

    await this.pg.query(`DELETE FROM alliance_members WHERE alliance_id = $1`, [allianceId]);
    await this.pg.query(`DELETE FROM alliances WHERE id = $1`, [allianceId]);
    this.emit('ALLIANCE_DISBANDED', { allianceId, disbandedBy: actorId });
  }

  // ─── SEARCH ────────────────────────────────────────────────────────────────

  async search(query: string, limit = 20): Promise<Alliance[]> {
    const rows = await this.pg.query(
      `SELECT * FROM alliances
       WHERE (name ILIKE $1 OR tag ILIKE $1) AND is_open = true
       ORDER BY member_count DESC LIMIT $2`,
      [`%${query}%`, limit]
    );
    return rows.rows.map(this._rowToAlliance);
  }

  async getRoster(allianceId: string): Promise<AllianceMember[]> {
    const rows = await this.pg.query(
      `SELECT am.*, p.display_name, p.last_active_at,
              EXISTS(SELECT 1 FROM player_sessions ps WHERE ps.player_id = am.user_id AND ps.expires_at > NOW()) as is_online
       FROM alliance_members am
       JOIN players p ON p.id = am.user_id
       WHERE am.alliance_id = $1
       ORDER BY
         CASE am.rank WHEN 'R5' THEN 5 WHEN 'R4' THEN 4 WHEN 'R3' THEN 3 WHEN 'R2' THEN 2 ELSE 1 END DESC,
         am.war_points DESC`,
      [allianceId]
    );
    return rows.rows.map(r => ({
      userId:          r.user_id,
      allianceId:      r.alliance_id,
      rank:            r.rank as AllianceRank,
      displayName:     r.display_name,
      joinedAt:        r.joined_at,
      lastActive:      r.last_active_at,
      warPoints:       r.war_points,
      totalContributed: r.total_contributed,
      isOnline:        r.is_online,
    }));
  }

  async getLeaderboard(limit = 50): Promise<Array<{ alliance: Alliance; totalWarPoints: number }>> {
    const rows = await this.pg.query(
      `SELECT a.*, COALESCE(SUM(am.war_points), 0) as total_war_points
       FROM alliances a
       LEFT JOIN alliance_members am ON am.alliance_id = a.id
       GROUP BY a.id
       ORDER BY total_war_points DESC LIMIT $1`,
      [limit]
    );
    return rows.rows.map(r => ({
      alliance: this._rowToAlliance(r),
      totalWarPoints: parseInt(r.total_war_points),
    }));
  }

  // ─── INTERNALS ─────────────────────────────────────────────────────────────

  private async _getById(id: string): Promise<Alliance> {
    const row = await this.pg.query(`SELECT * FROM alliances WHERE id = $1`, [id]);
    if (!row.rows.length) throw new Error('ALLIANCE_NOT_FOUND');
    return this._rowToAlliance(row.rows[0]);
  }

  private async _getMembership(userId: string): Promise<{ allianceId: string; rank: AllianceRank } | null> {
    const row = await this.pg.query<{ alliance_id: string; rank: AllianceRank }>(
      `SELECT alliance_id, rank FROM alliance_members WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    if (!row.rows.length) return null;
    return { allianceId: row.rows[0].alliance_id, rank: row.rows[0].rank };
  }

  private async _getMemberRank(userId: string, allianceId: string): Promise<AllianceRank | null> {
    const row = await this.pg.query<{ rank: AllianceRank }>(
      `SELECT rank FROM alliance_members WHERE user_id = $1 AND alliance_id = $2`,
      [userId, allianceId]
    );
    return row.rows[0]?.rank ?? null;
  }

  private async _getMemberCount(allianceId: string): Promise<number> {
    const row = await this.pg.query<{ count: string }>(
      `SELECT COUNT(*) FROM alliance_members WHERE alliance_id = $1`,
      [allianceId]
    );
    return parseInt(row.rows[0]?.count ?? '0');
  }

  private async _addMember(userId: string, allianceId: string, rank: AllianceRank): Promise<void> {
    await this.pg.query(
      `INSERT INTO alliance_members (user_id, alliance_id, rank, joined_at, last_active, war_points, total_contributed)
       VALUES ($1,$2,$3,NOW(),NOW(),0,0)`,
      [userId, allianceId, rank]
    );
    await this.pg.query(
      `UPDATE alliances SET member_count = member_count + 1 WHERE id = $1`,
      [allianceId]
    );
  }

  private async _removeMember(userId: string, allianceId: string): Promise<void> {
    await this.pg.query(
      `DELETE FROM alliance_members WHERE user_id = $1 AND alliance_id = $2`,
      [userId, allianceId]
    );
    await this.pg.query(
      `UPDATE alliances SET member_count = GREATEST(0, member_count - 1) WHERE id = $1`,
      [allianceId]
    );
  }

  private async _checkJoinCooldown(userId: string): Promise<void> {
    const cooldown = await this.redis.get(`alliance:join:cooldown:${userId}`);
    if (cooldown) throw new Error(`JOIN_COOLDOWN_ACTIVE`);
  }

  private async _setJoinCooldown(userId: string): Promise<void> {
    await this.redis.set(
      `alliance:join:cooldown:${userId}`, '1',
      'EX', JOIN_COOLDOWN_H * 3_600
    );
  }

  private async _getApplication(id: string): Promise<AllianceApplication> {
    const row = await this.pg.query(`SELECT * FROM alliance_applications WHERE id = $1`, [id]);
    if (!row.rows.length) throw new Error('APPLICATION_NOT_FOUND');
    const r = row.rows[0];
    return { id: r.id, allianceId: r.alliance_id, userId: r.user_id, message: r.message, appliedAt: r.applied_at, status: r.status };
  }

  private async _auditLog(
    allianceId: string, actorId: string, targetId: string | null,
    action: string, reason: string | null
  ): Promise<void> {
    await this.pg.query(
      `INSERT INTO alliance_audit_log (alliance_id, actor_id, target_id, action, reason, created_at)
       VALUES ($1,$2,$3,$4,$5,NOW())`,
      [allianceId, actorId, targetId, action, reason]
    );
  }

  private _rowToAlliance(r: Record<string, unknown>): Alliance {
    return {
      id: r.id as string, tag: r.tag as string, name: r.name as string,
      description: r.description as string, level: r.level as number,
      xp: r.xp as number, capacity: r.capacity as number,
      memberCount: r.member_count as number, vault: r.vault as number,
      isOpen: r.is_open as boolean,
      requirementMinLevel: r.requirement_min_level as number,
      language: r.language as string, createdAt: r.created_at as Date,
      r5Id: r.r5_id as string, activeWarId: r.active_war_id as string | null,
      banner: {
        colorPrimary:   r.banner_color_primary as string,
        colorSecondary: r.banner_color_secondary as string,
        iconId:         r.banner_icon_id as string,
      },
    };
  }

  private _genId(): string {
    return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
  }
}

/**
 * ============================================================================
 * FILE: pzo_server/src/services/alliance/AllianceWarService.ts
 * Point Zero One — Alliance War Phase State Machine
 * 
 * War Phases:
 *   DECLARED → PREPARATION (2h) → ACTIVE (24h) → SETTLEMENT (1h) → ENDED
 * 
 * Points Engine:
 *   - Run completed during war     = base points (varies by run quality)
 *   - War boost active             = 2× multiplier
 *   - OPPORTUNITY_FLIP event       = +50 bonus points
 *   - FUBAR_SURVIVED event         = +25 bonus points
 *   - Ghost Run win vs rival       = +100 bonus points
 * 
 * Plunder: winner takes 5% of loser's vault (capped at 250,000 coins)
 * 
 * Deploy to: pzo_server/src/services/alliance/AllianceWarService.ts
 * ============================================================================
 */

import { Redis }   from 'ioredis';
import { Pool }    from 'pg';
import { EventEmitter } from 'events';
import crypto from 'crypto';
import type { AllianceWar, WarStatus, WarOutcome } from '../../../shared/contracts/multiplayer';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const DECLARATION_NOTICE_H  = 2;       // hours before war starts after declaration
const PREPARATION_PHASE_H   = 2;       // preparation window
const ACTIVE_PHASE_H        = 24;      // war window
const SETTLEMENT_PHASE_H    = 1;       // post-war cooldown
const WAR_SHIELD_H          = 24;      // cannot be declared upon after war ends
const PLUNDER_PCT            = 0.05;   // 5% of loser's vault
const PLUNDER_CAP            = 250_000;

const BASE_POINTS_PER_RUN   = 100;
const WAR_BOOST_MULTIPLIER  = 2.0;
const BONUS_OPPORTUNITY_FLIP = 50;
const BONUS_FUBAR_SURVIVED  = 25;
const BONUS_GHOST_WIN       = 100;

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface WarRecord {
  id:              string;
  attackerId:      string;
  attackerTag:     string;
  attackerName:    string;
  defenderId:      string;
  defenderTag:     string;
  defenderName:    string;
  status:          WarStatus;
  declaredAt:      Date;
  startsAt:        Date;
  endsAt:          Date;
  attackerPoints:  number;
  defenderPoints:  number;
  outcome:         WarOutcome | null;
  proofHash:       string | null;
  warRoomId:       string | null;
}

export interface WarPointEvent {
  warId:       string;
  allianceId:  string;
  playerId:    string;
  eventType:   'RUN_COMPLETED' | 'OPPORTUNITY_FLIP' | 'FUBAR_SURVIVED' | 'GHOST_WIN' | 'BOOST_MULTIPLIED';
  basePoints:  number;
  multiplier:  number;
  finalPoints: number;
  runId?:      string;
  timestamp:   Date;
}

// ─── WAR SERVICE ─────────────────────────────────────────────────────────────

export class AllianceWarService extends EventEmitter {
  private phaseTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private redis: Redis,
    private pg:    Pool,
  ) {
    super();
    this._resumeActiveWars();
  }

  // ─── DECLARE WAR ──────────────────────────────────────────────────────────

  async declare(
    actorId:          string,
    attackerAllianceId: string,
    defenderAllianceId: string,
  ): Promise<WarRecord> {
    if (attackerAllianceId === defenderAllianceId) throw new Error('CANNOT_DECLARE_WAR_ON_SELF');

    // Check attacker has no active war
    const attackerActive = await this._getActiveWar(attackerAllianceId);
    if (attackerActive) throw new Error('ATTACKER_ALREADY_IN_WAR');

    // Check defender has no active war
    const defenderActive = await this._getActiveWar(defenderAllianceId);
    if (defenderActive) throw new Error('DEFENDER_ALREADY_IN_WAR');

    // Check defender war shield
    const shielded = await this.redis.get(`war:shield:${defenderAllianceId}`);
    if (shielded) throw new Error('DEFENDER_IS_SHIELDED');

    // Get alliance info
    const [attacker, defender] = await Promise.all([
      this._getAllianceInfo(attackerAllianceId),
      this._getAllianceInfo(defenderAllianceId),
    ]);

    const now        = new Date();
    const startsAt   = new Date(now.getTime() + PREPARATION_PHASE_H * 3_600_000);
    const endsAt     = new Date(startsAt.getTime() + ACTIVE_PHASE_H * 3_600_000);
    const id         = this._genId();

    await this.pg.query('BEGIN');
    try {
      await this.pg.query(
        `INSERT INTO alliance_wars
          (id, attacker_id, defender_id, status, declared_at, starts_at, ends_at,
           attacker_points, defender_points)
         VALUES ($1,$2,$3,'DECLARED',NOW(),$4,$5,0,0)`,
        [id, attackerAllianceId, defenderAllianceId, startsAt, endsAt]
      );

      // Mark both alliances as in-war
      await this.pg.query(
        `UPDATE alliances SET active_war_id = $1 WHERE id IN ($2,$3)`,
        [id, attackerAllianceId, defenderAllianceId]
      );

      // Create war room (chat)
      const warRoomId = await this._createWarRoom(id, attacker.name, defender.name);
      await this.pg.query(
        `UPDATE alliance_wars SET war_room_id = $1 WHERE id = $2`,
        [warRoomId, id]
      );

      await this.pg.query('COMMIT');
    } catch (e) {
      await this.pg.query('ROLLBACK');
      throw e;
    }

    // Schedule phase transitions
    this._schedulePhase(id, 'PREPARATION', PREPARATION_PHASE_H * 3_600_000);

    // Broadcast war declared event
    await this.redis.publish('multiplayer:events', JSON.stringify({
      type:       'ALLIANCE_WAR_DECLARED',
      warId:      id,
      attackerId: attackerAllianceId,
      defenderId: defenderAllianceId,
    }));

    this.emit('ALLIANCE_WAR_DECLARED', { warId: id, attackerId: attackerAllianceId, defenderId: defenderAllianceId });

    return this._buildRecord({ id, attackerAllianceId, defenderAllianceId, attacker, defender, startsAt, endsAt });
  }

  // ─── PHASE TRANSITIONS ────────────────────────────────────────────────────

  async advancePhase(warId: string): Promise<void> {
    const war = await this._getWarById(warId);
    if (!war) throw new Error('WAR_NOT_FOUND');

    const transitions: Record<WarStatus, WarStatus | null> = {
      DECLARED:    'PREPARATION',
      PREPARATION: 'ACTIVE',
      ACTIVE:      'SETTLEMENT',
      SETTLEMENT:  'ENDED',
      ENDED:       null,
    };

    const nextPhase = transitions[war.status];
    if (!nextPhase) return;

    await this.pg.query(
      `UPDATE alliance_wars SET status = $1 WHERE id = $2`,
      [nextPhase, warId]
    );

    this.emit('ALLIANCE_WAR_PHASE_CHANGED', { warId, newPhase: nextPhase });
    await this.redis.publish('multiplayer:events', JSON.stringify({
      type: 'ALLIANCE_WAR_PHASE_CHANGED', warId, newPhase: nextPhase,
    }));

    switch (nextPhase) {
      case 'ACTIVE':
        // War begins: notify both alliances
        await this._broadcastToAlliance(war.attacker_id, 'WAR_ALERT', `⚔️ WAR IS LIVE — Your alliance is now at war!`);
        await this._broadcastToAlliance(war.defender_id, 'WAR_ALERT', `⚔️ WAR IS LIVE — Your alliance is now at war!`);
        this._schedulePhase(warId, 'SETTLEMENT', ACTIVE_PHASE_H * 3_600_000);
        // 1-hour warning
        this._scheduleReminder(warId, ACTIVE_PHASE_H * 3_600_000 - 3_600_000);
        break;

      case 'SETTLEMENT':
        this._schedulePhase(warId, 'ENDED', SETTLEMENT_PHASE_H * 3_600_000);
        break;

      case 'ENDED':
        await this._settleWar(warId);
        break;
    }
  }

  // ─── POINTS ENGINE ────────────────────────────────────────────────────────

  async recordWarPoints(event: {
    warId:      string;
    allianceId: string;
    playerId:   string;
    eventType:  WarPointEvent['eventType'];
    runId?:     string;
  }): Promise<number> {
    const war = await this._getWarById(event.warId);
    if (!war || war.status !== 'ACTIVE') return 0;

    // Determine which side
    const isAttacker = war.attacker_id === event.allianceId;

    // Base points
    let basePoints = 0;
    switch (event.eventType) {
      case 'RUN_COMPLETED':    basePoints = BASE_POINTS_PER_RUN; break;
      case 'OPPORTUNITY_FLIP': basePoints = BONUS_OPPORTUNITY_FLIP; break;
      case 'FUBAR_SURVIVED':   basePoints = BONUS_FUBAR_SURVIVED; break;
      case 'GHOST_WIN':        basePoints = BONUS_GHOST_WIN; break;
      default: basePoints = 0;
    }

    // Check if player has active war boost
    const boosted     = await this.redis.get(`war:boost:${event.playerId}:${event.warId}`);
    const multiplier  = boosted ? WAR_BOOST_MULTIPLIER : 1.0;
    const finalPoints = Math.floor(basePoints * multiplier);

    if (finalPoints === 0) return 0;

    // Atomic update
    const col = isAttacker ? 'attacker_points' : 'defender_points';
    await this.pg.query(
      `UPDATE alliance_wars SET ${col} = ${col} + $1 WHERE id = $2`,
      [finalPoints, event.warId]
    );

    // Track member war points
    await this.pg.query(
      `UPDATE alliance_members SET war_points = war_points + $1
       WHERE user_id = $2 AND alliance_id = $3`,
      [finalPoints, event.playerId, event.allianceId]
    );

    // Log event
    await this.pg.query(
      `INSERT INTO war_point_events (war_id, alliance_id, player_id, event_type, base_points, multiplier, final_points, run_id, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
       ON CONFLICT DO NOTHING`,
      [event.warId, event.allianceId, event.playerId, event.eventType, basePoints, multiplier, finalPoints, event.runId ?? null]
    );

    // Broadcast updated score to war watchers
    await this.redis.publish(`war:${event.warId}:scores`, JSON.stringify({
      type: 'SCORE_UPDATE',
      data: { warId: event.warId, allianceId: event.allianceId, delta: finalPoints },
    }));

    return finalPoints;
  }

  async activateWarBoost(
    playerId:  string,
    allianceId: string,
    warId:     string,
    boostId:   string,
  ): Promise<void> {
    const BOOST_DURATIONS: Record<string, number> = {
      boost_1h: 3_600, boost_4h: 14_400, boost_12h: 43_200, boost_war: 86_400,
    };
    const duration = BOOST_DURATIONS[boostId] ?? 3_600;

    // Deduct from vault
    await this.pg.query(
      `UPDATE alliances SET vault = vault - 5000 WHERE id = $1 AND vault >= 5000`,
      [allianceId]
    );

    await this.redis.set(
      `war:boost:${playerId}:${warId}`, boostId, 'EX', duration
    );
  }

  // ─── SETTLEMENT ───────────────────────────────────────────────────────────

  private async _settleWar(warId: string): Promise<void> {
    const war = await this._getWarById(warId);
    if (!war) return;

    let outcome: WarOutcome;
    if (war.attacker_points > war.defender_points)      outcome = 'ATTACKER';
    else if (war.defender_points > war.attacker_points) outcome = 'DEFENDER';
    else                                                  outcome = 'TIE';

    // Plunder
    let plunderAmount = 0;
    if (outcome !== 'TIE') {
      const loserId   = outcome === 'ATTACKER' ? war.defender_id : war.attacker_id;
      const winnerId  = outcome === 'ATTACKER' ? war.attacker_id : war.defender_id;

      const loserVault = await this.pg.query<{ vault: number }>(
        `SELECT vault FROM alliances WHERE id = $1`, [loserId]
      );
      plunderAmount = Math.min(
        Math.floor((loserVault.rows[0]?.vault ?? 0) * PLUNDER_PCT),
        PLUNDER_CAP
      );

      if (plunderAmount > 0) {
        await this.pg.query('BEGIN');
        try {
          await this.pg.query(`UPDATE alliances SET vault = vault - $1 WHERE id = $2`, [plunderAmount, loserId]);
          await this.pg.query(`UPDATE alliances SET vault = vault + $1 WHERE id = $2`, [plunderAmount, winnerId]);
          await this.pg.query('COMMIT');
        } catch {
          await this.pg.query('ROLLBACK');
        }
      }
    }

    // Generate proof hash
    const proofData  = JSON.stringify({ warId, outcome, attackerPoints: war.attacker_points, defenderPoints: war.defender_points, settledAt: new Date().toISOString() });
    const proofHash  = crypto.createHash('sha256').update(proofData).digest('hex');

    // Finalize
    await this.pg.query(
      `UPDATE alliance_wars SET status = 'ENDED', outcome = $1, proof_hash = $2 WHERE id = $3`,
      [outcome, proofHash, warId]
    );

    // Clear active_war_id from both alliances
    await this.pg.query(
      `UPDATE alliances SET active_war_id = NULL WHERE id IN ($1,$2)`,
      [war.attacker_id, war.defender_id]
    );

    // Apply post-war shield
    const shieldSecs = WAR_SHIELD_H * 3_600;
    await Promise.all([
      this.redis.set(`war:shield:${war.attacker_id}`, '1', 'EX', shieldSecs),
      this.redis.set(`war:shield:${war.defender_id}`, '1', 'EX', shieldSecs),
    ]);

    // Grant season XP to both alliances regardless of outcome
    await this.pg.query(
      `UPDATE alliances SET xp = xp + 500 WHERE id IN ($1,$2)`,
      [war.attacker_id, war.defender_id]
    );

    // Broadcast
    await this.redis.publish('multiplayer:events', JSON.stringify({
      type: 'ALLIANCE_WAR_ENDED', warId, outcome, proofHash, plunderAmount,
    }));

    this.emit('ALLIANCE_WAR_ENDED', { warId, outcome, proofHash, plunderAmount });

    // Notify alliances
    const outcomeText = outcome === 'TIE'
      ? `⚔️ WAR ENDED — It's a TIE! ${proofHash.slice(0,8)}`
      : outcome === 'ATTACKER'
        ? `⚔️ WAR ENDED — Attackers WIN! ${proofHash.slice(0,8)}`
        : `⚔️ WAR ENDED — Defenders WIN! ${proofHash.slice(0,8)}`;

    await this._broadcastToAlliance(war.attacker_id, 'WAR_ALERT', outcomeText);
    await this._broadcastToAlliance(war.defender_id, 'WAR_ALERT', outcomeText);
  }

  // ─── QUERIES ──────────────────────────────────────────────────────────────

  async getCurrentWar(allianceId: string): Promise<WarRecord | null> {
    const row = await this.pg.query(
      `SELECT aw.*,
              a1.tag as attacker_tag, a1.name as attacker_name,
              a2.tag as defender_tag, a2.name as defender_name
       FROM alliance_wars aw
       JOIN alliances a1 ON a1.id = aw.attacker_id
       JOIN alliances a2 ON a2.id = aw.defender_id
       WHERE (aw.attacker_id = $1 OR aw.defender_id = $1)
         AND aw.status NOT IN ('ENDED')
       ORDER BY aw.declared_at DESC LIMIT 1`,
      [allianceId]
    );
    return row.rows.length ? this._rowToRecord(row.rows[0]) : null;
  }

  async getWarHistory(allianceId: string, limit = 10): Promise<WarRecord[]> {
    const rows = await this.pg.query(
      `SELECT aw.*,
              a1.tag as attacker_tag, a1.name as attacker_name,
              a2.tag as defender_tag, a2.name as defender_name
       FROM alliance_wars aw
       JOIN alliances a1 ON a1.id = aw.attacker_id
       JOIN alliances a2 ON a2.id = aw.defender_id
       WHERE (aw.attacker_id = $1 OR aw.defender_id = $1)
         AND aw.status = 'ENDED'
       ORDER BY aw.declared_at DESC LIMIT $2`,
      [allianceId, limit]
    );
    return rows.rows.map(this._rowToRecord);
  }

  async getWarLeaderboard(warId: string): Promise<Array<{ playerId: string; displayName: string; allianceId: string; points: number; rank: number }>> {
    const rows = await this.pg.query(
      `SELECT wpe.player_id, p.display_name, wpe.alliance_id,
              SUM(wpe.final_points) as total_points
       FROM war_point_events wpe
       JOIN players p ON p.id = wpe.player_id
       WHERE wpe.war_id = $1
       GROUP BY wpe.player_id, p.display_name, wpe.alliance_id
       ORDER BY total_points DESC`,
      [warId]
    );
    return rows.rows.map((r, i) => ({
      playerId:    r.player_id,
      displayName: r.display_name,
      allianceId:  r.alliance_id,
      points:      parseInt(r.total_points),
      rank:        i + 1,
    }));
  }

  // ─── INTERNAL ─────────────────────────────────────────────────────────────

  private _schedulePhase(warId: string, targetPhase: WarStatus, delayMs: number): void {
    const existing = this.phaseTimers.get(`${warId}:${targetPhase}`);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(async () => {
      try {
        await this.advancePhase(warId);
      } catch (e) {
        console.error(`[WarService] Phase advance failed for war ${warId}:`, e);
      }
      this.phaseTimers.delete(`${warId}:${targetPhase}`);
    }, delayMs);

    this.phaseTimers.set(`${warId}:${targetPhase}`, timer);
  }

  private _scheduleReminder(warId: string, delayMs: number): void {
    setTimeout(async () => {
      const war = await this._getWarById(warId);
      if (!war || war.status !== 'ACTIVE') return;
      await this._broadcastToAlliance(war.attacker_id, 'WAR_ALERT', '⚔️ 1 HOUR REMAINING in the war!');
      await this._broadcastToAlliance(war.defender_id, 'WAR_ALERT', '⚔️ 1 HOUR REMAINING in the war!');
      this.emit('ALLIANCE_WAR_REMINDER', { warId, minutesRemaining: 60 });
    }, delayMs);
  }

  // Resume wars that were active when server restarted
  private async _resumeActiveWars(): Promise<void> {
    const rows = await this.pg.query(
      `SELECT id, status, starts_at, ends_at FROM alliance_wars WHERE status NOT IN ('ENDED')`,
    );

    for (const war of rows.rows) {
      const now   = Date.now();
      const start = new Date(war.starts_at).getTime();
      const end   = new Date(war.ends_at).getTime();

      if (war.status === 'DECLARED' || war.status === 'PREPARATION') {
        const delay = Math.max(0, start - now);
        this._schedulePhase(war.id, 'ACTIVE', delay);
      } else if (war.status === 'ACTIVE') {
        const delay = Math.max(0, end - now);
        this._schedulePhase(war.id, 'SETTLEMENT', delay);
        const reminderDelay = Math.max(0, end - 3_600_000 - now);
        if (reminderDelay > 0) this._scheduleReminder(war.id, reminderDelay);
      } else if (war.status === 'SETTLEMENT') {
        const settlementEnd = new Date(war.ends_at).getTime() + SETTLEMENT_PHASE_H * 3_600_000;
        const delay = Math.max(0, settlementEnd - now);
        this._schedulePhase(war.id, 'ENDED', delay);
      }
    }
  }

  private async _getActiveWar(allianceId: string): Promise<boolean> {
    const row = await this.pg.query(
      `SELECT id FROM alliance_wars WHERE (attacker_id = $1 OR defender_id = $1) AND status != 'ENDED' LIMIT 1`,
      [allianceId]
    );
    return row.rows.length > 0;
  }

  private async _getWarById(warId: string): Promise<Record<string, unknown> | null> {
    const row = await this.pg.query(`SELECT * FROM alliance_wars WHERE id = $1`, [warId]);
    return row.rows[0] ?? null;
  }

  private async _getAllianceInfo(id: string): Promise<{ name: string; tag: string }> {
    const row = await this.pg.query<{ name: string; tag: string }>(
      `SELECT name, tag FROM alliances WHERE id = $1`, [id]
    );
    return row.rows[0] ?? { name: 'Unknown', tag: '???' };
  }

  private async _createWarRoom(warId: string, attackerName: string, defenderName: string): Promise<string> {
    const roomId = this._genId();
    await this.pg.query(
      `INSERT INTO chat_rooms (id, name, type, creator_id, max_members, is_invite_only, is_war_room, created_at)
       VALUES ($1,$2,'CUSTOM','SYSTEM',500,true,true,NOW())`,
      [roomId, `⚔️ WAR: ${attackerName} vs ${defenderName}`]
    );
    await this.pg.query(
      `INSERT INTO chat_channels (id, type, name, member_count, slow_mode_seconds, is_locked)
       VALUES ($1,'ROOM',$2,0,0,false)`,
      [roomId, `⚔️ WAR: ${attackerName} vs ${defenderName}`]
    );
    return roomId;
  }

  private async _broadcastToAlliance(allianceId: string, type: string, message: string): Promise<void> {
    await this.redis.publish(`chat:alliance_${allianceId}`, JSON.stringify({
      event: 'MESSAGE',
      data: {
        id:          this._genId(),
        channelType: 'ALLIANCE',
        channelId:   `alliance_${allianceId}`,
        senderId:    'SYSTEM',
        senderName:  'System',
        senderRank:  null,
        senderTitle: null,
        type,
        body:        message,
        metadata:    null,
        status:      'SENT',
        sentAt:      new Date().toISOString(),
        editedAt:    null,
        unsentAt:    null,
        replyToId:   null,
        reactions:   [],
        flags:       0,
      },
    }));
  }

  private _rowToRecord(r: Record<string, unknown>): WarRecord {
    return {
      id:             r.id as string,
      attackerId:     r.attacker_id as string,
      attackerTag:    r.attacker_tag as string,
      attackerName:   r.attacker_name as string,
      defenderId:     r.defender_id as string,
      defenderTag:    r.defender_tag as string,
      defenderName:   r.defender_name as string,
      status:         r.status as WarStatus,
      declaredAt:     r.declared_at as Date,
      startsAt:       r.starts_at as Date,
      endsAt:         r.ends_at as Date,
      attackerPoints: r.attacker_points as number,
      defenderPoints: r.defender_points as number,
      outcome:        r.outcome as WarOutcome | null,
      proofHash:      r.proof_hash as string | null,
      warRoomId:      r.war_room_id as string | null,
    };
  }

  private _buildRecord(opts: {
    id: string; attackerAllianceId: string; defenderAllianceId: string;
    attacker: { name: string; tag: string }; defender: { name: string; tag: string };
    startsAt: Date; endsAt: Date;
  }): WarRecord {
    return {
      id:             opts.id,
      attackerId:     opts.attackerAllianceId,
      attackerTag:    opts.attacker.tag,
      attackerName:   opts.attacker.name,
      defenderId:     opts.defenderAllianceId,
      defenderTag:    opts.defender.tag,
      defenderName:   opts.defender.name,
      status:         'DECLARED',
      declaredAt:     new Date(),
      startsAt:       opts.startsAt,
      endsAt:         opts.endsAt,
      attackerPoints: 0,
      defenderPoints: 0,
      outcome:        null,
      proofHash:      null,
      warRoomId:      null,
    };
  }

  private _genId(): string {
    return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
  }
}

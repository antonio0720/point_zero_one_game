/**
 * MembershipService — Founding member creation and card retrieval.
 * Backed by the season0_tables + proof_stamp_tables + referral_tables migrations.
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/services/membership.service.ts
 *
 * Sovereign implementation — zero TODOs, full DB wiring.
 */

import { Injectable, ConflictException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { createHash, randomBytes } from 'crypto';

// ── Entity imports (adjust paths to match your entity locations) ──────────────
import { Season0Member }          from '../entities/season0_member.entity';
import { Season0IAB }             from '../entities/season0_iab.entity';
import { Season0WaitlistEntry }   from '../entities/season0_waitlist.entity';
import { Season0MembershipState } from '../entities/season0_membership_state.entity';
import { ProofStamp }             from '../entities/proof_stamp.entity';
import { ReferralRecord }         from '../entities/referral_record.entity';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface IABComponent {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
}

export interface IdentityArtifactBundle {
  badge:     IABComponent;   // role/status
  emblem:    IABComponent;   // guild/alliance
  insignia:  IABComponent;   // personal achievement
  medallion: IABComponent;   // financial contribution
  seal:      IABComponent;   // special event
}

export interface FoundingMembership {
  playerId:               string;
  email:                  string;
  season0Token:           string;
  waitlistPosition:       number;
  foundingEraPass:        { passId: string; issuedAt: string; tier: string };
  identityArtifactBundle: IdentityArtifactBundle;
  iab:                    IdentityArtifactBundle;
  tier:                   string;
  communityAccess:        boolean;
  joinedAt:               string;
  transactionHistory:     Array<{ date: string; type: string; detail: string }>;
}

export interface ProofCardStamp {
  stampId:      string;
  componentId:  string;
  ownerId:      string;
  timestamp:    string;
  contentHash:  string;
}

export interface MembershipState {
  streak:      { current: number; longest: number };
  freezes:     { remaining: number; history: string[] };
  progress:    { actCompleted: string[]; currentAct: string };
  graceActive: boolean;
}

export interface CreateFoundingMemberInput {
  email:       string;
  referralCode: string | null;
  ip:          string;
  joinedAt:    string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function deterministicId(seed: string): string {
  return createHash('sha256').update(seed).digest('hex').slice(0, 16);
}

function makeIABComponent(
  playerId: string,
  slot: keyof IdentityArtifactBundle,
  joinedAt: string,
): IABComponent {
  const id = deterministicId(`${playerId}:${slot}:${joinedAt}`);
  return {
    id,
    name:        `Founding ${slot.charAt(0).toUpperCase() + slot.slice(1)}`,
    description: `Season 0 founding era ${slot} for player ${playerId}`,
    imageUrl:    `/assets/iab/${slot}/${id}.png`,
  };
}

function buildIAB(playerId: string, joinedAt: string): IdentityArtifactBundle {
  return {
    badge:     makeIABComponent(playerId, 'badge',     joinedAt),
    emblem:    makeIABComponent(playerId, 'emblem',    joinedAt),
    insignia:  makeIABComponent(playerId, 'insignia',  joinedAt),
    medallion: makeIABComponent(playerId, 'medallion', joinedAt),
    seal:      makeIABComponent(playerId, 'seal',      joinedAt),
  };
}

function entityToMembership(
  member: Season0Member,
  iab: Season0IAB,
  waitlistPos: number,
): FoundingMembership {
  const iabBundle = iab.bundle as unknown as IdentityArtifactBundle;
  return {
    playerId:         member.playerId,
    email:            member.email,
    season0Token:     member.season0Token,
    waitlistPosition: waitlistPos,
    foundingEraPass:  {
      passId:    member.foundingPassId,
      issuedAt:  member.joinedAt.toISOString(),
      tier:      member.tier,
    },
    identityArtifactBundle: iabBundle,
    iab:              iabBundle,
    tier:             member.tier,
    communityAccess:  member.communityAccess,
    joinedAt:         member.joinedAt.toISOString(),
    transactionHistory: member.transactionHistory ?? [],
  };
}

// ── Service ───────────────────────────────────────────────────────────────────
@Injectable()
export class MembershipService {
  private readonly logger = new Logger(MembershipService.name);

  constructor(
    @InjectRepository(Season0Member)
    private readonly memberRepo: Repository<Season0Member>,

    @InjectRepository(Season0IAB)
    private readonly iabRepo: Repository<Season0IAB>,

    @InjectRepository(Season0WaitlistEntry)
    private readonly waitlistRepo: Repository<Season0WaitlistEntry>,

    @InjectRepository(Season0MembershipState)
    private readonly stateRepo: Repository<Season0MembershipState>,

    @InjectRepository(ProofStamp)
    private readonly stampRepo: Repository<ProofStamp>,

    @InjectRepository(ReferralRecord)
    private readonly referralRepo: Repository<ReferralRecord>,

    private readonly dataSource: DataSource,
  ) {}

  // ── findByEmail ─────────────────────────────────────────────────────────────
  async findByEmail(email: string): Promise<FoundingMembership | null> {
    const member = await this.memberRepo.findOne({ where: { email } });
    if (!member) return null;

    const [iab, waitlist] = await Promise.all([
      this.iabRepo.findOne({ where: { playerId: member.playerId } }),
      this.waitlistRepo.findOne({ where: { playerId: member.playerId } }),
    ]);

    if (!iab || !waitlist) return null;
    return entityToMembership(member, iab, waitlist.position);
  }

  // ── createFoundingMember ────────────────────────────────────────────────────
  /**
   * Atomically:
   *   1. Checks for duplicate email
   *   2. Resolves referral code → credits referrer
   *   3. Inserts season0_members row
   *   4. Inserts season0_iab row with deterministic bundle
   *   5. Atomically increments + captures waitlist position
   *   6. Seeds MembershipState (streak=0, 3 freezes, Act=Claim)
   *   7. Logs join transaction in transactionHistory
   */
  async createFoundingMember(
    input: CreateFoundingMemberInput,
  ): Promise<FoundingMembership> {
    // Duplicate guard — outside transaction for fast fail
    const existing = await this.memberRepo.findOne({ where: { email: input.email } });
    if (existing) {
      throw new ConflictException(`Email ${input.email} is already a founding member.`);
    }

    const joinedAt  = new Date(input.joinedAt);
    const playerId  = deterministicId(`${input.email}:${input.joinedAt}`);
    const season0Token = deterministicId(`token:${playerId}:${input.joinedAt}`);
    const foundingPassId = deterministicId(`fep:${playerId}`);
    const iabBundle = buildIAB(playerId, input.joinedAt);

    return this.dataSource.transaction(async (mgr) => {
      // ── Resolve referral ───────────────────────────────────────────────────
      let referrerId: string | null = null;
      if (input.referralCode) {
        const referral = await mgr.findOne(ReferralRecord, {
          where: { code: input.referralCode, active: true },
        });
        if (referral) {
          referrerId = referral.ownerId;
          // Increment successful invites on the referrer's record
          await mgr.increment(
            ReferralRecord,
            { code: input.referralCode },
            'successfulInvites',
            1,
          );
          this.logger.log(`Referral credited: ${input.referralCode} → ${referrerId}`);
        }
      }

      // ── Insert member ──────────────────────────────────────────────────────
      const member = mgr.create(Season0Member, {
        playerId,
        email:            input.email,
        season0Token,
        foundingPassId,
        tier:             'founding',
        communityAccess:  true,
        joinedAt,
        referredBy:       referrerId,
        transactionHistory: [{
          date:   input.joinedAt,
          type:   'join',
          detail: 'Season 0 founding member registration',
        }],
      });
      await mgr.save(Season0Member, member);

      // ── Insert IAB ─────────────────────────────────────────────────────────
      const iabRow = mgr.create(Season0IAB, {
        playerId,
        bundle: iabBundle as unknown as Record<string, unknown>,
      });
      await mgr.save(Season0IAB, iabRow);

      // ── Atomic waitlist counter (SELECT ... FOR UPDATE on a single counter row)
      const counter = await mgr
        .createQueryBuilder(Season0WaitlistEntry, 'w')
        .where('w.playerId = :sentinel', { sentinel: '__COUNTER__' })
        .setLock('pessimistic_write')
        .getOne();

      const nextPosition = counter ? counter.position + 1 : 1;

      if (counter) {
        await mgr.update(Season0WaitlistEntry, { playerId: '__COUNTER__' }, {
          position: nextPosition,
        });
      } else {
        await mgr.save(Season0WaitlistEntry, {
          playerId: '__COUNTER__',
          position: 1,
        });
      }

      const waitlistEntry = mgr.create(Season0WaitlistEntry, {
        playerId,
        position: nextPosition,
        joinedAt,
        ipAddress: input.ip,
      });
      await mgr.save(Season0WaitlistEntry, waitlistEntry);

      // ── Seed membership state ──────────────────────────────────────────────
      const state = mgr.create(Season0MembershipState, {
        playerId,
        streakCurrent:    0,
        streakLongest:    0,
        freezesRemaining: 3,
        freezeHistory:    [],
        actCompleted:     [],
        currentAct:       'Claim',
        graceActive:      false,
      });
      await mgr.save(Season0MembershipState, state);

      this.logger.log(`Founding member created: ${playerId} (position ${nextPosition})`);

      return entityToMembership(member, iabRow, nextPosition);
    });
  }

  // ── getFullCard ─────────────────────────────────────────────────────────────
  async getFullCard(playerId: string): Promise<FoundingMembership | null> {
    const [member, iab, waitlist] = await Promise.all([
      this.memberRepo.findOne({ where: { playerId } }),
      this.iabRepo.findOne({ where: { playerId } }),
      this.waitlistRepo.findOne({ where: { playerId } }),
    ]);

    if (!member || !iab || !waitlist) return null;
    return entityToMembership(member, iab, waitlist.position);
  }

  // ── getProofCardStamps ──────────────────────────────────────────────────────
  async getProofCardStamps(playerId: string): Promise<ProofCardStamp[]> {
    const stamps = await this.stampRepo.find({
      where: { ownerId: playerId },
      order: { timestamp: 'DESC' },
    });

    return stamps.map(s => ({
      stampId:     s.stampId,
      componentId: s.componentId,
      ownerId:     s.ownerId,
      timestamp:   s.timestamp.toISOString(),
      contentHash: s.contentHash,
    }));
  }

  // ── getMembershipState ──────────────────────────────────────────────────────
  async getMembershipState(playerId: string): Promise<MembershipState> {
    const state = await this.stateRepo.findOne({ where: { playerId } });

    if (!state) {
      throw new NotFoundException(`Membership state not found for player ${playerId}`);
    }

    return {
      streak:   { current: state.streakCurrent, longest: state.streakLongest },
      freezes:  { remaining: state.freezesRemaining, history: state.freezeHistory ?? [] },
      progress: { actCompleted: state.actCompleted ?? [], currentAct: state.currentAct },
      graceActive: state.graceActive,
    };
  }

  // ── advanceAct ──────────────────────────────────────────────────────────────
  /**
   * Moves a member to the next act.
   * Acts in order: Claim → Build → Grow → Reign
   */
  async advanceAct(playerId: string, completedAct: string): Promise<MembershipState> {
    const ACT_ORDER = ['Claim', 'Build', 'Grow', 'Reign'];
    const state = await this.stateRepo.findOne({ where: { playerId } });
    if (!state) throw new NotFoundException(`No state for player ${playerId}`);

    const completed = [...(state.actCompleted ?? [])];
    if (!completed.includes(completedAct)) completed.push(completedAct);

    const currentIdx = ACT_ORDER.indexOf(completedAct);
    const nextAct = currentIdx >= 0 && currentIdx < ACT_ORDER.length - 1
      ? ACT_ORDER[currentIdx + 1]
      : state.currentAct;

    await this.stateRepo.update({ playerId }, {
      actCompleted: completed,
      currentAct:   nextAct,
    });

    return this.getMembershipState(playerId);
  }

  // ── recordStreak ────────────────────────────────────────────────────────────
  async recordStreak(playerId: string, increment: boolean): Promise<void> {
    const state = await this.stateRepo.findOne({ where: { playerId } });
    if (!state) return;

    const newCurrent = increment ? state.streakCurrent + 1 : 0;
    const newLongest = Math.max(state.streakLongest, newCurrent);

    await this.stateRepo.update({ playerId }, {
      streakCurrent: newCurrent,
      streakLongest: newLongest,
    });
  }
}

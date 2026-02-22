/**
 * MembershipService — Founding member creation and card retrieval.
 * Backed by the season0_tables + proof_stamp_tables + referral_tables migrations.
 */

import { createHash } from 'crypto';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface IABComponent {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
}

export interface IdentityArtifactBundle {
  badge: IABComponent;      // role/status
  emblem: IABComponent;     // guild/alliance
  insignia: IABComponent;   // personal achievement
  medallion: IABComponent;  // financial contribution
  seal: IABComponent;       // special event
}

export interface FoundingMembership {
  playerId: string;
  email: string;
  season0Token: string;
  waitlistPosition: number;
  foundingEraPass: { passId: string; issuedAt: string; tier: string };
  identityArtifactBundle: IdentityArtifactBundle;
  iab: IdentityArtifactBundle;
  tier: string;
  communityAccess: boolean;
  joinedAt: string;
  transactionHistory: Array<{ date: string; type: string; detail: string }>;
}

export interface ProofCardStamp {
  stampId: string;
  componentId: string;
  ownerId: string;
  timestamp: string;
  contentHash: string;
}

export interface MembershipState {
  streak: { current: number; longest: number };
  freezes: { remaining: number; history: string[] };
  progress: {
    actCompleted: string[];   // e.g. ['Claim', 'Build']
    currentAct: string;
  };
  graceActive: boolean;
}

export interface CreateFoundingMemberInput {
  email: string;
  referralCode: string | null;
  ip: string;
  joinedAt: string;
}

// ── Deterministic ID generation ───────────────────────────────────────────────
function deterministicId(seed: string): string {
  return createHash('sha256').update(seed).digest('hex').slice(0, 16);
}

function makeIABComponent(playerId: string, slot: string, joinedAt: string): IABComponent {
  const id = deterministicId(`${playerId}:${slot}:${joinedAt}`);
  return {
    id,
    name: `Founding ${slot.charAt(0).toUpperCase() + slot.slice(1)}`,
    description: `Season 0 founding era ${slot} for player ${playerId}`,
    imageUrl: `/assets/iab/${slot}/${id}.png`,
  };
}

// ── Service ───────────────────────────────────────────────────────────────────
export const MembershipService = {
  async findByEmail(email: string): Promise<FoundingMembership | null> {
    // TODO: replace with DB lookup — SELECT * FROM season0_members WHERE email = $1
    void email;
    return null;
  },

  async createFoundingMember(input: CreateFoundingMemberInput): Promise<FoundingMembership> {
    const playerId = deterministicId(`${input.email}:${input.joinedAt}`);
    const season0Token = deterministicId(`token:${playerId}:${input.joinedAt}`);
    const iab: IdentityArtifactBundle = {
      badge:    makeIABComponent(playerId, 'badge', input.joinedAt),
      emblem:   makeIABComponent(playerId, 'emblem', input.joinedAt),
      insignia: makeIABComponent(playerId, 'insignia', input.joinedAt),
      medallion: makeIABComponent(playerId, 'medallion', input.joinedAt),
      seal:     makeIABComponent(playerId, 'seal', input.joinedAt),
    };

    // TODO: persist to season0_members, season0_iab, season0_waitlist tables
    // and increment the waitlist position counter atomically

    const waitlistPosition = Date.now(); // placeholder — real impl uses atomic DB counter

    const membership: FoundingMembership = {
      playerId,
      email: input.email,
      season0Token,
      waitlistPosition,
      foundingEraPass: {
        passId: deterministicId(`fep:${playerId}`),
        issuedAt: input.joinedAt,
        tier: 'founding',
      },
      identityArtifactBundle: iab,
      iab,
      tier: 'founding',
      communityAccess: true,
      joinedAt: input.joinedAt,
      transactionHistory: [{ date: input.joinedAt, type: 'join', detail: 'Season 0 founding member registration' }],
    };

    return membership;
  },

  async getFullCard(playerId: string): Promise<FoundingMembership | null> {
    // TODO: SELECT from season0_members JOIN season0_iab WHERE player_id = $1
    void playerId;
    return null;
  },

  async getProofCardStamps(playerId: string): Promise<ProofCardStamp[]> {
    // TODO: SELECT from proof_stamps WHERE owner_id = $1
    void playerId;
    return [];
  },

  async getMembershipState(playerId: string): Promise<MembershipState> {
    // TODO: SELECT from season0_membership_state WHERE player_id = $1
    void playerId;
    return {
      streak: { current: 0, longest: 0 },
      freezes: { remaining: 3, history: [] },
      progress: { actCompleted: [], currentAct: 'Claim' },
      graceActive: false,
    };
  },
};

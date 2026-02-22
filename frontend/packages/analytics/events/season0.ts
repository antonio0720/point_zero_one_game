/**
 * Analytics Events for Season 0
 */

declare module '*.json' {
  const value: any;
  export default value;
}

export interface ClaimEvent {
  eventType: 'Claim';
  gameId: string;
  userId: string;
  timestamp: number;
}

export interface RevealEvent {
  eventType: 'Reveal';
  gameId: string;
  userId: string;
  cardId: string;
  timestamp: number;
}

export interface ShareEvent {
  eventType: 'Share';
  gameId: string;
  userId: string;
  recipientId: string;
  timestamp: number;
}

export interface InviteEvent {
  eventType: 'Invite';
  inviterId: string;
  inviteeId: string;
  gameId?: string;
  timestamp: number;
}

export interface MembershipPageEvent {
  eventType: 'MembershipPageView';
  userId: string;
  timestamp: number;
}

/**
 * Analytics service for tracking user interactions.
 */
export class AnalyticsService {
  private events: ClaimEvent[] = [];
  private reveals: RevealEvent[] = [];
  private shares: ShareEvent[] = [];
  private invites: InviteEvent[] = [];
  private membershipPageViews: MembershipPageEvent[] = [];

  public logClaim(gameId: string, userId: string) {
    this.events.push({ eventType: 'Claim', gameId, userId, timestamp: Date.now() });
  }

  public logReveal(gameId: string, userId: string, cardId: string) {
    this.reveals.push({ eventType: 'Reveal', gameId, userId, cardId, timestamp: Date.now() });
  }

  public logShare(gameId: string, userId: string, recipientId: string) {
    this.shares.push({ eventType: 'Share', gameId, userId, recipientId, timestamp: Date.now() });
  }

  public logInvite(inviterId: string, inviteeId: string, gameId?: string) {
    this.invites.push({ eventType: 'Invite', inviterId, inviteeId, gameId, timestamp: Date.now() });
  }

  public logMembershipPageView(userId: string) {
    this.membershipPageViews.push({ eventType: 'MembershipPageView', userId, timestamp: Date.now() });
  }

  public exportEvents(): Record<string, any> {
    return {
      claimEvents: this.events,
      revealEvents: this.reveals,
      shareEvents: this.shares,
      inviteEvents: this.invites,
      membershipPageViews: this.membershipPageViews,
    };
  }
}

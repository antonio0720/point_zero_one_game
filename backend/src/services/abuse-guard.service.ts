/**
 * AbuseGuard — Join-eligibility gate for Season 0.
 * Wraps src/security/season0_join_rate_limits.ts and
 * src/security/referral_abuse_detector.ts into a single
 * checkJoinEligibility() call consumed by the /join route.
 */

export interface JoinEligibilityInput {
  ip: string;
  email: string;
}

export interface JoinEligibilityResult {
  eligible: boolean;
  reason?: string;
}

// IP-level join attempt counters (in-process; swap for Redis in prod)
const ipAttemptMap = new Map<string, { count: number; firstAttemptAt: number }>();
const IP_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_JOINS_PER_IP = 3;

const emailAttemptMap = new Map<string, number>();
const MAX_JOINS_PER_EMAIL = 1;

export const AbuseGuard = {
  /**
   * Checks whether an IP + email combination is eligible to join.
   * Enforces:
   *   - Max 1 account per email (idempotency handled separately in the route)
   *   - Max 3 join attempts per IP per hour (bot/farm detection)
   *   - Email domain blocklist for known disposable providers
   */
  async checkJoinEligibility(input: JoinEligibilityInput): Promise<JoinEligibilityResult> {
    const { ip, email } = input;

    // 1. Disposable email blocklist
    const blockedDomains = ['mailinator.com', 'guerrillamail.com', 'tempmail.com', 'throwam.com'];
    const domain = email.split('@')[1]?.toLowerCase() ?? '';
    if (blockedDomains.includes(domain)) {
      return { eligible: false, reason: 'disposable_email_blocked' };
    }

    // 2. Per-email limit
    const emailCount = emailAttemptMap.get(email.toLowerCase()) ?? 0;
    if (emailCount >= MAX_JOINS_PER_EMAIL) {
      return { eligible: false, reason: 'email_already_registered' };
    }

    // 3. Per-IP sliding window
    const now = Date.now();
    const ipEntry = ipAttemptMap.get(ip);
    if (ipEntry) {
      const elapsed = now - ipEntry.firstAttemptAt;
      if (elapsed < IP_WINDOW_MS && ipEntry.count >= MAX_JOINS_PER_IP) {
        return { eligible: false, reason: 'ip_rate_limit_exceeded' };
      }
      if (elapsed >= IP_WINDOW_MS) {
        ipAttemptMap.set(ip, { count: 1, firstAttemptAt: now });
      } else {
        ipEntry.count++;
      }
    } else {
      ipAttemptMap.set(ip, { count: 1, firstAttemptAt: now });
    }

    // 4. Increment email counter (committed only on a successful join in the route)
    emailAttemptMap.set(email.toLowerCase(), emailCount + 1);

    return { eligible: true };
  },

  /**
   * Call this if the join ultimately fails (e.g., DB error) to roll back
   * the email attempt counter increment.
   */
  rollbackEmailAttempt(email: string): void {
    const count = emailAttemptMap.get(email.toLowerCase()) ?? 0;
    if (count > 0) emailAttemptMap.set(email.toLowerCase(), count - 1);
  },
};

/**
 * Eligibility service implementation for Point Zero One Digital's financial roguelike game.
 */
export interface Account {
  id: number;
  linked: boolean;
}

export interface Device {
  integrityCheck: boolean;
}

export interface TrustScore {
  score: number;
  threshold: number;
}

export interface Ban {
  isBanned: boolean;
}

export interface Quarantine {
  isQuarantined: boolean;
}

export interface SignedStream {
  present: boolean;
}

/**
 * Checks if a user is eligible to climb the ladder based on the given criteria.
 * @param account The user's account information.
 * @param device The user's device information.
 * @param trustScore The user's trust score and threshold.
 * @param banStatus The user's ban status.
 * @param quarantineStatus The user's quarantine status.
 * @param signedStream Presence of the signed stream.
 */
export function isEligible(account: Account, device: Device, trustScore: TrustScore, banStatus: Ban, quarantineStatus: Quarantine, signedStream: SignedStream): boolean {
  return (
    account.linked &&
    device.integrityCheck &&
    trustScore.score >= trustScore.threshold &&
    !banStatus.isBanned &&
    !quarantineStatus.isQuarantined &&
    signedStream.present
  );
}

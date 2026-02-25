/**
 * Ranked Gate Service
 */
export interface Entitlement {
  userId: string;
  entitlementId: string;
  noWinOddsLift: boolean;
  policyVersion: number;
}

export interface ValidatedEntitlement extends Entitlement {
  isValid: boolean;
}

/**
 * Validates entitlements compatible with no-win-odds lift and enforces policy version.
 * @param entitlements - Array of user entitlements to validate.
 */
export function validateEntitlements(entitlements: Entitlement[]): ValidatedEntitlement[] {
  return entitlements.map((entitlement) => {
    const isValid =
      entitlement.noWinOddsLift &&
      entitlement.policyVersion === POLICY_VERSION;

    return { ...entitlement, isValid };
  });
}

const POLICY_VERSION = 1; // Update this value as needed

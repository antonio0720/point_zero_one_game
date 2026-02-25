/**
 * Share Governance Implementation
 */

import { PartnerShare } from "../models/PartnerShare";
import { ProofCard, RunExplorerLink } from "../models/ShareObjects";
import { TenantRule } from "../models/TenantRule";

/**
 * Validate and process share objects for partners.
 * Disables raw screenshot incentives and enforces tenant rules.
 */
export class ShareGovernanceImpl {
  /**
   * Validate and process a partner share object.
   * @param share - The partner share object to validate and process.
   * @returns The validated partner share object or null if invalid.
   */
  public validateAndProcessShare(share: PartnerShare): PartnerShare | null {
    // Disable raw screenshot incentives
    if (share.incentiveType === "screenshot") {
      return null;
    }

    // Validate and process allowed share objects
    if (share.object instanceof ProofCard || share.object instanceof RunExplorerLink) {
      return share;
    } else {
      return null;
    }
  }

  /**
   * Enforce tenant rules for a partner share object.
   * @param share - The partner share object to enforce tenant rules on.
   * @returns The enforced partner share object or null if invalid.
   */
  public enforceTenantRules(share: PartnerShare): PartnerShare | null {
    // Enforce tenant rules
    for (const rule of share.tenantRules) {
      if (!rule.isValidForShare(share)) {
        return null;
      }
    }

    return share;
  }
}

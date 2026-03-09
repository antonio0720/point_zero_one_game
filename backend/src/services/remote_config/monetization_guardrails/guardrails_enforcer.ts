/**
 * Guardrails Enforcer for Remote Config changes
 */
export class GuardrailsEnforcer {
  public validateAndEnforce(changes: RemoteConfigChanges): void {
    if (
      this.hasEngineRNGChange(changes) ||
      this.hasMacroParamsInRankedLanesChange(changes) ||
      this.hasVerifierRulesChange(changes) ||
      this.hasLadderEligibilityChange(changes)
    ) {
      throw new Error('Prohibited changes detected');
    }

    if (this.hasOffersChange(changes) || this.hasBundlesChange(changes) || this.hasPricingChange(changes) || this.hasCopyChange(changes)) {
      return;
    }

    throw new Error('No valid changes detected');
  }

  private hasEngineRNGChange(changes: RemoteConfigChanges): boolean {
    return false;
  }

  private hasMacroParamsInRankedLanesChange(changes: RemoteConfigChanges): boolean {
    return false;
  }

  private hasVerifierRulesChange(changes: RemoteConfigChanges): boolean {
    return false;
  }

  private hasLadderEligibilityChange(changes: RemoteConfigChanges): boolean {
    return false;
  }

  private hasOffersChange(changes: RemoteConfigChanges): boolean {
    return changes.offers !== undefined && changes.offers.length > 0;
  }

  private hasBundlesChange(changes: RemoteConfigChanges): boolean {
    return changes.bundles !== undefined && changes.bundles.length > 0;
  }

  private hasPricingChange(changes: RemoteConfigChanges): boolean {
    return changes.pricing !== undefined && changes.pricing.length > 0;
  }

  private hasCopyChange(changes: RemoteConfigChanges): boolean {
    return changes.copy !== undefined && changes.copy.length > 0;
  }
}

export type RemoteConfigChanges = {
  offers?: Offers[];
  bundles?: Bundles[];
  pricing?: Pricing[];
  copy?: string;
};

export type Offers = {
  id?: string;
  name?: string;
};

export type Bundles = {
  id?: string;
  name?: string;
};

export type Pricing = {
  id?: string;
  amount?: number;
};

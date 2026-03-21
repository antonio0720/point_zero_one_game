/**
 * Curriculum Entitlement Contract
 */

export interface CurriculumEntitlement {
  orgId: string;
  cohortId: string;
  packAccess: string[]; // Array of pack IDs that the entitlement grants access to
  dashboardAccess: boolean;
  facilitatorAccess: boolean;
}

export namespace CurriculumEntitlement {
  export function isValid(entitlement: CurriculumEntitlement): entitlement is ValidCurriculumEntitlement {
    return (
      typeof entitlement.orgId === 'string' &&
      typeof entitlement.cohortId === 'string' &&
      Array.isArray(entitlement.packAccess) &&
      entitlement.packAccess.every(pack => typeof pack === 'string') &&
      typeof entitlement.dashboardAccess === 'boolean' &&
      typeof entitlement.facilitatorAccess === 'boolean'
    );
  }
}

export interface ValidCurriculumEntitlement extends CurriculumEntitlement {}

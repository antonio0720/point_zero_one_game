/**
 * Enrollment Contract Interface
 */
export interface EnrollmentContract {
  id: number;
  partnerId: number;
  source: EnrollmentSource;
  eligibilityState: EligibilityState;
  receiptId?: number;
}

/**
 * Enumeration for enrollment sources
 */
export enum EnrollmentSource {
  SSO = 'SSO',
  RosterUpload = 'RosterUpload',
  API = 'API'
}

/**
 * Enumeration for eligibility states
 */
export enum EligibilityState {
  Pending = 'Pending',
  Approved = 'Approved',
  Denied = 'Denied'
}

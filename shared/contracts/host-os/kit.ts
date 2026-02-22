/**
 * Shared contracts for Point Zero One Digital's Host Operating System (HOS)
 */

enum KitVersion {
  V1 = 'V1',
  V2 = 'V2'
}

enum MomentCode {
  HOS_A01 = 'HOS-A01',
  HOS_A02 = 'HOS-A02',
  // ... (continue for all MomentCodes)
  HOS_E01 = 'HOS-E01'
}

/**
 * Request to download a kit from the host OS.
 */
export interface HostKitDownloadRequest {
  /** The version of the kit to be downloaded. */
  version: KitVersion;

  /** The moment code for which the kit is intended. */
  momentCode: MomentCode;
}

/**
 * Response from the host OS after a successful kit download request.
 */
export interface HostKitDownloadResponse {
  /** The version of the kit that was downloaded. */
  version: KitVersion;

  /** The moment code for which the kit is intended. */
  momentCode: MomentCode;

  /** A unique identifier for this download request and response pair. */
  transactionId: string;
}

/**
 * Payload for a webhook triggered by a host registration event.
 */
export interface GHLHostWebhookPayload {
  /** The type of the event that triggered the webhook. */
  eventType: 'hostRegistration';

  /** The registration data for the newly registered host. */
  registrationData: HostRegistration;
}

/**
 * Data for a registered host in the Point Zero One Digital ecosystem.
 */
export interface HostRegistration {
  /** A unique identifier for this host. */
  id: string;

  /** The version of the kit installed on this host. */
  kitVersion: KitVersion;

  /** The moment code for which this host is registered. */
  momentCode: MomentCode;
}

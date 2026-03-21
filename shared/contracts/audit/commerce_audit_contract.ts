/**
 * Commerce Audit Contract
 */

export interface AuditLogEntry {
  id: number;
  timestamp: Date;
  actorId: number;
  action: string;
  skuId?: number;
  skuName?: string;
  oldSkuValue?: string;
  newSkuValue?: string;
  tagId?: number;
  tagName?: string;
  oldTagValue?: string;
  newTagValue?: string;
  remoteConfigKey?: string;
  oldRemoteConfigValue?: string;
  newRemoteConfigValue?: string;
  experimentId?: number;
  experimentName?: string;
  oldExperimentState?: boolean;
  newExperimentState?: boolean;
  enforcementBlockId?: number;
  enforcementBlockName?: string;
}

export interface AuditLog {
  id: number;
  entries: AuditLogEntry[];
}

export function createAuditLog(entries: AuditLogEntry[]): AuditLog {
  return {
    id: Date.now(),
    entries,
  };
}

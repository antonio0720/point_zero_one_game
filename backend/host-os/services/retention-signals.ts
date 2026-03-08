// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/host-os/services/retention-signals.ts

export type RetentionWebhookEvent = 'host_at_risk' | 'host_active_tag';

export interface HostRetentionRecord {
  id: string | number;
  email?: string | null;
  lastHostedNightAt?: string | Date | null;
  hostedNightCount?: number | null;
  totalHostedNights?: number | null;
  completedHostedNightCount?: number | null;
  bookedNightCount?: number | null;
  bookingRate?: number | null;
  hasNightInLastNineDays?: () => boolean;
  isActive?: () => boolean;
}

export interface RetentionSignalOptions {
  referenceDate?: Date;
  atRiskDays?: number;
  minimumActiveHostedNights?: number;
  activeBookingRateThreshold?: number;
  emitWebhook?: boolean;
  webhookBaseUrl?: string;
  webhookApiKey?: string;
  webhookUrls?: Partial<Record<RetentionWebhookEvent, string>>;
}

export interface RetentionSignalResult {
  hostId: string;
  email: string | null;
  event: RetentionWebhookEvent;
  status: 'at_risk' | 'active';
  hostedNightCount: number;
  bookingRate: number;
  lastHostedNightAt: string | null;
  occurredAt: string;
  emitted: boolean;
}

function toFiniteNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
}

function coerceDate(value: unknown): Date | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}

function getHostedNightCount(host: HostRetentionRecord): number {
  const raw =
    host.hostedNightCount ??
    host.totalHostedNights ??
    host.completedHostedNightCount ??
    0;

  return Math.max(0, Math.trunc(toFiniteNumber(raw)));
}

function getBookingRate(host: HostRetentionRecord): number {
  const explicitRate = toFiniteNumber(host.bookingRate);
  if (explicitRate > 0) {
    return clamp01(explicitRate);
  }

  const bookedNightCount = Math.max(
    0,
    Math.trunc(toFiniteNumber(host.bookedNightCount)),
  );
  const hostedNightCount = getHostedNightCount(host);

  if (bookedNightCount <= 0 || hostedNightCount <= 0) {
    return 0;
  }

  return clamp01(bookedNightCount / hostedNightCount);
}

function hasHostedNightWithinDays(
  host: HostRetentionRecord,
  days: number,
  referenceDate: Date,
): boolean {
  if (days === 9 && typeof host.hasNightInLastNineDays === 'function') {
    try {
      return host.hasNightInLastNineDays();
    } catch (error) {
      console.error('[host-os][retention] hasNightInLastNineDays failed', error);
    }
  }

  const lastHostedNightAt = coerceDate(host.lastHostedNightAt);
  if (!lastHostedNightAt) {
    return false;
  }

  const diffMs = referenceDate.getTime() - lastHostedNightAt.getTime();
  const maxDiffMs = days * 24 * 60 * 60 * 1000;

  return diffMs <= maxDiffMs;
}

export function isHostAtRisk(
  host: HostRetentionRecord,
  options: Pick<RetentionSignalOptions, 'referenceDate' | 'atRiskDays'> = {},
): boolean {
  const referenceDate = options.referenceDate ?? new Date();
  const atRiskDays = options.atRiskDays ?? 9;

  return !hasHostedNightWithinDays(host, atRiskDays, referenceDate);
}

export function isHostActive(
  host: HostRetentionRecord,
  options: Pick<
    RetentionSignalOptions,
    'minimumActiveHostedNights' | 'activeBookingRateThreshold'
  > = {},
): boolean {
  if (typeof host.isActive === 'function') {
    try {
      return host.isActive();
    } catch (error) {
      console.error('[host-os][retention] isActive failed', error);
    }
  }

  const minimumActiveHostedNights = options.minimumActiveHostedNights ?? 3;
  const activeBookingRateThreshold =
    options.activeBookingRateThreshold ?? 0.8;

  return (
    getHostedNightCount(host) >= minimumActiveHostedNights &&
    getBookingRate(host) >= activeBookingRateThreshold
  );
}

function buildWebhookUrl(
  event: RetentionWebhookEvent,
  options: RetentionSignalOptions,
): string | null {
  const explicitEventUrl = options.webhookUrls?.[event]?.trim();
  if (explicitEventUrl) {
    return explicitEventUrl;
  }

  const envEventUrl =
    (event === 'host_at_risk'
      ? process.env.HOST_OS_RETENTION_WEBHOOK_HOST_AT_RISK_URL
      : process.env.HOST_OS_RETENTION_WEBHOOK_HOST_ACTIVE_TAG_URL) || '';

  if (envEventUrl.trim()) {
    return envEventUrl.trim();
  }

  const baseUrl =
    options.webhookBaseUrl?.trim() ||
    process.env.HOST_OS_RETENTION_WEBHOOK_URL?.trim() ||
    process.env.HOST_OS_GHL_WEBHOOK_URL?.trim() ||
    '';

  if (!baseUrl) {
    return null;
  }

  return baseUrl.endsWith('/') ? `${baseUrl}${event}` : `${baseUrl}/${event}`;
}

async function emitRetentionWebhook(
  event: RetentionWebhookEvent,
  result: RetentionSignalResult,
  options: RetentionSignalOptions,
): Promise<boolean> {
  const url = buildWebhookUrl(event, options);
  if (!url) {
    return false;
  }

  const apiKey =
    options.webhookApiKey?.trim() ||
    process.env.HOST_OS_RETENTION_WEBHOOK_API_KEY?.trim() ||
    process.env.HOST_OS_GHL_WEBHOOK_API_KEY?.trim() ||
    '';

  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };

  if (apiKey) {
    headers.authorization = `Bearer ${apiKey}`;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        event,
        source: 'pzo-host-os',
        occurredAt: result.occurredAt,
        payload: result,
      }),
    });

    if (!response.ok) {
      console.error('[host-os][retention] webhook failed', {
        event,
        status: response.status,
        statusText: response.statusText,
      });
    }

    return response.ok;
  } catch (error) {
    console.error('[host-os][retention] webhook transport failed', {
      event,
      error,
    });
    return false;
  }
}

function buildSignalResult(
  event: RetentionWebhookEvent,
  host: HostRetentionRecord,
  occurredAt: string,
): RetentionSignalResult {
  const lastHostedNightAt = coerceDate(host.lastHostedNightAt);

  return {
    hostId: String(host.id),
    email: host.email?.trim() || null,
    event,
    status: event === 'host_at_risk' ? 'at_risk' : 'active',
    hostedNightCount: getHostedNightCount(host),
    bookingRate: getBookingRate(host),
    lastHostedNightAt: lastHostedNightAt
      ? lastHostedNightAt.toISOString()
      : null,
    occurredAt,
    emitted: false,
  };
}

export async function detectAtRiskHosts(
  hosts: readonly HostRetentionRecord[],
  options: RetentionSignalOptions = {},
): Promise<RetentionSignalResult[]> {
  const referenceDate = options.referenceDate ?? new Date();
  const occurredAt = referenceDate.toISOString();
  const results: RetentionSignalResult[] = [];

  for (const host of hosts) {
    if (!isHostAtRisk(host, options)) {
      continue;
    }

    const result = buildSignalResult('host_at_risk', host, occurredAt);

    if (options.emitWebhook) {
      result.emitted = await emitRetentionWebhook(
        'host_at_risk',
        result,
        options,
      );
    }

    results.push(result);
  }

  return results;
}

export async function detectActiveHosts(
  hosts: readonly HostRetentionRecord[],
  options: RetentionSignalOptions = {},
): Promise<RetentionSignalResult[]> {
  const referenceDate = options.referenceDate ?? new Date();
  const occurredAt = referenceDate.toISOString();
  const results: RetentionSignalResult[] = [];

  for (const host of hosts) {
    if (!isHostActive(host, options)) {
      continue;
    }

    const result = buildSignalResult('host_active_tag', host, occurredAt);

    if (options.emitWebhook) {
      result.emitted = await emitRetentionWebhook(
        'host_active_tag',
        result,
        options,
      );
    }

    results.push(result);
  }

  return results;
}

export default {
  detectAtRiskHosts,
  detectActiveHosts,
  isHostAtRisk,
  isHostActive,
};
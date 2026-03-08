/**
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/host-os/services/ghl-host-webhook.ts
 *
 * Host OS → GoHighLevel webhook adapter.
 *
 * Purpose:
 * - Preserve backward compatibility with existing legacy webhook helpers
 * - Add the generic sendGhlHostEvent(...) contract expected by newer Host OS routes
 * - Support both per-event webhook URLs and a single fallback URL
 * - Never block core request paths if webhook delivery fails
 */

export type HostWebhookEventType =
  | 'host_kit_downloaded'
  | 'host_night_logged'
  | 'host_kit_v2_waitlist'
  | 'host_invite_opened'
  | 'host_invite_rsvp'
  | 'host_moment_logged'
  | 'host_printable_opened';

export interface HostKitDownloadedWebhookPayload {
  hostId: number;
  email: string;
  name: string;
  kitVersion: string;
  downloadCount: number;
}

export interface HostNightLoggedWebhookPayload {
  hostId: number;
  email: string;
  hostedNightCount: number;
}

export interface HostKitV2WaitlistWebhookPayload {
  hostId: number;
  email: string;
  name: string;
}

export type GenericHostWebhookPayload = Record<string, unknown>;

export type HostWebhookPayloadMap = {
  host_kit_downloaded: HostKitDownloadedWebhookPayload;
  host_night_logged: HostNightLoggedWebhookPayload;
  host_kit_v2_waitlist: HostKitV2WaitlistWebhookPayload;
  host_invite_opened: GenericHostWebhookPayload;
  host_invite_rsvp: GenericHostWebhookPayload;
  host_moment_logged: GenericHostWebhookPayload;
  host_printable_opened: GenericHostWebhookPayload;
};

export interface HostWebhookEnvelope<TPayload = GenericHostWebhookPayload> {
  eventType: HostWebhookEventType;
  tags: string[];
  occurredAt: string;
  source: 'pzo-host-os';
  payload: TPayload;
}

export interface HostWebhookResult {
  delivered: boolean;
  statusCode: number | null;
  body: string | null;
  error: string | null;
}

const EVENT_URL_ENV_KEYS: Record<HostWebhookEventType, string> = {
  host_kit_downloaded: 'HOST_OS_GHL_WEBHOOK_HOST_KIT_DOWNLOADED_URL',
  host_night_logged: 'HOST_OS_GHL_WEBHOOK_HOST_NIGHT_LOGGED_URL',
  host_kit_v2_waitlist: 'HOST_OS_GHL_WEBHOOK_HOST_KIT_V2_WAITLIST_URL',
  host_invite_opened: 'HOST_OS_GHL_WEBHOOK_HOST_INVITE_OPENED_URL',
  host_invite_rsvp: 'HOST_OS_GHL_WEBHOOK_HOST_INVITE_RSVP_URL',
  host_moment_logged: 'HOST_OS_GHL_WEBHOOK_HOST_MOMENT_LOGGED_URL',
  host_printable_opened: 'HOST_OS_GHL_WEBHOOK_HOST_PRINTABLE_OPENED_URL',
};

const EVENT_TAGS: Record<HostWebhookEventType, string[]> = {
  host_kit_downloaded: ['Host Kit v1', 'Host Nurture'],
  host_night_logged: ['Active Host'],
  host_kit_v2_waitlist: ['Host OS v2 Waitlist'],
  host_invite_opened: ['Host Invite', 'Invite Opened'],
  host_invite_rsvp: ['Host Invite', 'Invite RSVP'],
  host_moment_logged: ['Host Moment'],
  host_printable_opened: ['Host Printable'],
};

function getTrimmedEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function getWebhookUrl(eventType: HostWebhookEventType): string | null {
  const eventSpecificUrl = getTrimmedEnv(EVENT_URL_ENV_KEYS[eventType]);
  const fallbackUrl = getTrimmedEnv('HOST_OS_GHL_WEBHOOK_URL');

  return eventSpecificUrl || fallbackUrl || null;
}

function getWebhookHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };

  const apiKey = getTrimmedEnv('HOST_OS_GHL_WEBHOOK_API_KEY');
  if (apiKey) {
    headers.authorization = `Bearer ${apiKey}`;
  }

  return headers;
}

function coercePositiveInteger(rawValue: string | null, fallback: number): number {
  if (!rawValue) {
    return fallback;
  }

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

function buildWebhookEnvelope<TEvent extends HostWebhookEventType>(
  eventType: TEvent,
  payload: HostWebhookPayloadMap[TEvent],
): HostWebhookEnvelope<HostWebhookPayloadMap[TEvent]> {
  return {
    eventType,
    tags: EVENT_TAGS[eventType],
    occurredAt: new Date().toISOString(),
    source: 'pzo-host-os',
    payload,
  };
}

async function postJson(url: string, body: unknown): Promise<HostWebhookResult> {
  const timeoutMs = coercePositiveInteger(
    getTrimmedEnv('HOST_OS_GHL_WEBHOOK_TIMEOUT_MS'),
    5000,
  );

  const controller = new AbortController();
  const timeoutHandle: ReturnType<typeof setTimeout> = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: getWebhookHeaders(),
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const responseText = await response.text();

    return {
      delivered: response.ok,
      statusCode: response.status,
      body: responseText,
      error: response.ok ? null : `Webhook responded with HTTP ${response.status}`,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown webhook transport error';

    console.error('[host-os][ghl-webhook] delivery failed', {
      url,
      error: errorMessage,
    });

    return {
      delivered: false,
      statusCode: null,
      body: null,
      error: errorMessage,
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
}

/**
 * Generic event sender expected by:
 * - backend/host-os/routes/invite.ts
 * - backend/host-os/routes/moments.ts
 * - backend/host-os/routes/printables.ts
 */
export async function sendGhlHostEvent<TEvent extends HostWebhookEventType>(
  eventType: TEvent,
  payload: HostWebhookPayloadMap[TEvent],
): Promise<HostWebhookResult> {
  const url = getWebhookUrl(eventType);

  if (!url) {
    console.warn(`[host-os][ghl-webhook] no webhook URL configured for ${eventType}`);

    return {
      delivered: false,
      statusCode: null,
      body: null,
      error: 'Webhook URL not configured',
    };
  }

  const envelope = buildWebhookEnvelope(eventType, payload);
  return await postJson(url, envelope);
}

/**
 * Backward-compatible alias used by older host-os code.
 */
export async function emitHostWebhook<TEvent extends HostWebhookEventType>(
  eventType: TEvent,
  payload: HostWebhookPayloadMap[TEvent],
): Promise<HostWebhookResult> {
  return await sendGhlHostEvent(eventType, payload);
}

export async function sendHostKitDownloadedWebhook(
  payload: HostKitDownloadedWebhookPayload,
): Promise<HostWebhookResult> {
  return await sendGhlHostEvent('host_kit_downloaded', payload);
}

export async function sendHostNightLoggedWebhook(
  payload: HostNightLoggedWebhookPayload,
): Promise<HostWebhookResult> {
  return await sendGhlHostEvent('host_night_logged', payload);
}

export async function sendHostKitV2WaitlistWebhook(
  payload: HostKitV2WaitlistWebhookPayload,
): Promise<HostWebhookResult> {
  return await sendGhlHostEvent('host_kit_v2_waitlist', payload);
}
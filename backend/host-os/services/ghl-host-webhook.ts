// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/host-os/services/ghl-host-webhook.ts

/**
 * Host OS → GoHighLevel webhook adapter.
 * Sends event payloads to configured endpoints without blocking core flows.
 */

export type HostWebhookEventType =
  | 'host_kit_downloaded'
  | 'host_night_logged'
  | 'host_kit_v2_waitlist';

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

export interface HostWebhookResult {
  delivered: boolean;
  statusCode: number | null;
  body: string | null;
}

function getWebhookUrl(eventType: HostWebhookEventType): string | null {
  const perEventMap: Record<HostWebhookEventType, string | undefined> = {
    host_kit_downloaded: process.env.HOST_OS_GHL_WEBHOOK_HOST_KIT_DOWNLOADED_URL,
    host_night_logged: process.env.HOST_OS_GHL_WEBHOOK_HOST_NIGHT_LOGGED_URL,
    host_kit_v2_waitlist: process.env.HOST_OS_GHL_WEBHOOK_HOST_KIT_V2_WAITLIST_URL,
  };

  return (
    perEventMap[eventType] ||
    process.env.HOST_OS_GHL_WEBHOOK_URL ||
    null
  );
}

async function postJson(
  url: string,
  body: Record<string, unknown>,
): Promise<HostWebhookResult> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };

  const apiKey = process.env.HOST_OS_GHL_WEBHOOK_API_KEY;
  if (apiKey) {
    headers.authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const text = await response.text();

  return {
    delivered: response.ok,
    statusCode: response.status,
    body: text,
  };
}

export async function emitHostWebhook(
  eventType: HostWebhookEventType,
  payload: Record<string, unknown>,
): Promise<HostWebhookResult> {
  const url = getWebhookUrl(eventType);

  if (!url) {
    console.warn(`[host-os] no GHL webhook URL configured for ${eventType}`);
    return {
      delivered: false,
      statusCode: null,
      body: null,
    };
  }

  return await postJson(url, {
    eventType,
    tags: {
      host_kit_downloaded: ['Host Kit v1', 'Host Nurture'],
      host_night_logged: ['Active Host'],
      host_kit_v2_waitlist: ['Host OS v2 Waitlist'],
    }[eventType],
    occurredAt: new Date().toISOString(),
    source: 'pzo-host-os',
    payload,
  });
}

export async function sendHostKitDownloadedWebhook(
  payload: HostKitDownloadedWebhookPayload,
): Promise<HostWebhookResult> {
  return await emitHostWebhook('host_kit_downloaded', payload);
}

export async function sendHostNightLoggedWebhook(
  payload: HostNightLoggedWebhookPayload,
): Promise<HostWebhookResult> {
  return await emitHostWebhook('host_night_logged', payload);
}

export async function sendHostKitV2WaitlistWebhook(
  payload: HostKitV2WaitlistWebhookPayload,
): Promise<HostWebhookResult> {
  return await emitHostWebhook('host_kit_v2_waitlist', payload);
}
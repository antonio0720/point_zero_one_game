// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/host-os/services/host-email-links.ts

import { createHmac, timingSafeEqual } from 'node:crypto';

const DEFAULT_BASE_URL = 'https://pointzeroonegame.com';
const DEFAULT_KIT_PUBLIC_URL =
  'https://pointzeroonegame.com/host/assets/pzo_host_os_kit_v1.zip';

function getSecret(): string {
  return process.env.HOST_OS_LINK_SECRET || 'replace-me-in-production';
}

function sign(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('hex');
}

function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

export function getHostOsPublicBaseUrl(): string {
  return (process.env.HOST_OS_PUBLIC_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

export function getHostOsPublicKitUrl(): string {
  return process.env.HOST_OS_KIT_PUBLIC_URL || DEFAULT_KIT_PUBLIC_URL;
}

export function buildTrackedOpenPixelUrl(messageId: string): string {
  const token = sign(`open:${messageId}`);
  return `${getHostOsPublicBaseUrl()}/host/email/o/${encodeURIComponent(messageId)}.gif?token=${encodeURIComponent(token)}`;
}

export function verifyTrackedOpenPixelToken(
  messageId: string,
  token: string,
): boolean {
  return safeEqualHex(sign(`open:${messageId}`), token);
}

export function buildTrackedClickUrl(
  messageId: string,
  linkKey: string,
  targetUrl: string,
): string {
    const encodedUrl = Buffer.from(targetUrl, 'utf8').toString('base64url');
    const token = sign(`click:${messageId}:${linkKey}:${encodedUrl}`);
    return `${getHostOsPublicBaseUrl()}/host/email/c/${encodeURIComponent(messageId)}/${encodeURIComponent(linkKey)}?u=${encodeURIComponent(encodedUrl)}&token=${encodeURIComponent(token)}`;
}

export function parseTrackedClickPayload(
  messageId: string,
  linkKey: string,
  encodedUrl: string,
  token: string,
): string | null {
  const expected = sign(`click:${messageId}:${linkKey}:${encodedUrl}`);

  if (!safeEqualHex(expected, token)) {
    return null;
  }

  const url = Buffer.from(encodedUrl, 'base64url').toString('utf8');

  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

export function buildUnsubscribeUrl(registrationId: number): string {
  const token = sign(`unsubscribe:${registrationId}`);
  return `${getHostOsPublicBaseUrl()}/host/email/unsubscribe/${registrationId}?token=${encodeURIComponent(token)}`;
}

export function verifyUnsubscribeToken(
  registrationId: number,
  token: string,
): boolean {
  return safeEqualHex(sign(`unsubscribe:${registrationId}`), token);
}

export function buildSignedKitDownloadRedirectUrl(registrationId: number): string {
  const expiresAtUnix = Math.floor(Date.now() / 1000) + 60 * 60 * 24;
  const token = sign(`kit:${registrationId}:${expiresAtUnix}`);
  return `${getHostOsPublicBaseUrl()}/host/download/file?registrationId=${registrationId}&expires=${expiresAtUnix}&token=${encodeURIComponent(token)}`;
}

export function verifySignedKitDownloadRedirectUrl(
  registrationId: number,
  expires: number,
  token: string,
): boolean {
  if (!Number.isFinite(expires) || expires < Math.floor(Date.now() / 1000)) {
    return false;
  }

  return safeEqualHex(sign(`kit:${registrationId}:${expires}`), token);
}
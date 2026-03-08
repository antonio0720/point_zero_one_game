// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/host-os/services/email-template-renderer.ts

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  buildTrackedClickUrl,
  buildTrackedOpenPixelUrl,
  buildUnsubscribeUrl,
} from './host-email-links';

export type HostEmailTemplateName =
  | 'kit-delivery.html'
  | 'host-followup-day3.html'
  | 'host-followup-day7.html';

export interface HostEmailTemplateContext {
  hostName: string;
  downloadUrl: string;
  waitlistUrl: string;
  hostDashboardUrl: string;
  socialShareUrl: string;
  unsubscribeRegistrationId: number;
}

export interface RenderedHostEmail {
  html: string;
  text: string;
}

const TEMPLATE_CACHE = new Map<HostEmailTemplateName, string>();

function getTemplatePath(templateName: HostEmailTemplateName): string {
  return path.join(__dirname, '..', 'assets', 'email', templateName);
}

async function loadTemplate(templateName: HostEmailTemplateName): Promise<string> {
  const cached = TEMPLATE_CACHE.get(templateName);
  if (cached) {
    return cached;
  }

  const filePath = getTemplatePath(templateName);
  const html = await readFile(filePath, 'utf8');
  TEMPLATE_CACHE.set(templateName, html);
  return html;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function replaceAll(source: string, token: string, value: string): string {
  return source.split(token).join(value);
}

export async function renderHostEmailTemplate(
  templateName: HostEmailTemplateName,
  messageId: string,
  context: HostEmailTemplateContext,
): Promise<RenderedHostEmail> {
  let html = await loadTemplate(templateName);

  const trackedLinks: Record<string, string> = {
    '{{DOWNLOAD_URL}}': buildTrackedClickUrl(
      messageId,
      'download',
      context.downloadUrl,
    ),
    '{{WAITLIST_URL}}': buildTrackedClickUrl(
      messageId,
      'waitlist',
      context.waitlistUrl,
    ),
    '{{HOST_DASHBOARD_URL}}': buildTrackedClickUrl(
      messageId,
      'dashboard',
      context.hostDashboardUrl,
    ),
    '{{SOCIAL_SHARE_URL}}': buildTrackedClickUrl(
      messageId,
      'social_share',
      context.socialShareUrl,
    ),
    '{{UNSUBSCRIBE_URL}}': buildUnsubscribeUrl(
      context.unsubscribeRegistrationId,
    ),
    '{{TRACKING_PIXEL}}': `<img src="${buildTrackedOpenPixelUrl(messageId)}" width="1" height="1" alt="" style="display:block;border:0;outline:none;text-decoration:none;" />`,
    '{{HOST_NAME}}': context.hostName,
  };

  for (const [token, value] of Object.entries(trackedLinks)) {
    html = replaceAll(html, token, value);
  }

  if (!html.includes('width="1" height="1"')) {
    html = html.replace(
      /<\/body>/i,
      `${trackedLinks['{{TRACKING_PIXEL}}']}</body>`,
    );
  }

  return {
    html,
    text: stripHtml(html),
  };
}
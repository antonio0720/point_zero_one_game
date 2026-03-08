// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/host-os/services/host-email-sequence.ts

import {
  type HostRegistration,
} from '../db/host-registrations';
import {
  createHostEmailMessage,
  listDueHostEmailMessages,
  markHostEmailFailed,
  markHostEmailSending,
  markHostEmailSent,
  markHostEmailSkipped,
  type HostEmailMessage,
} from '../db/host-email-events';
import {
  getHostRegistrationById,
} from '../db/host-registrations';
import {
  buildSignedKitDownloadRedirectUrl,
  getHostOsPublicBaseUrl,
} from './host-email-links';
import {
  renderHostEmailTemplate,
  type HostEmailTemplateContext,
  type HostEmailTemplateName,
} from './email-template-renderer';
import { sendHostEmail } from './host-email-sender';

export type HostSequenceStage =
  | 'kit-delivery'
  | 'host-followup-day3'
  | 'host-followup-day7';

interface StageDefinition {
  templateName: HostEmailTemplateName;
  subject: string;
  tags: string[];
  offsetDays: number;
  dedupeSuffix: string | null;
}

const STAGE_DEFINITIONS: Record<HostSequenceStage, StageDefinition> = {
  'kit-delivery': {
    templateName: 'kit-delivery.html',
    subject: 'Your Point Zero One Host OS Kit is ready',
    tags: ['kit-delivery', 'host-os'],
    offsetDays: 0,
    dedupeSuffix: null,
  },
  'host-followup-day3': {
    templateName: 'host-followup-day3.html',
    subject: 'Have you run your first Point Zero One night yet?',
    tags: ['host-followup-day3', 'host-os'],
    offsetDays: 3,
    dedupeSuffix: 'day3-v1',
  },
  'host-followup-day7': {
    templateName: 'host-followup-day7.html',
    subject: 'Night 2 checklist + 3 moment codes to try',
    tags: ['host-followup-day7', 'host-os'],
    offsetDays: 7,
    dedupeSuffix: 'day7-v1',
  },
};

function getBaseUrl(): string {
  return getHostOsPublicBaseUrl();
}

function buildTemplateContext(
  registration: HostRegistration,
): Record<string, unknown> {
  return {
    hostName: registration.name,
    downloadUrl: buildSignedKitDownloadRedirectUrl(registration.id),
    waitlistUrl: `${getBaseUrl()}/host/waitlist`,
    hostDashboardUrl: `${getBaseUrl()}/host`,
    socialShareUrl: `${getBaseUrl()}/host`,
    unsubscribeRegistrationId: registration.id,
  };
}

function buildScheduledDate(
  registration: HostRegistration,
  offsetDays: number,
): Date {
  const base = new Date(registration.last_downloaded_at);
  const date = new Date(base.getTime());
  date.setUTCDate(date.getUTCDate() + offsetDays);

  if (offsetDays > 0) {
    date.setUTCHours(15, 0, 0, 0);
  }

  return date;
}

function buildDedupeKey(
  registrationId: number,
  suffix: string | null,
): string | null {
  if (!suffix) {
    return null;
  }

  return `host-sequence:${registrationId}:${suffix}`;
}

export async function queueImmediateKitDeliveryEmail(
  registration: HostRegistration,
): Promise<HostEmailMessage> {
  const stage = STAGE_DEFINITIONS['kit-delivery'];

  return await createHostEmailMessage({
    registrationId: registration.id,
    dedupeKey: null,
    messageKey: 'kit-delivery',
    templateName: stage.templateName,
    subject: stage.subject,
    toEmail: registration.email,
    scheduledFor: new Date(),
    contextJson: buildTemplateContext(registration),
  });
}

export async function ensureHostFollowupSequence(
  registration: HostRegistration,
): Promise<void> {
  for (const stageKey of ['host-followup-day3', 'host-followup-day7'] as const) {
    const stage = STAGE_DEFINITIONS[stageKey];

    await createHostEmailMessage({
      registrationId: registration.id,
      dedupeKey: buildDedupeKey(registration.id, stage.dedupeSuffix),
      messageKey: stageKey,
      templateName: stage.templateName,
      subject: stage.subject,
      toEmail: registration.email,
      scheduledFor: buildScheduledDate(registration, stage.offsetDays),
      contextJson: buildTemplateContext(registration),
    });
  }
}

export async function queueFullHostSequence(
  registration: HostRegistration,
): Promise<HostEmailMessage> {
  const immediateMessage = await queueImmediateKitDeliveryEmail(registration);
  await ensureHostFollowupSequence(registration);
  return immediateMessage;
}

async function deliverHostEmailMessage(
  message: HostEmailMessage,
): Promise<void> {
  const claimed = await markHostEmailSending(message.id);
  if (!claimed) {
    return;
  }

  const registration = await getHostRegistrationById(message.registration_id);

  if (!registration) {
    await markHostEmailSkipped(message.id, 'Registration not found.');
    return;
  }

  if (registration.unsubscribed_at) {
    await markHostEmailSkipped(message.id, 'Registration unsubscribed.');
    return;
  }

  try {
    const context = (message.context_json ?? {}) as unknown as HostEmailTemplateContext;
    const rendered = await renderHostEmailTemplate(
      message.template_name as HostEmailTemplateName,
      message.id,
      context,
    );

    const definition = STAGE_DEFINITIONS[
      message.message_key as HostSequenceStage
    ];

    const sendResult = await sendHostEmail({
      to: message.to_email,
      subject: message.subject,
      html: rendered.html,
      text: rendered.text,
      tags: definition?.tags ?? ['host-os'],
      metadata: {
        messageId: message.id,
        registrationId: String(message.registration_id),
        template: message.template_name,
        sequenceKey: message.message_key,
      },
    });

    await markHostEmailSent(
      message.id,
      sendResult.provider,
      sendResult.messageId,
    );
  } catch (error) {
    const messageText =
      error instanceof Error ? error.message : 'Unknown email delivery error';

    await markHostEmailFailed(message.id, messageText);
  }
}

export async function sendMessageNow(
  message: HostEmailMessage,
): Promise<void> {
  await deliverHostEmailMessage(message);
}

export async function processDueHostEmails(
  limit = 50,
): Promise<{
  scanned: number;
  attempted: number;
}> {
  const due = await listDueHostEmailMessages(limit);

  let attempted = 0;

  for (const message of due) {
    attempted += 1;
    await deliverHostEmailMessage(message);
  }

  return {
    scanned: due.length,
    attempted,
  };
}
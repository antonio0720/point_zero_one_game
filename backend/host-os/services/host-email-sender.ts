// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/host-os/services/host-email-sender.ts

export interface SendHostEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  tags?: string[];
  metadata?: Record<string, string>;
}

export interface SendHostEmailResult {
  provider: string;
  messageId: string | null;
}

function getFromAddress(): string {
  return process.env.HOST_OS_EMAIL_FROM || 'Point Zero One Hosts <hosts@pointzeroonegame.com>';
}

function getReplyToAddress(): string | undefined {
  return process.env.HOST_OS_EMAIL_REPLY_TO || 'hosts@pointzeroonegame.com';
}

function getTransportMode(): 'resend' | 'webhook' | 'log' {
  const mode = (process.env.HOST_OS_EMAIL_TRANSPORT || 'resend').toLowerCase();

  if (mode === 'webhook' || mode === 'log') {
    return mode;
  }

  return 'resend';
}

async function sendViaResend(
  input: SendHostEmailInput,
): Promise<SendHostEmailResult> {
  const apiKey = process.env.HOST_OS_RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('Missing HOST_OS_RESEND_API_KEY for resend transport.');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: getFromAddress(),
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
      reply_to: getReplyToAddress(),
      tags: (input.tags ?? []).map((tag) => ({
        name: 'host-os',
        value: tag,
      })),
      headers: {
        'X-Host-OS': 'Point-Zero-One',
      },
    }),
  });

  const body = (await response.json().catch(() => ({}))) as {
    id?: string;
    message?: string;
  };

  if (!response.ok) {
    throw new Error(
      `Resend send failed with status ${response.status}: ${body.message ?? 'unknown error'}`,
    );
  }

  return {
    provider: 'resend',
    messageId: body.id ?? null,
  };
}

async function sendViaWebhook(
  input: SendHostEmailInput,
): Promise<SendHostEmailResult> {
  const webhookUrl = process.env.HOST_OS_EMAIL_WEBHOOK_URL;
  if (!webhookUrl) {
    throw new Error('Missing HOST_OS_EMAIL_WEBHOOK_URL for webhook transport.');
  }

  const apiKey = process.env.HOST_OS_EMAIL_WEBHOOK_API_KEY;

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      from: getFromAddress(),
      replyTo: getReplyToAddress(),
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      tags: input.tags ?? [],
      metadata: input.metadata ?? {},
    }),
  });

  const body = (await response.json().catch(() => ({}))) as {
    id?: string;
    messageId?: string;
    message?: string;
  };

  if (!response.ok) {
    throw new Error(
      `Webhook email send failed with status ${response.status}: ${body.message ?? 'unknown error'}`,
    );
  }

  return {
    provider: 'webhook',
    messageId: body.messageId ?? body.id ?? null,
  };
}

async function sendViaLog(
  input: SendHostEmailInput,
): Promise<SendHostEmailResult> {
  console.log('[host-os][email][log]', {
    to: input.to,
    subject: input.subject,
    textPreview: input.text.slice(0, 220),
  });

  return {
    provider: 'log',
    messageId: `log-${Date.now()}`,
  };
}

export async function sendHostEmail(
  input: SendHostEmailInput,
): Promise<SendHostEmailResult> {
  const mode = getTransportMode();

  if (mode === 'log') {
    return await sendViaLog(input);
  }

  if (mode === 'webhook') {
    return await sendViaWebhook(input);
  }

  return await sendViaResend(input);
}
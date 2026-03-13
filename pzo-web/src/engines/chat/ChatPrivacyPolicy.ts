
/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT ENGINE PRIVACY POLICY
 * FILE: pzo-web/src/engines/chat/ChatPrivacyPolicy.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical frontend privacy, safety, secrecy, and channel disclosure policy for
 * the unified chat engine.
 *
 * This file is intentionally deeper than a normal "sanitize text" helper.
 * Point Zero One chat is not generic social chat. It carries:
 *   - Deal Room negotiation receipts,
 *   - proof hashes,
 *   - public Global spectacle,
 *   - tighter Syndicate trust assumptions,
 *   - ambient NPC / helper / hater dialogue,
 *   - system-originated run metadata,
 *   - player-authored content that may accidentally expose personal or
 *     financial details during pressure spikes.
 *
 * The privacy problem here is therefore multi-layered:
 *   1. What should be blocked before a message leaves the client?
 *   2. What should be redacted or masked for local render only?
 *   3. What should be allowed in DEAL_ROOM if it is required for transaction
 *      semantics but should not be echoed casually in GLOBAL?
 *   4. How should exports, copies, and transcript views differ by channel?
 *   5. How do immutable proof-bearing messages stay immutable while still
 *      respecting render-time masking?
 *
 * Preserved repo truths
 * ---------------------
 * - Current chat types already model immutable / proofHash semantics for
 *   Deal Room recap cards.
 * - Current donor lanes already distinguish GLOBAL, SYNDICATE, and DEAL_ROOM.
 * - Existing donor brain treats chat as a real gameplay system with helpers,
 *   haters, and system messages — meaning not every message should be governed
 *   the same way.
 *
 * Design laws
 * -----------
 * - Privacy policy is not moderation. It is a stricter client-side disclosure
 *   discipline that runs before moderation and before transport.
 * - GLOBAL is the least trusted channel.
 * - SYNDICATE is trusted tactically, but not enough to allow secrets by default.
 * - DEAL_ROOM can carry certain transaction-bearing identifiers, but only under
 *   explicit narrow rules and with render-time masking where appropriate.
 * - System and server-authoritative proof messages may be render-masked without
 *   changing the canonical stored message body.
 * - Outbound decisions must be explainable and deterministic.
 * - Export and copy privileges are channel-aware and message-aware.
 *
 * Migration note
 * --------------
 * This file keeps local compatibility contracts until the final shared chat
 * contracts are moved to /shared/contracts/chat.
 *
 * Density6 LLC · Point Zero One · Production-first architecture
 * ============================================================================
 */

import {
  type ChatChannel,
  type ChatMessage,
} from './ChatSocketClient';

export type ChatPrivacyActorClass =
  | 'PLAYER'
  | 'NPC'
  | 'HELPER'
  | 'HATER'
  | 'SYSTEM'
  | 'SERVER';

export type ChatPrivacySeverity =
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL';

export type ChatPrivacyAction =
  | 'ALLOW'
  | 'WARN'
  | 'REDACT'
  | 'BLOCK';

export type ChatPrivacyRuleKind =
  | 'EMAIL'
  | 'PHONE'
  | 'SSN'
  | 'CREDIT_CARD'
  | 'BANK_ACCOUNT'
  | 'ROUTING_NUMBER'
  | 'CRYPTO_SEED'
  | 'API_KEY'
  | 'PASSWORD'
  | 'ADDRESS'
  | 'URL'
  | 'GEO_COORDINATE'
  | 'PROOF_HASH'
  | 'GOV_ID'
  | 'TAX_IDENTIFIER'
  | 'CREDENTIAL'
  | 'SELF_DOXXING'
  | 'THREAT_DISCLOSURE'
  | 'NEGOTIATION_DISCLOSURE'
  | 'FREEFORM_SECRET'
  | 'UNKNOWN';

export type ChatPrivacyViewMode =
  | 'COMPOSER'
  | 'FEED'
  | 'DRAWER'
  | 'NOTIFICATION'
  | 'EXPORT'
  | 'COPY';

export type ChatPrivacyCopyDecision =
  | 'ALLOW'
  | 'ALLOW_MASKED'
  | 'DENY';

export type ChatPrivacyExportDecision =
  | 'ALLOW'
  | 'ALLOW_MASKED'
  | 'DENY';

export interface ChatPrivacyFinding {
  kind: ChatPrivacyRuleKind;
  severity: ChatPrivacySeverity;
  action: ChatPrivacyAction;
  label: string;
  match: string;
  start: number;
  end: number;
  replacement?: string;
  channelScopedReason: string;
}

export interface ChatPrivacyDecision {
  actorClass: ChatPrivacyActorClass;
  channel: ChatChannel;
  action: ChatPrivacyAction;
  severity: ChatPrivacySeverity;
  findings: ChatPrivacyFinding[];
  originalBody: string;
  sanitizedBody: string;
  renderBody: string;
  canSend: boolean;
  canStoreRaw: boolean;
  canCopy: ChatPrivacyCopyDecision;
  canExport: ChatPrivacyExportDecision;
  requiresUserReview: boolean;
  explanation: string[];
}

export interface ChatPrivacyRenderView {
  messageId: string;
  channel: ChatChannel;
  viewMode: ChatPrivacyViewMode;
  body: string;
  wasMasked: boolean;
  findings: ChatPrivacyFinding[];
  canCopy: ChatPrivacyCopyDecision;
  canExport: ChatPrivacyExportDecision;
}

export interface ChatPrivacyPolicyCallbacks {
  onDecision?: (
    decision: ChatPrivacyDecision,
    context: Record<string, unknown>,
  ) => void;
  onError?: (error: Error, context?: Record<string, unknown>) => void;
}

export interface ChatPrivacyPolicyConfig {
  allowGlobalUrls?: boolean;
  allowDealRoomUrls?: boolean;
  allowDealRoomProofHashes?: boolean;
  allowDealRoomPartialBankingIdentifiers?: boolean;
  allowSyndicatePartialIdentifiers?: boolean;
  allowMaskedNotifications?: boolean;
  blockRawAddressesInGlobal?: boolean;
  blockSelfDoxxingInGlobal?: boolean;
  treatUnknownSecretsAsWarn?: boolean;
  preserveSystemBodiesForStorage?: boolean;
  maxMaskedPreviewLength?: number;
  log?: (message: string, context?: Record<string, unknown>) => void;
  warn?: (message: string, context?: Record<string, unknown>) => void;
  error?: (message: string, context?: Record<string, unknown>) => void;
}

export interface ChatPrivacyPolicyOptions {
  callbacks?: ChatPrivacyPolicyCallbacks;
  config?: ChatPrivacyPolicyConfig;
}

interface RuleDefinition {
  kind: ChatPrivacyRuleKind;
  label: string;
  regex: RegExp;
  severity: ChatPrivacySeverity;
  defaultAction: ChatPrivacyAction;
  replacement: string | ((match: string) => string);
}

const DEFAULT_CONFIG: Required<
  Pick<
    ChatPrivacyPolicyConfig,
    | 'allowGlobalUrls'
    | 'allowDealRoomUrls'
    | 'allowDealRoomProofHashes'
    | 'allowDealRoomPartialBankingIdentifiers'
    | 'allowSyndicatePartialIdentifiers'
    | 'allowMaskedNotifications'
    | 'blockRawAddressesInGlobal'
    | 'blockSelfDoxxingInGlobal'
    | 'treatUnknownSecretsAsWarn'
    | 'preserveSystemBodiesForStorage'
    | 'maxMaskedPreviewLength'
  >
> = {
  allowGlobalUrls: false,
  allowDealRoomUrls: true,
  allowDealRoomProofHashes: true,
  allowDealRoomPartialBankingIdentifiers: false,
  allowSyndicatePartialIdentifiers: false,
  allowMaskedNotifications: true,
  blockRawAddressesInGlobal: true,
  blockSelfDoxxingInGlobal: true,
  treatUnknownSecretsAsWarn: true,
  preserveSystemBodiesForStorage: true,
  maxMaskedPreviewLength: 160,
};

function nowLabel(): string {
  return new Date().toISOString();
}

function createError(message: string): Error {
  return new Error(`[ChatPrivacyPolicy] ${message}`);
}

function normalizeText(value: unknown): string {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim()
    : '';
}

function normalizeSearch(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

function clampPreview(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1))}…`;
}

function maskMiddle(match: string, visiblePrefix: number, visibleSuffix: number): string {
  const trimmed = normalizeText(match);
  if (trimmed.length <= visiblePrefix + visibleSuffix) {
    return '•'.repeat(Math.max(trimmed.length, 4));
  }

  const prefix = trimmed.slice(0, visiblePrefix);
  const suffix = trimmed.slice(trimmed.length - visibleSuffix);
  return `${prefix}${'•'.repeat(trimmed.length - visiblePrefix - visibleSuffix)}${suffix}`;
}

function replaceAllSlices(input: string, slices: Array<{ start: number; end: number; value: string }>): string {
  if (slices.length === 0) return input;

  const sorted = [...slices].sort((a, b) => a.start - b.start || a.end - b.end);
  let output = '';
  let cursor = 0;

  for (const slice of sorted) {
    if (slice.start < cursor) continue;
    output += input.slice(cursor, slice.start);
    output += slice.value;
    cursor = slice.end;
  }

  output += input.slice(cursor);
  return output;
}

function severityRank(severity: ChatPrivacySeverity): number {
  switch (severity) {
    case 'LOW': return 1;
    case 'MEDIUM': return 2;
    case 'HIGH': return 3;
    case 'CRITICAL': return 4;
    default: return 0;
  }
}

function stricterAction(left: ChatPrivacyAction, right: ChatPrivacyAction): ChatPrivacyAction {
  const rank = (value: ChatPrivacyAction): number => {
    switch (value) {
      case 'ALLOW': return 1;
      case 'WARN': return 2;
      case 'REDACT': return 3;
      case 'BLOCK': return 4;
      default: return 0;
    }
  };

  return rank(left) >= rank(right) ? left : right;
}

function inferActorClass(message: ChatMessage): ChatPrivacyActorClass {
  const sender = normalizeSearch(message.senderId);
  const kind = normalizeSearch(message.kind);

  if (sender === 'system' || kind === 'system' || kind === 'moderation') return 'SYSTEM';
  if (kind.includes('helper')) return 'HELPER';
  if (kind.includes('bot') || kind.includes('invasion')) return 'HATER';
  if (sender.startsWith('npc_')) return 'NPC';
  return 'PLAYER';
}

const RULES: RuleDefinition[] = [
  {
    kind: 'EMAIL',
    label: 'email address',
    regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    severity: 'HIGH',
    defaultAction: 'REDACT',
    replacement: (match) => maskMiddle(match, 2, 6),
  },
  {
    kind: 'PHONE',
    label: 'phone number',
    regex: /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g,
    severity: 'HIGH',
    defaultAction: 'REDACT',
    replacement: (match) => maskMiddle(match.replace(/\s+/g, ''), 2, 2),
  },
  {
    kind: 'SSN',
    label: 'social security number',
    regex: /\b\d{3}-\d{2}-\d{4}\b/g,
    severity: 'CRITICAL',
    defaultAction: 'BLOCK',
    replacement: '***-**-****',
  },
  {
    kind: 'CREDIT_CARD',
    label: 'payment card',
    regex: /\b(?:\d[ -]*?){13,19}\b/g,
    severity: 'CRITICAL',
    defaultAction: 'BLOCK',
    replacement: '**** **** **** ****',
  },
  {
    kind: 'BANK_ACCOUNT',
    label: 'bank account number',
    regex: /\b(?:acct|account|acc)\s*[:#-]?\s*\d{6,17}\b/gi,
    severity: 'CRITICAL',
    defaultAction: 'BLOCK',
    replacement: 'account ••••••••',
  },
  {
    kind: 'ROUTING_NUMBER',
    label: 'routing number',
    regex: /\b(?:routing|aba)\s*[:#-]?\s*\d{9}\b/gi,
    severity: 'CRITICAL',
    defaultAction: 'BLOCK',
    replacement: 'routing •••••••••',
  },
  {
    kind: 'CRYPTO_SEED',
    label: 'seed phrase',
    regex: /\b(?:seed phrase|mnemonic|wallet phrase)\b[:\s-]*([a-z]+(?:\s+[a-z]+){11,23})/gi,
    severity: 'CRITICAL',
    defaultAction: 'BLOCK',
    replacement: '[seed phrase blocked]',
  },
  {
    kind: 'API_KEY',
    label: 'API key or secret token',
    regex: /\b(?:sk_live|sk_test|rk_live|rk_test|ghp_|gho_|xox[pbar]-|AIza[0-9A-Za-z\-_]{10,}|AKIA[0-9A-Z]{16})[0-9A-Za-z\-_]*\b/g,
    severity: 'CRITICAL',
    defaultAction: 'BLOCK',
    replacement: '[secret token blocked]',
  },
  {
    kind: 'PASSWORD',
    label: 'password disclosure',
    regex: /\b(?:password|passcode|pwd)\b\s*[:=]\s*\S+/gi,
    severity: 'CRITICAL',
    defaultAction: 'BLOCK',
    replacement: 'password=[blocked]',
  },
  {
    kind: 'ADDRESS',
    label: 'street address',
    regex: /\b\d{1,6}\s+[A-Z0-9][A-Z0-9.\-'\s]{2,}\s(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd|court|ct|way)\b/gi,
    severity: 'HIGH',
    defaultAction: 'REDACT',
    replacement: '[address masked]',
  },
  {
    kind: 'URL',
    label: 'URL',
    regex: /\bhttps?:\/\/[^\s]+/gi,
    severity: 'MEDIUM',
    defaultAction: 'WARN',
    replacement: (match) => match,
  },
  {
    kind: 'GEO_COORDINATE',
    label: 'precise coordinates',
    regex: /\b-?\d{1,2}\.\d{4,},\s*-?\d{1,3}\.\d{4,}\b/g,
    severity: 'HIGH',
    defaultAction: 'REDACT',
    replacement: '[coordinates masked]',
  },
  {
    kind: 'PROOF_HASH',
    label: 'proof hash',
    regex: /\b(?:0x)?[a-f0-9]{32,128}\b/gi,
    severity: 'MEDIUM',
    defaultAction: 'WARN',
    replacement: (match) => maskMiddle(match, 6, 4),
  },
  {
    kind: 'GOV_ID',
    label: 'government ID',
    regex: /\b(?:driver'?s?\s*license|passport|state id)\b[:#-]?\s*[A-Z0-9-]{5,20}\b/gi,
    severity: 'CRITICAL',
    defaultAction: 'BLOCK',
    replacement: '[government id blocked]',
  },
  {
    kind: 'TAX_IDENTIFIER',
    label: 'tax identifier',
    regex: /\b(?:ein|itin|tin|tax id)\b[:#-]?\s*\d{2}-?\d{7}\b/gi,
    severity: 'CRITICAL',
    defaultAction: 'BLOCK',
    replacement: '[tax identifier blocked]',
  },
  {
    kind: 'CREDENTIAL',
    label: 'login credential',
    regex: /\b(?:username|login|email)\b\s*[:=]\s*\S+\s+\b(?:password|passcode|pwd)\b\s*[:=]\s*\S+/gi,
    severity: 'CRITICAL',
    defaultAction: 'BLOCK',
    replacement: '[credential block]',
  },
];

const SELF_DOXX_KEYWORDS = [
  'my home address is',
  'come to my house at',
  'my ssn is',
  'my social is',
  'my bank account is',
  'my phone number is',
  'my email is',
  'my password is',
  'my seed phrase is',
  'my routing number is',
];

const THREAT_DISCLOSURE_KEYWORDS = [
  'send me your password',
  'wire it to this account',
  'give me your seed phrase',
  'drop your social',
  'post your home address',
];

const NEGOTIATION_DISCLOSURE_KEYWORDS = [
  'wire instructions',
  'routing and account',
  'full legal name and address',
  'escrow release password',
  'bank login',
];

export class ChatPrivacyPolicy {
  private readonly callbacks: ChatPrivacyPolicyCallbacks;
  private readonly config: ChatPrivacyPolicyConfig & typeof DEFAULT_CONFIG;

  constructor(options: ChatPrivacyPolicyOptions = {}) {
    this.callbacks = options.callbacks ?? {};
    this.config = {
      ...DEFAULT_CONFIG,
      ...(options.config ?? {}),
    };
  }

  // ---------------------------------------------------------------------------
  // Public outbound policy
  // ---------------------------------------------------------------------------

  public inspectOutboundDraft(input: {
    channel: ChatChannel;
    body: string;
    actorClass?: ChatPrivacyActorClass;
    metadata?: Record<string, unknown>;
  }): ChatPrivacyDecision {
    const actorClass = input.actorClass ?? 'PLAYER';
    const originalBody = normalizeText(input.body);
    const findings = this.detectFindings(originalBody, input.channel, actorClass, 'COMPOSER', input.metadata);
    const decision = this.finalizeDecision({
      actorClass,
      channel: input.channel,
      originalBody,
      findings,
      sourceView: 'COMPOSER',
    });

    this.callbacks.onDecision?.(decision, {
      stage: 'outbound',
      ts: nowLabel(),
      metadata: input.metadata,
    });

    return decision;
  }

  public sanitizeOutboundDraft(input: {
    channel: ChatChannel;
    body: string;
    actorClass?: ChatPrivacyActorClass;
    metadata?: Record<string, unknown>;
  }): string {
    return this.inspectOutboundDraft(input).sanitizedBody;
  }

  public canSend(input: {
    channel: ChatChannel;
    body: string;
    actorClass?: ChatPrivacyActorClass;
    metadata?: Record<string, unknown>;
  }): boolean {
    return this.inspectOutboundDraft(input).canSend;
  }

  // ---------------------------------------------------------------------------
  // Public inbound / render policy
  // ---------------------------------------------------------------------------

  public inspectMessageForRender(input: {
    message: ChatMessage;
    viewMode: ChatPrivacyViewMode;
  }): ChatPrivacyDecision {
    const actorClass = inferActorClass(input.message);
    const originalBody = normalizeText(input.message.body);
    const findings = this.detectFindings(
      originalBody,
      input.message.channel,
      actorClass,
      input.viewMode,
      input.message.metadata,
    );

    const decision = this.finalizeDecision({
      actorClass,
      channel: input.message.channel,
      originalBody,
      findings,
      sourceView: input.viewMode,
      immutable: Boolean(input.message.immutable),
      proofHash: normalizeText(input.message.proofHash) || undefined,
      kind: normalizeText(input.message.kind),
    });

    this.callbacks.onDecision?.(decision, {
      stage: 'render',
      messageId: input.message.id,
      ts: nowLabel(),
    });

    return decision;
  }

  public buildRenderView(input: {
    message: ChatMessage;
    viewMode: ChatPrivacyViewMode;
  }): ChatPrivacyRenderView {
    const decision = this.inspectMessageForRender(input);

    return {
      messageId: input.message.id,
      channel: input.message.channel,
      viewMode: input.viewMode,
      body: decision.renderBody,
      wasMasked: decision.renderBody !== decision.originalBody,
      findings: decision.findings,
      canCopy: decision.canCopy,
      canExport: decision.canExport,
    };
  }

  public applyRenderMask(message: ChatMessage, viewMode: ChatPrivacyViewMode): string {
    return this.buildRenderView({ message, viewMode }).body;
  }

  public inspectCopy(message: ChatMessage): ChatPrivacyDecision {
    return this.inspectMessageForRender({ message, viewMode: 'COPY' });
  }

  public inspectExport(message: ChatMessage): ChatPrivacyDecision {
    return this.inspectMessageForRender({ message, viewMode: 'EXPORT' });
  }

  public inspectNotification(message: ChatMessage): ChatPrivacyDecision {
    return this.inspectMessageForRender({ message, viewMode: 'NOTIFICATION' });
  }

  // ---------------------------------------------------------------------------
  // Internal detection
  // ---------------------------------------------------------------------------

  private detectFindings(
    body: string,
    channel: ChatChannel,
    actorClass: ChatPrivacyActorClass,
    viewMode: ChatPrivacyViewMode,
    metadata?: Record<string, unknown>,
  ): ChatPrivacyFinding[] {
    const findings: ChatPrivacyFinding[] = [];
    const push = (finding: ChatPrivacyFinding): void => {
      findings.push(this.applyChannelRules(finding, channel, actorClass, viewMode));
    };

    for (const rule of RULES) {
      const matches = body.matchAll(rule.regex);
      for (const match of matches) {
        if (!match[0]) continue;
        push({
          kind: rule.kind,
          severity: rule.severity,
          action: rule.defaultAction,
          label: rule.label,
          match: match[0],
          start: match.index ?? 0,
          end: (match.index ?? 0) + match[0].length,
          replacement: typeof rule.replacement === 'function'
            ? rule.replacement(match[0])
            : rule.replacement,
          channelScopedReason: `${rule.kind.toLowerCase()} detected`,
        });
      }
    }

    const lower = normalizeSearch(body);

    for (const phrase of SELF_DOXX_KEYWORDS) {
      const index = lower.indexOf(phrase);
      if (index >= 0) {
        push({
          kind: 'SELF_DOXXING',
          severity: 'HIGH',
          action: this.config.blockSelfDoxxingInGlobal && channel === 'GLOBAL'
            ? 'BLOCK'
            : 'WARN',
          label: 'self-doxxing phrase',
          match: body.slice(index, Math.min(index + phrase.length + 40, body.length)),
          start: index,
          end: Math.min(index + phrase.length + 40, body.length),
          replacement: '[personal disclosure masked]',
          channelScopedReason: 'self-doxxing phrase detected',
        });
      }
    }

    for (const phrase of THREAT_DISCLOSURE_KEYWORDS) {
      const index = lower.indexOf(phrase);
      if (index >= 0) {
        push({
          kind: 'THREAT_DISCLOSURE',
          severity: 'HIGH',
          action: 'BLOCK',
          label: 'dangerous disclosure request',
          match: body.slice(index, Math.min(index + phrase.length + 40, body.length)),
          start: index,
          end: Math.min(index + phrase.length + 40, body.length),
          replacement: '[dangerous request blocked]',
          channelScopedReason: 'request for dangerous disclosure',
        });
      }
    }

    for (const phrase of NEGOTIATION_DISCLOSURE_KEYWORDS) {
      const index = lower.indexOf(phrase);
      if (index >= 0) {
        push({
          kind: 'NEGOTIATION_DISCLOSURE',
          severity: channel === 'DEAL_ROOM' ? 'MEDIUM' : 'HIGH',
          action: channel === 'DEAL_ROOM' ? 'WARN' : 'BLOCK',
          label: 'negotiation disclosure phrase',
          match: body.slice(index, Math.min(index + phrase.length + 40, body.length)),
          start: index,
          end: Math.min(index + phrase.length + 40, body.length),
          replacement: '[sensitive negotiation detail masked]',
          channelScopedReason: 'negotiation-sensitive phrase',
        });
      }
    }

    const metadataString = normalizeSearch(JSON.stringify(metadata ?? {}));
    if (this.config.treatUnknownSecretsAsWarn) {
      const secretHints = ['private key', 'secret', 'token', 'credential', 'vault', 'seed'];
      const hit = secretHints.find((hint) => lower.includes(hint) || metadataString.includes(hint));
      if (hit) {
        push({
          kind: 'FREEFORM_SECRET',
          severity: 'MEDIUM',
          action: 'WARN',
          label: 'freeform secret hint',
          match: hit,
          start: lower.indexOf(hit),
          end: lower.indexOf(hit) + hit.length,
          replacement: '[secret-like content reviewed]',
          channelScopedReason: 'freeform secret-like hint',
        });
      }
    }

    return findings;
  }

  private applyChannelRules(
    finding: ChatPrivacyFinding,
    channel: ChatChannel,
    actorClass: ChatPrivacyActorClass,
    viewMode: ChatPrivacyViewMode,
  ): ChatPrivacyFinding {
    const next: ChatPrivacyFinding = { ...finding };

    if (actorClass === 'SYSTEM' || actorClass === 'SERVER') {
      if (this.config.preserveSystemBodiesForStorage) {
        if (viewMode === 'FEED' || viewMode === 'DRAWER') {
          if (finding.kind === 'PROOF_HASH' && channel === 'DEAL_ROOM' && this.config.allowDealRoomProofHashes) {
            next.action = 'ALLOW';
            next.channelScopedReason = 'system proof hash allowed in deal room';
          } else if (finding.kind !== 'SSN' && finding.kind !== 'CREDIT_CARD') {
            next.action = 'WARN';
            next.channelScopedReason = 'system-originated content downgraded to warn';
          }
        }
      }
    }

    switch (channel) {
      case 'GLOBAL':
        if (finding.kind === 'URL' && !this.config.allowGlobalUrls) {
          next.action = stricterAction(next.action, 'WARN');
          next.channelScopedReason = 'urls discouraged in global';
        }
        if (finding.kind === 'ADDRESS' && this.config.blockRawAddressesInGlobal) {
          next.action = 'BLOCK';
          next.channelScopedReason = 'addresses blocked in global';
        }
        if (finding.kind === 'PROOF_HASH') {
          next.action = stricterAction(next.action, 'REDACT');
          next.channelScopedReason = 'proof hashes masked in global';
        }
        if (
          finding.kind === 'BANK_ACCOUNT' ||
          finding.kind === 'ROUTING_NUMBER' ||
          finding.kind === 'GOV_ID' ||
          finding.kind === 'TAX_IDENTIFIER'
        ) {
          next.action = 'BLOCK';
          next.channelScopedReason = 'regulated identifier blocked in global';
        }
        break;

      case 'SYNDICATE':
        if (
          (finding.kind === 'EMAIL' || finding.kind === 'PHONE') &&
          this.config.allowSyndicatePartialIdentifiers
        ) {
          next.action = stricterAction('WARN', next.action === 'BLOCK' ? 'BLOCK' : 'WARN');
          next.channelScopedReason = 'syndicate allows review but not raw disclosure';
        }
        if (finding.kind === 'PROOF_HASH') {
          next.action = 'WARN';
          next.channelScopedReason = 'proof hash review required in syndicate';
        }
        break;

      case 'DEAL_ROOM':
        if (finding.kind === 'URL' && this.config.allowDealRoomUrls) {
          next.action = 'ALLOW';
          next.channelScopedReason = 'deal room allows urls';
        }
        if (finding.kind === 'PROOF_HASH' && this.config.allowDealRoomProofHashes) {
          next.action = 'ALLOW';
          next.channelScopedReason = 'deal room allows proof hashes';
        }
        if (
          (finding.kind === 'BANK_ACCOUNT' || finding.kind === 'ROUTING_NUMBER') &&
          this.config.allowDealRoomPartialBankingIdentifiers
        ) {
          next.action = 'REDACT';
          next.channelScopedReason = 'deal room allows masked banking identifiers only';
        }
        break;

      case 'LOBBY':
        if (finding.kind === 'URL') {
          next.action = 'WARN';
          next.channelScopedReason = 'lobby keeps urls under review';
        }
        if (finding.kind === 'PROOF_HASH') {
          next.action = 'REDACT';
          next.channelScopedReason = 'proof hashes hidden in lobby';
        }
        break;
    }

    if (viewMode === 'NOTIFICATION') {
      if (!this.config.allowMaskedNotifications && next.action !== 'ALLOW') {
        next.action = 'BLOCK';
        next.channelScopedReason = 'notification view blocks sensitive content';
      } else if (next.action === 'BLOCK') {
        next.action = 'REDACT';
        next.channelScopedReason = 'notification downgraded to masked preview';
      }
    }

    if (viewMode === 'COPY' || viewMode === 'EXPORT') {
      if (next.action === 'WARN') {
        next.action = 'REDACT';
        next.channelScopedReason = `${viewMode.toLowerCase()} requires masking`;
      }
    }

    return next;
  }

  // ---------------------------------------------------------------------------
  // Internal decision assembly
  // ---------------------------------------------------------------------------

  private finalizeDecision(input: {
    actorClass: ChatPrivacyActorClass;
    channel: ChatChannel;
    originalBody: string;
    findings: ChatPrivacyFinding[];
    sourceView: ChatPrivacyViewMode;
    immutable?: boolean;
    proofHash?: string;
    kind?: string;
  }): ChatPrivacyDecision {
    const { findings, originalBody, channel, actorClass, sourceView } = input;

    let action: ChatPrivacyAction = 'ALLOW';
    let severity: ChatPrivacySeverity = 'LOW';

    for (const finding of findings) {
      action = stricterAction(action, finding.action);
      if (severityRank(finding.severity) > severityRank(severity)) {
        severity = finding.severity;
      }
    }

    const slices: Array<{ start: number; end: number; value: string }> = [];
    for (const finding of findings) {
      if (finding.action === 'REDACT' || finding.action === 'BLOCK') {
        slices.push({
          start: finding.start,
          end: finding.end,
          value: finding.replacement ?? '[redacted]',
        });
      }
    }

    const sanitizedBody = replaceAllSlices(originalBody, slices);
    let renderBody = sanitizedBody;

    if (sourceView === 'NOTIFICATION') {
      renderBody = clampPreview(sanitizedBody, this.config.maxMaskedPreviewLength);
    } else if (sourceView === 'COPY' || sourceView === 'EXPORT') {
      renderBody = sanitizedBody;
    } else if (
      sourceView === 'FEED' &&
      input.immutable &&
      input.proofHash &&
      channel === 'DEAL_ROOM' &&
      this.config.allowDealRoomProofHashes
    ) {
      renderBody = sanitizedBody;
    }

    const explanation: string[] = [];
    if (findings.length === 0) {
      explanation.push('No privacy findings detected.');
    } else {
      for (const finding of findings) {
        explanation.push(
          `${finding.label}: ${finding.channelScopedReason} (${finding.action.toLowerCase()})`,
        );
      }
    }

    if (input.immutable) {
      explanation.push('Message flagged immutable; masking applies to render/copy/export views, not canonical storage semantics.');
    }
    if (input.kind && normalizeSearch(input.kind).includes('deal')) {
      explanation.push('Deal Room/recap semantics preserved where channel rules permit.');
    }

    const canSend = action !== 'BLOCK' || actorClass === 'SYSTEM' || actorClass === 'SERVER';
    const canStoreRaw = actorClass === 'SYSTEM' || actorClass === 'SERVER'
      ? this.config.preserveSystemBodiesForStorage
      : action !== 'BLOCK';

    const canCopy = this.decideCopy(channel, action, findings, sourceView);
    const canExport = this.decideExport(channel, action, findings, sourceView);

    return {
      actorClass,
      channel,
      action,
      severity,
      findings,
      originalBody,
      sanitizedBody,
      renderBody,
      canSend,
      canStoreRaw,
      canCopy,
      canExport,
      requiresUserReview: action === 'WARN' || action === 'REDACT',
      explanation,
    };
  }

  private decideCopy(
    channel: ChatChannel,
    action: ChatPrivacyAction,
    findings: ChatPrivacyFinding[],
    sourceView: ChatPrivacyViewMode,
  ): ChatPrivacyCopyDecision {
    if (sourceView !== 'COPY' && sourceView !== 'FEED' && sourceView !== 'DRAWER') {
      return action === 'ALLOW' ? 'ALLOW' : 'ALLOW_MASKED';
    }

    if (action === 'BLOCK') return 'DENY';
    if (action === 'REDACT') return 'ALLOW_MASKED';
    if (action === 'WARN') {
      if (channel === 'DEAL_ROOM' && findings.some((finding) => finding.kind === 'PROOF_HASH')) {
        return 'ALLOW_MASKED';
      }
      return 'ALLOW_MASKED';
    }
    return 'ALLOW';
  }

  private decideExport(
    channel: ChatChannel,
    action: ChatPrivacyAction,
    findings: ChatPrivacyFinding[],
    sourceView: ChatPrivacyViewMode,
  ): ChatPrivacyExportDecision {
    if (sourceView !== 'EXPORT' && sourceView !== 'FEED' && sourceView !== 'DRAWER') {
      return action === 'ALLOW' ? 'ALLOW' : 'ALLOW_MASKED';
    }

    if (action === 'BLOCK') return 'DENY';
    if (action === 'REDACT') return 'ALLOW_MASKED';

    if (action === 'WARN') {
      if (
        channel === 'GLOBAL' &&
        findings.some((finding) => finding.kind === 'PROOF_HASH' || finding.kind === 'URL')
      ) {
        return 'ALLOW_MASKED';
      }
      return 'ALLOW_MASKED';
    }

    return 'ALLOW';
  }
}

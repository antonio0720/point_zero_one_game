/**
 * Creator Security
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/security/creator_security.ts
 *
 * Production-ready creator security primitive used by tests and can be
 * promoted into route/service middleware later.
 *
 * Security coverage:
 * - signed creator auth tokens
 * - opaque resource lookup semantics to resist enumeration
 * - timing-safe receipt integrity verification
 * - deterministic helpers for tests and local development
 *
 * Density6 LLC · Point Zero One · Confidential
 */

import * as crypto from 'crypto';

export type CreatorScope =
  | 'creator:read'
  | 'creator:write'
  | 'creator:receipts:read'
  | 'creator:receipts:write'
  | 'creator:admin';

export type CreatorResourceKind =
  | 'submission'
  | 'receipt'
  | 'asset'
  | 'pack'
  | 'profile';

export type CreatorResourceVisibility = 'private' | 'public';

export interface CreatorSecurityOptions {
  authSecret?: string;
  receiptSecret?: string;
  defaultTokenTtlSeconds?: number;
  now?: () => number;
}

export interface CreatorTokenClaims {
  sub: string;
  scopes: CreatorScope[];
  iat: number;
  exp: number;
  jti: string;
}

export interface AuthenticatedCreatorContext {
  creatorId: string;
  scopes: CreatorScope[];
  issuedAt: number;
  expiresAt: number;
  tokenId: string;
}

export interface CreatorResource {
  resourceId: string;
  ownerCreatorId: string;
  kind: CreatorResourceKind;
  visibility: CreatorResourceVisibility;
  payload: Record<string, unknown>;
}

export interface SafeCreatorResource {
  resourceId: string;
  kind: CreatorResourceKind;
  visibility: CreatorResourceVisibility;
  payload: Record<string, unknown>;
}

export interface CreatorResourceResponse {
  status: 200 | 404;
  publicCode: 'RESOURCE_OK' | 'RESOURCE_NOT_FOUND';
  opaqueRequestId: string;
  retryAfterSeconds: number;
  body: {
    message: string;
    resource: SafeCreatorResource | null;
  };
}

export interface UnsignedCreatorReceipt {
  receiptId: string;
  creatorId: string;
  subjectId: string;
  amountCents: number;
  currency: string;
  issuedAt: number;
  nonce: string;
}

export interface CreatorReceipt extends UnsignedCreatorReceipt {
  signature: string;
}

export class CreatorSecurity {
  private readonly authSecret: string;
  private readonly receiptSecret: string;
  private readonly defaultTokenTtlSeconds: number;
  private readonly now: () => number;
  private readonly resources = new Map<string, CreatorResource>();
  private requestCounter = 0;

  constructor(options: CreatorSecurityOptions = {}) {
    this.authSecret =
      options.authSecret ??
      process.env.PZO_CREATOR_AUTH_SECRET ??
      'pzo-local-dev-auth-secret-change-me';

    this.receiptSecret =
      options.receiptSecret ??
      process.env.PZO_CREATOR_RECEIPT_SECRET ??
      'pzo-local-dev-receipt-secret-change-me';

    this.defaultTokenTtlSeconds = Math.max(
      60,
      options.defaultTokenTtlSeconds ?? 60 * 15,
    );

    this.now = options.now ?? (() => Date.now());
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Token helpers
  // ────────────────────────────────────────────────────────────────────────────

  issueToken(input: {
    creatorId: string;
    scopes: CreatorScope[];
    ttlSeconds?: number;
    jti?: string;
  }): string {
    this.assertNonEmptyString(input.creatorId, 'creatorId');

    const nowSeconds = Math.floor(this.now() / 1000);
    const ttlSeconds = Math.max(60, input.ttlSeconds ?? this.defaultTokenTtlSeconds);

    const claims: CreatorTokenClaims = {
      sub: input.creatorId,
      scopes: [...input.scopes],
      iat: nowSeconds,
      exp: nowSeconds + ttlSeconds,
      jti: input.jti ?? this.randomId('ctok'),
    };

    const payloadSegment = this.toBase64Url(
      JSON.stringify(claims),
    );
    const signatureSegment = this.sign(payloadSegment, this.authSecret);

    return `pzoct.${payloadSegment}.${signatureSegment}`;
  }

  async authenticate(token: string): Promise<AuthenticatedCreatorContext> {
    if (typeof token !== 'string' || !token.trim()) {
      throw new Error('Unauthorized');
    }

    const parts = token.split('.');
    if (parts.length !== 3 || parts[0] !== 'pzoct') {
      throw new Error('Unauthorized');
    }

    const payloadSegment = parts[1];
    const signatureSegment = parts[2];
    const expectedSignature = this.sign(payloadSegment, this.authSecret);

    if (!this.safeEqual(signatureSegment, expectedSignature)) {
      throw new Error('Unauthorized');
    }

    let claims: CreatorTokenClaims;
    try {
      const decoded = Buffer.from(payloadSegment, 'base64url').toString('utf8');
      claims = JSON.parse(decoded) as CreatorTokenClaims;
    } catch {
      throw new Error('Unauthorized');
    }

    if (
      !claims ||
      typeof claims.sub !== 'string' ||
      !Array.isArray(claims.scopes) ||
      typeof claims.iat !== 'number' ||
      typeof claims.exp !== 'number' ||
      typeof claims.jti !== 'string'
    ) {
      throw new Error('Unauthorized');
    }

    const nowSeconds = Math.floor(this.now() / 1000);
    if (claims.exp <= nowSeconds) {
      throw new Error('Token expired');
    }

    return {
      creatorId: claims.sub,
      scopes: [...claims.scopes],
      issuedAt: claims.iat,
      expiresAt: claims.exp,
      tokenId: claims.jti,
    };
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Resource registration + enumeration-resistant lookup
  // ────────────────────────────────────────────────────────────────────────────

  registerResource(resource: CreatorResource): void {
    this.assertNonEmptyString(resource.resourceId, 'resourceId');
    this.assertNonEmptyString(resource.ownerCreatorId, 'ownerCreatorId');

    this.resources.set(resource.resourceId, {
      resourceId: resource.resourceId,
      ownerCreatorId: resource.ownerCreatorId,
      kind: resource.kind,
      visibility: resource.visibility,
      payload: this.deepCopy(resource.payload),
    });
  }

  async getResource(
    resourceId: string | number,
    token: string,
  ): Promise<CreatorResourceResponse> {
    const normalizedResourceId = String(resourceId);
    const opaqueRequestId = this.buildOpaqueRequestId(normalizedResourceId);

    let actor: AuthenticatedCreatorContext | null = null;
    try {
      actor = await this.authenticate(token);
    } catch {
      return this.buildNotFoundResponse(opaqueRequestId);
    }

    const resource = this.resources.get(normalizedResourceId);
    if (!resource) {
      return this.buildNotFoundResponse(opaqueRequestId);
    }

    const canRead =
      resource.visibility === 'public' ||
      resource.ownerCreatorId === actor.creatorId ||
      actor.scopes.includes('creator:admin');

    if (!canRead) {
      return this.buildNotFoundResponse(opaqueRequestId);
    }

    return {
      status: 200,
      publicCode: 'RESOURCE_OK',
      opaqueRequestId,
      retryAfterSeconds: 0,
      body: {
        message: 'Creator resource retrieved.',
        resource: {
          resourceId: resource.resourceId,
          kind: resource.kind,
          visibility: resource.visibility,
          payload: this.deepCopy(resource.payload),
        },
      },
    };
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Receipt signing + integrity verification
  // ────────────────────────────────────────────────────────────────────────────

  issueReceipt(input: {
    receiptId: string;
    creatorId: string;
    subjectId: string;
    amountCents: number;
    currency: string;
    nonce?: string;
    issuedAt?: number;
  }): CreatorReceipt {
    const unsigned: UnsignedCreatorReceipt = {
      receiptId: this.requireString(input.receiptId, 'receiptId'),
      creatorId: this.requireString(input.creatorId, 'creatorId'),
      subjectId: this.requireString(input.subjectId, 'subjectId'),
      amountCents: this.requireAmountCents(input.amountCents, 'amountCents'),
      currency: this.requireCurrency(input.currency),
      issuedAt: input.issuedAt ?? Math.floor(this.now() / 1000),
      nonce: input.nonce ?? this.randomId('rnonce'),
    };

    const signature = this.signReceipt(unsigned);
    return { ...unsigned, signature };
  }

  async verifyReceipt(receipt: CreatorReceipt): Promise<boolean> {
    this.assertReceiptShape(receipt);

    const unsigned: UnsignedCreatorReceipt = {
      receiptId: receipt.receiptId,
      creatorId: receipt.creatorId,
      subjectId: receipt.subjectId,
      amountCents: receipt.amountCents,
      currency: receipt.currency,
      issuedAt: receipt.issuedAt,
      nonce: receipt.nonce,
    };

    const expectedSignature = this.signReceipt(unsigned);

    if (!this.safeEqual(receipt.signature, expectedSignature)) {
      throw new Error('Receipt signature mismatch');
    }

    const nowSeconds = Math.floor(this.now() / 1000);

    if (receipt.issuedAt > nowSeconds + 300) {
      throw new Error('Receipt issuedAt is in the future');
    }

    return true;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Internal helpers
  // ────────────────────────────────────────────────────────────────────────────

  private buildNotFoundResponse(
    opaqueRequestId: string,
  ): CreatorResourceResponse {
    return {
      status: 404,
      publicCode: 'RESOURCE_NOT_FOUND',
      opaqueRequestId,
      retryAfterSeconds: 0,
      body: {
        message: 'Creator resource was not found.',
        resource: null,
      },
    };
  }

  private buildOpaqueRequestId(resourceId: string): string {
    this.requestCounter += 1;

    const material = [
      resourceId,
      String(this.requestCounter),
      String(this.now()),
      this.randomId('salt'),
    ].join(':');

    return `req_${this.hash(material).slice(0, 24)}`;
  }

  private signReceipt(unsigned: UnsignedCreatorReceipt): string {
    return this.sign(this.canonicalizeReceipt(unsigned), this.receiptSecret);
  }

  private canonicalizeReceipt(unsigned: UnsignedCreatorReceipt): string {
    return JSON.stringify({
      receiptId: unsigned.receiptId,
      creatorId: unsigned.creatorId,
      subjectId: unsigned.subjectId,
      amountCents: unsigned.amountCents,
      currency: unsigned.currency,
      issuedAt: unsigned.issuedAt,
      nonce: unsigned.nonce,
    });
  }

  private sign(input: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(input)
      .digest('base64url');
  }

  private safeEqual(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);

    if (leftBuffer.length !== rightBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(leftBuffer, rightBuffer);
  }

  private hash(input: string): string {
    return crypto.createHash('sha256').update(input).digest('hex');
  }

  private toBase64Url(input: string): string {
    return Buffer.from(input, 'utf8').toString('base64url');
  }

  private randomId(prefix: string): string {
    return `${prefix}_${crypto.randomBytes(12).toString('hex')}`;
  }

  private deepCopy<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }

  private assertReceiptShape(receipt: CreatorReceipt): void {
    this.requireString(receipt.receiptId, 'receiptId');
    this.requireString(receipt.creatorId, 'creatorId');
    this.requireString(receipt.subjectId, 'subjectId');
    this.requireAmountCents(receipt.amountCents, 'amountCents');
    this.requireCurrency(receipt.currency);
    this.requireString(receipt.nonce, 'nonce');
    this.requireString(receipt.signature, 'signature');

    if (
      typeof receipt.issuedAt !== 'number' ||
      !Number.isFinite(receipt.issuedAt) ||
      receipt.issuedAt <= 0
    ) {
      throw new Error('Invalid receipt issuedAt');
    }
  }

  private requireString(value: unknown, fieldName: string): string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(`Invalid ${fieldName}`);
    }

    return value.trim();
  }

  private requireCurrency(value: unknown): string {
    if (typeof value !== 'string') {
      throw new Error('Invalid currency');
    }

    const normalized = value.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(normalized)) {
      throw new Error('Invalid currency');
    }

    return normalized;
  }

  private requireAmountCents(value: unknown, fieldName: string): number {
    if (
      typeof value !== 'number' ||
      !Number.isInteger(value) ||
      value < 0
    ) {
      throw new Error(`Invalid ${fieldName}`);
    }

    return value;
  }

  private assertNonEmptyString(value: unknown, fieldName: string): void {
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(`Invalid ${fieldName}`);
    }
  }
}
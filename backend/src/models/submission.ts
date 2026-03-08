/**
 * Submission Domain Model
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/models/submission.ts
 *
 * Runtime-safe submission model used by creator security middleware.
 * This file exists because backend/src/security/creator_submission_hardening.ts
 * imports ../models/submission and needs a concrete runtime value, not just a type.
 *
 * Density6 LLC · Point Zero One · Confidential
 */

export type SubmissionStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'published'
  | 'archived';

export type SubmissionVisibility = 'private' | 'unlisted' | 'public';

export type SubmissionKind =
  | 'ugc'
  | 'deck'
  | 'scenario'
  | 'map'
  | 'curriculum'
  | 'asset'
  | 'other';

export interface SubmissionProps {
  id: string;
  creatorId: string;
  title: string;
  kind: SubmissionKind;
  status: SubmissionStatus;
  visibility: SubmissionVisibility;
  contentHash: string | null;
  signedLookupId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  metadata: Record<string, unknown>;
}

export class Submission {
  id: string;
  creatorId: string;
  title: string;
  kind: SubmissionKind;
  status: SubmissionStatus;
  visibility: SubmissionVisibility;
  contentHash: string | null;
  signedLookupId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  metadata: Record<string, unknown>;

  constructor(props: SubmissionProps) {
    this.id = props.id;
    this.creatorId = props.creatorId;
    this.title = props.title;
    this.kind = props.kind;
    this.status = props.status;
    this.visibility = props.visibility;
    this.contentHash = props.contentHash;
    this.signedLookupId = props.signedLookupId;
    this.version = props.version;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.publishedAt = props.publishedAt;
    this.metadata = { ...props.metadata };
  }

  static create(
    props: Partial<SubmissionProps> &
      Pick<SubmissionProps, 'id' | 'creatorId' | 'title'>,
  ): Submission {
    const nowIso = new Date().toISOString();

    return new Submission({
      id: String(props.id),
      creatorId: String(props.creatorId),
      title: String(props.title),
      kind: Submission.normalizeKind(props.kind),
      status: Submission.normalizeStatus(props.status),
      visibility: Submission.normalizeVisibility(props.visibility),
      contentHash:
        typeof props.contentHash === 'string' ? props.contentHash : null,
      signedLookupId:
        typeof props.signedLookupId === 'string' ? props.signedLookupId : null,
      version:
        typeof props.version === 'number' && Number.isFinite(props.version)
          ? Math.max(1, Math.floor(props.version))
          : 1,
      createdAt:
        typeof props.createdAt === 'string' && props.createdAt.trim()
          ? props.createdAt
          : nowIso,
      updatedAt:
        typeof props.updatedAt === 'string' && props.updatedAt.trim()
          ? props.updatedAt
          : nowIso,
      publishedAt:
        typeof props.publishedAt === 'string' && props.publishedAt.trim()
          ? props.publishedAt
          : null,
      metadata: Submission.normalizeMetadata(props.metadata),
    });
  }

  static fromUnknown(input: unknown): Submission | null {
    if (input instanceof Submission) {
      return new Submission(input.toInternalJSON());
    }

    if (!Submission.isRecord(input)) {
      return null;
    }

    const id = Submission.readString(input.id);
    const creatorId = Submission.readString(input.creatorId);
    const title = Submission.readString(input.title);

    if (!id || !creatorId || !title) {
      return null;
    }

    return Submission.create({
      id,
      creatorId,
      title,
      kind: Submission.readString(input.kind) as SubmissionKind | undefined,
      status: Submission.readString(input.status) as SubmissionStatus | undefined,
      visibility: Submission.readString(
        input.visibility,
      ) as SubmissionVisibility | undefined,
      contentHash: Submission.readNullableString(input.contentHash),
      signedLookupId: Submission.readNullableString(input.signedLookupId),
      version:
        typeof input.version === 'number' && Number.isFinite(input.version)
          ? input.version
          : 1,
      createdAt: Submission.readString(input.createdAt) ?? undefined,
      updatedAt: Submission.readString(input.updatedAt) ?? undefined,
      publishedAt: Submission.readNullableString(input.publishedAt),
      metadata: Submission.isRecord(input.metadata) ? input.metadata : {},
    });
  }

  isOwnedBy(creatorId: string): boolean {
    return this.creatorId === creatorId;
  }

  isPubliclyReadable(): boolean {
    return this.visibility === 'public';
  }

  toPublicJSON(): Record<string, unknown> {
    return {
      id: this.id,
      signedLookupId: this.signedLookupId,
      title: this.title,
      kind: this.kind,
      status: this.status,
      visibility: this.visibility,
      version: this.version,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      publishedAt: this.publishedAt,
      metadata: {
        ...this.metadata,
      },
    };
  }

  toOwnerJSON(): Record<string, unknown> {
    return {
      id: this.id,
      creatorId: this.creatorId,
      signedLookupId: this.signedLookupId,
      title: this.title,
      kind: this.kind,
      status: this.status,
      visibility: this.visibility,
      contentHash: this.contentHash,
      version: this.version,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      publishedAt: this.publishedAt,
      metadata: {
        ...this.metadata,
      },
    };
  }

  toInternalJSON(): SubmissionProps {
    return {
      id: this.id,
      creatorId: this.creatorId,
      title: this.title,
      kind: this.kind,
      status: this.status,
      visibility: this.visibility,
      contentHash: this.contentHash,
      signedLookupId: this.signedLookupId,
      version: this.version,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      publishedAt: this.publishedAt,
      metadata: {
        ...this.metadata,
      },
    };
  }

  private static normalizeKind(value: unknown): SubmissionKind {
    switch (value) {
      case 'ugc':
      case 'deck':
      case 'scenario':
      case 'map':
      case 'curriculum':
      case 'asset':
      case 'other':
        return value;
      default:
        return 'ugc';
    }
  }

  private static normalizeStatus(value: unknown): SubmissionStatus {
    switch (value) {
      case 'draft':
      case 'submitted':
      case 'under_review':
      case 'approved':
      case 'rejected':
      case 'published':
      case 'archived':
        return value;
      default:
        return 'draft';
    }
  }

  private static normalizeVisibility(value: unknown): SubmissionVisibility {
    switch (value) {
      case 'private':
      case 'unlisted':
      case 'public':
        return value;
      default:
        return 'private';
    }
  }

  private static normalizeMetadata(
    value: unknown,
  ): Record<string, unknown> {
    return Submission.isRecord(value) ? { ...value } : {};
  }

  private static readString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private static readNullableString(value: unknown): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    return Submission.readString(value);
  }

  private static isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
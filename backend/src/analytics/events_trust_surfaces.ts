// backend/src/analytics/events_trust_surfaces.ts

/**
 * Point Zero One — Trust Surfaces Analytics (Backend)
 *
 * Server-side trust-surface analytics contracts, event factories, and emitters.
 * This keeps the backend authoritative and strongly typed while staying simple
 * to wire into existing telemetry/logging/event-bus infrastructure.
 */

export const TRUST_SURFACES_EVENTS = {
  PROOF_MINTED: 'PROOF_MINTED',
  PROOF_SHARED_DRAFT: 'PROOF_SHARED_DRAFT',
  PROOF_STAMPED: 'PROOF_STAMPED',
  PROOF_SHARED_VERIFIED: 'PROOF_SHARED_VERIFIED',
  EXPLORER_VIEW: 'EXPLORER_VIEW',
  SHOWCASE_VIEW: 'SHOWCASE_VIEW',
} as const;

export type TrustSurfacesEventName =
  (typeof TRUST_SURFACES_EVENTS)[keyof typeof TRUST_SURFACES_EVENTS];

export type ExplorerViewType = 'asset' | 'proof' | 'run' | 'showcase';

export type TrustSurfaceName =
  | 'after_run'
  | 'proof_page'
  | 'share_page'
  | 'explorer'
  | 'showcase'
  | 'leaderboard';

export type VerificationStatus = 'PENDING' | 'VERIFIED' | 'QUARANTINED';

export type AnalyticsMetadataValue = string | number | boolean | null;
export type AnalyticsMetadata = Readonly<Record<string, AnalyticsMetadataValue>>;

export interface BaseTrustSurfacesEvent<
  TEvent extends TrustSurfacesEventName,
> {
  event: TEvent;
  timestamp: number;
  playerId?: string;
  gameInstanceId?: string;
  roundNumber?: number;
  assetId?: string;
  proofId?: string;
  proofHash?: string;
  runId?: string;
  explorerViewType?: ExplorerViewType;
  surface?: TrustSurfaceName;
  verificationStatus?: VerificationStatus;
  metadata?: AnalyticsMetadata;
}

export interface ProofMintedEvent
  extends BaseTrustSurfacesEvent<'PROOF_MINTED'> {
  proofId: string;
}

export interface ProofSharedDraftEvent
  extends BaseTrustSurfacesEvent<'PROOF_SHARED_DRAFT'> {
  proofId: string;
}

export interface ProofStampedEvent
  extends BaseTrustSurfacesEvent<'PROOF_STAMPED'> {
  proofId: string;
}

export interface ProofSharedVerifiedEvent
  extends BaseTrustSurfacesEvent<'PROOF_SHARED_VERIFIED'> {
  proofId: string;
}

export interface ExplorerViewEvent
  extends BaseTrustSurfacesEvent<'EXPLORER_VIEW'> {
  explorerViewType: ExplorerViewType;
}

export interface ShowcaseViewEvent
  extends BaseTrustSurfacesEvent<'SHOWCASE_VIEW'> {
  surface: 'showcase';
}

export type TrustSurfacesEvent =
  | ProofMintedEvent
  | ProofSharedDraftEvent
  | ProofStampedEvent
  | ProofSharedVerifiedEvent
  | ExplorerViewEvent
  | ShowcaseViewEvent;

export interface TrustSurfacesCommonInput {
  timestamp?: number;
  playerId?: string;
  gameInstanceId?: string;
  roundNumber?: number;
  assetId?: string;
  proofId?: string;
  proofHash?: string;
  runId?: string;
  explorerViewType?: ExplorerViewType;
  surface?: TrustSurfaceName;
  verificationStatus?: VerificationStatus;
  metadata?: AnalyticsMetadata;
}

export interface ProofRequiredInput extends TrustSurfacesCommonInput {
  proofId: string;
}

export interface ExplorerViewInput extends TrustSurfacesCommonInput {
  explorerViewType: ExplorerViewType;
}

export interface ShowcaseViewInput extends TrustSurfacesCommonInput {
  surface?: 'showcase';
}

export interface TrustSurfacesAnalyticsEmitter {
  emit(event: TrustSurfacesEvent): void;
}

function compactRecord(
  value: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined) {
      result[key] = entry;
    }
  }

  return result;
}

function normalizeTimestamp(value?: number): number {
  if (value === undefined) {
    return Date.now();
  }

  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid analytics timestamp: ${String(value)}`);
  }

  return Math.floor(value);
}

function normalizeString(value?: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeMetadata(
  metadata?: AnalyticsMetadata,
): AnalyticsMetadata | undefined {
  if (!metadata) {
    return undefined;
  }

  const normalized: Record<string, AnalyticsMetadataValue> = {};

  for (const [key, value] of Object.entries(metadata)) {
    const normalizedKey = key.trim();
    if (!normalizedKey) {
      continue;
    }

    normalized[normalizedKey] = value;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function buildBase<TEvent extends TrustSurfacesEventName>(
  event: TEvent,
  input: TrustSurfacesCommonInput = {},
): BaseTrustSurfacesEvent<TEvent> {
  const base: BaseTrustSurfacesEvent<TEvent> = {
    event,
    timestamp: normalizeTimestamp(input.timestamp),
  };

  const playerId = normalizeString(input.playerId);
  const gameInstanceId = normalizeString(input.gameInstanceId);
  const assetId = normalizeString(input.assetId);
  const proofId = normalizeString(input.proofId);
  const proofHash = normalizeString(input.proofHash);
  const runId = normalizeString(input.runId);
  const surface = normalizeString(input.surface) as TrustSurfaceName | undefined;
  const metadata = normalizeMetadata(input.metadata);

  if (playerId !== undefined) {
    base.playerId = playerId;
  }

  if (gameInstanceId !== undefined) {
    base.gameInstanceId = gameInstanceId;
  }

  if (input.roundNumber !== undefined) {
    if (!Number.isFinite(input.roundNumber) || input.roundNumber < 0) {
      throw new Error(`Invalid roundNumber: ${String(input.roundNumber)}`);
    }

    base.roundNumber = Math.floor(input.roundNumber);
  }

  if (assetId !== undefined) {
    base.assetId = assetId;
  }

  if (proofId !== undefined) {
    base.proofId = proofId;
  }

  if (proofHash !== undefined) {
    base.proofHash = proofHash;
  }

  if (runId !== undefined) {
    base.runId = runId;
  }

  if (input.explorerViewType !== undefined) {
    base.explorerViewType = input.explorerViewType;
  }

  if (surface !== undefined) {
    base.surface = surface;
  }

  if (input.verificationStatus !== undefined) {
    base.verificationStatus = input.verificationStatus;
  }

  if (metadata !== undefined) {
    base.metadata = metadata;
  }

  return base;
}

export function createProofMintedEvent(
  input: ProofRequiredInput,
): ProofMintedEvent {
  return {
    ...buildBase(TRUST_SURFACES_EVENTS.PROOF_MINTED, input),
    proofId: normalizeString(input.proofId)!,
  };
}

export function createProofSharedDraftEvent(
  input: ProofRequiredInput,
): ProofSharedDraftEvent {
  return {
    ...buildBase(TRUST_SURFACES_EVENTS.PROOF_SHARED_DRAFT, input),
    proofId: normalizeString(input.proofId)!,
  };
}

export function createProofStampedEvent(
  input: ProofRequiredInput,
): ProofStampedEvent {
  return {
    ...buildBase(TRUST_SURFACES_EVENTS.PROOF_STAMPED, input),
    proofId: normalizeString(input.proofId)!,
  };
}

export function createProofSharedVerifiedEvent(
  input: ProofRequiredInput,
): ProofSharedVerifiedEvent {
  return {
    ...buildBase(TRUST_SURFACES_EVENTS.PROOF_SHARED_VERIFIED, input),
    proofId: normalizeString(input.proofId)!,
  };
}

export function createExplorerViewEvent(
  input: ExplorerViewInput,
): ExplorerViewEvent {
  return {
    ...buildBase(TRUST_SURFACES_EVENTS.EXPLORER_VIEW, input),
    explorerViewType: input.explorerViewType,
  };
}

export function createShowcaseViewEvent(
  input: ShowcaseViewInput = {},
): ShowcaseViewEvent {
  return {
    ...buildBase(TRUST_SURFACES_EVENTS.SHOWCASE_VIEW, {
      ...input,
      surface: 'showcase',
    }),
    surface: 'showcase',
  };
}

export function serializeTrustSurfacesEvent(
  event: TrustSurfacesEvent,
): Record<string, unknown> {
  return compactRecord({
    ...event,
  });
}

export class NoopTrustSurfacesAnalyticsEmitter
  implements TrustSurfacesAnalyticsEmitter
{
  emit(_event: TrustSurfacesEvent): void {}
}

export class MemoryTrustSurfacesAnalyticsEmitter
  implements TrustSurfacesAnalyticsEmitter
{
  private readonly events: TrustSurfacesEvent[] = [];

  emit(event: TrustSurfacesEvent): void {
    this.events.push({ ...event });
  }

  snapshot(): ReadonlyArray<TrustSurfacesEvent> {
    return this.events.map((event) => ({ ...event }));
  }

  clear(): void {
    this.events.length = 0;
  }
}

export function emitTrustSurfacesEvent(
  emitter: TrustSurfacesAnalyticsEmitter,
  event: TrustSurfacesEvent,
): TrustSurfacesEvent {
  emitter.emit(event);
  return event;
}

export class TrustSurfacesAnalyticsService {
  constructor(
    private readonly emitter: TrustSurfacesAnalyticsEmitter = new NoopTrustSurfacesAnalyticsEmitter(),
  ) {}

  emit(event: TrustSurfacesEvent): TrustSurfacesEvent {
    return emitTrustSurfacesEvent(this.emitter, event);
  }

  proofMinted(input: ProofRequiredInput): ProofMintedEvent {
    const event = createProofMintedEvent(input);
    this.emit(event);
    return event;
  }

  proofSharedDraft(input: ProofRequiredInput): ProofSharedDraftEvent {
    const event = createProofSharedDraftEvent(input);
    this.emit(event);
    return event;
  }

  proofStamped(input: ProofRequiredInput): ProofStampedEvent {
    const event = createProofStampedEvent(input);
    this.emit(event);
    return event;
  }

  proofSharedVerified(
    input: ProofRequiredInput,
  ): ProofSharedVerifiedEvent {
    const event = createProofSharedVerifiedEvent(input);
    this.emit(event);
    return event;
  }

  explorerView(input: ExplorerViewInput): ExplorerViewEvent {
    const event = createExplorerViewEvent(input);
    this.emit(event);
    return event;
  }

  showcaseView(input: ShowcaseViewInput = {}): ShowcaseViewEvent {
    const event = createShowcaseViewEvent(input);
    this.emit(event);
    return event;
  }
}
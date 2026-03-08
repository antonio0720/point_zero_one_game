/**
 * Pack Authoring Contracts
 * backend/src/content_ops/pack_authoring/interfaces.ts
 *
 * Shared data contracts for pack draft authoring, scenario attachment,
 * rubric creation, benchmark seed authoring, and publish readiness.
 */

export type EntityId = string | number;
export type PackDraftState = 'draft' | 'ready' | 'validating' | 'published';

export interface PackDraft {
  id: EntityId;
  title: string;
  slug: string;
  description: string | null;
  state: PackDraftState;
  version: number;
  published: boolean;
  publishedAt: string | null;
  contentHash: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Scenario {
  id: EntityId;
  name: string;
  slug?: string;
  description?: string | null;
}

export interface Rubric {
  id: EntityId;
  packDraftId: EntityId;
  name: string;
  description: string | null;
  weights: Record<string, number>;
  createdAt: string;
  updatedAt: string;
}

export interface BenchmarkSeed {
  id: EntityId;
  packDraftId: EntityId;
  name: string;
  prompt: string | null;
  expectedOutcome: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreatePackDraftInput {
  title: string;
  slug: string;
  description?: string | null;
}

export interface AttachScenarioInput {
  scenarioId: EntityId;
  attachedBy?: string | null;
}

export interface CreateRubricInput {
  name: string;
  description?: string | null;
  weights?: Record<string, number>;
}

export interface CreateBenchmarkSeedInput {
  name: string;
  prompt?: string | null;
  expectedOutcome?: string | null;
  tags?: string[];
}

export interface PublishPackDraftInput {
  version: number;
  contentHash: string;
  versionPinSet: string[];
  publishActor: string;
}

export interface PackPublicationReadiness {
  ok: boolean;
  errors: string[];
  warnings: string[];
  scenarioIds: string[];
  rubricIds: string[];
  benchmarkSeedIds: string[];
}

export interface PackAuthoringRepository {
  createDraft(input: CreatePackDraftInput): Promise<PackDraft>;
  getDraftById(packDraftId: EntityId): Promise<PackDraft | null>;
  attachScenario(packDraftId: EntityId, input: AttachScenarioInput): Promise<void>;
  createRubric(packDraftId: EntityId, input: CreateRubricInput): Promise<Rubric>;
  createBenchmarkSeed(
    packDraftId: EntityId,
    input: CreateBenchmarkSeedInput,
  ): Promise<BenchmarkSeed>;
  getDraftPublicationReadiness(
    packDraftId: EntityId,
  ): Promise<PackPublicationReadiness>;
  publishDraft(
    packDraftId: EntityId,
    input: PublishPackDraftInput,
  ): Promise<PackDraft>;
}
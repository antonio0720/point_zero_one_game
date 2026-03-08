/**
 * DeploymentOrchestrator
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/deploy/deployment_orchestrator/index.ts
 *
 * Sequences migrations, remote-config gate flips, CDN invalidations,
 * and DeploymentReceipt event emission with:
 * - idempotent reruns
 * - resumable step execution
 * - safe canary stage application
 * - dependency injection for infra adapters
 */

import EventBus, {
  type DeploymentLifecycleStatus,
  type DeploymentReceiptPayload,
  type DeploymentStepName,
  type DeploymentStepReceiptPayload,
} from '../../events/event-bus';

export interface DeploymentMigrationPlan {
  key: string;
  description?: string | null;
  checksum?: string | null;
  blocking?: boolean;
}

export interface DeploymentMigrationResult {
  key: string;
  applied: boolean;
  skipped: boolean;
  checksum?: string | null;
  detail?: string | null;
}

export interface RemoteConfigGateMutation {
  key: string;
  value: string;
  description?: string | null;
}

export interface RemoteConfigGateMutationResult {
  key: string;
  previousValue: string | null;
  nextValue: string;
  changed: boolean;
}

export interface CdnInvalidationRequest {
  provider: string;
  distributionId: string;
  paths: string[];
}

export interface CdnInvalidationResult {
  provider: string;
  distributionId: string;
  invalidationId: string;
  pathCount: number;
}

export interface DeploymentCanaryPlan {
  gateKey: string;
  stages: number[];
  stageIndex?: number;
  encodeAs?: 'string' | 'number' | 'boolean' | 'json';
  description?: string | null;
}

export type DeploymentStepStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed';

export interface DeploymentStepReceipt
  extends DeploymentStepReceiptPayload {
  details?: Record<string, unknown>;
}

export interface DeploymentReceipt {
  deploymentId: string;
  idempotencyKey: string;
  actorId: string | null;
  environment: string;
  status: DeploymentLifecycleStatus;
  startedAt: string;
  finishedAt: string | null;
  canaryPercent: number | null;
  metadata: Record<string, unknown>;
  stepReceipts: DeploymentStepReceipt[];
  timestamp: string;
  lastErrorName?: string | null;
  lastErrorMessage?: string | null;
}

export interface DeploymentSequenceRequest {
  idempotencyKey?: string;
  actorId?: string | null;
  environment?: string | null;
  metadata?: Record<string, unknown>;
  migrations?: DeploymentMigrationPlan[];
  remoteConfigMutations?: RemoteConfigGateMutation[];
  cdnInvalidations?: CdnInvalidationRequest[];
  canary?: DeploymentCanaryPlan | null;
}

export interface DeploymentMigrationRunner {
  run(
    deploymentId: string,
    plans: DeploymentMigrationPlan[],
  ): Promise<DeploymentMigrationResult[]>;
}

export interface RemoteConfigGateService {
  applyMutations(
    deploymentId: string,
    mutations: RemoteConfigGateMutation[],
  ): Promise<RemoteConfigGateMutationResult[]>;
}

export interface CdnInvalidationService {
  invalidate(
    deploymentId: string,
    requests: CdnInvalidationRequest[],
  ): Promise<CdnInvalidationResult[]>;
}

export interface DeploymentEventEmitter {
  emit(
    event: 'DEPLOYMENT_RECEIPT',
    payload: DeploymentReceiptPayload,
    options?: {
      source?: string;
      actorId?: string;
      correlationId?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<unknown>;
}

export interface DeploymentOrchestratorStore {
  getByDeploymentId(deploymentId: string): Promise<DeploymentReceipt | null>;
  save(receipt: DeploymentReceipt): Promise<DeploymentReceipt>;
}

export interface DeploymentOrchestratorLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export interface DeploymentOrchestratorOptions {
  migrationRunner: DeploymentMigrationRunner;
  remoteConfigGateService: RemoteConfigGateService;
  cdnInvalidationService: CdnInvalidationService;
  store: DeploymentOrchestratorStore;
  eventEmitter?: DeploymentEventEmitter;
  logger?: DeploymentOrchestratorLogger;
  now?: () => Date;
}

export class DeploymentOrchestrationError extends Error {
  public readonly receipt: DeploymentReceipt;
  public readonly causeValue: unknown;

  constructor(message: string, receipt: DeploymentReceipt, causeValue: unknown) {
    super(message);
    this.name = 'DeploymentOrchestrationError';
    this.receipt = receipt;
    this.causeValue = causeValue;
  }
}

class ConsoleDeploymentOrchestratorLogger
  implements DeploymentOrchestratorLogger
{
  public info(message: string, meta?: Record<string, unknown>): void {
    if (meta) {
      console.info(message, meta);
      return;
    }

    console.info(message);
  }

  public warn(message: string, meta?: Record<string, unknown>): void {
    if (meta) {
      console.warn(message, meta);
      return;
    }

    console.warn(message);
  }

  public error(message: string, meta?: Record<string, unknown>): void {
    if (meta) {
      console.error(message, meta);
      return;
    }

    console.error(message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function safeErrorName(error: unknown): string {
  return error instanceof Error ? error.name : 'UnknownError';
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Unknown error';
}

function normalizeDeploymentId(value: string): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new Error('deploymentId must be a non-empty string');
  }

  return normalized;
}

function dedupeAndSortNumbers(values: number[]): number[] {
  return Array.from(
    new Set(
      values
        .filter((value) => Number.isFinite(value))
        .map((value) => Math.max(0, Math.min(100, Math.trunc(value)))),
    ),
  ).sort((left, right) => left - right);
}

function normalizeMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> {
  return isRecord(metadata) ? { ...metadata } : {};
}

function normalizeCanaryPercent(canary: DeploymentCanaryPlan | null | undefined): number | null {
  if (!canary) {
    return null;
  }

  const stages = dedupeAndSortNumbers(canary.stages);
  if (stages.length === 0) {
    return null;
  }

  const stageIndex = Math.max(
    0,
    Math.min(
      stages.length - 1,
      Math.trunc(canary.stageIndex ?? (stages.length - 1)),
    ),
  );

  return stages[stageIndex];
}

function encodeCanaryValue(
  percent: number,
  encodeAs: DeploymentCanaryPlan['encodeAs'],
): string {
  switch (encodeAs) {
    case 'number':
      return String(percent);
    case 'boolean':
      return String(percent > 0);
    case 'json':
      return JSON.stringify({ rolloutPercent: percent });
    case 'string':
    default:
      return String(percent);
  }
}

function getStepOrder(step: DeploymentStepName): number {
  switch (step) {
    case 'migrations':
      return 1;
    case 'remote_config':
      return 2;
    case 'cdn_invalidation':
      return 3;
    case 'deployment_receipt':
      return 4;
    default:
      return Number.MAX_SAFE_INTEGER;
  }
}

function cloneReceipt(receipt: DeploymentReceipt): DeploymentReceipt {
  return {
    ...receipt,
    metadata: { ...receipt.metadata },
    stepReceipts: receipt.stepReceipts.map((step) => ({
      ...step,
      details: step.details ? { ...step.details } : undefined,
    })),
  };
}

export class InMemoryDeploymentOrchestratorStore
  implements DeploymentOrchestratorStore
{
  private readonly receipts = new Map<string, DeploymentReceipt>();

  public async getByDeploymentId(
    deploymentId: string,
  ): Promise<DeploymentReceipt | null> {
    const receipt = this.receipts.get(deploymentId);
    return receipt ? cloneReceipt(receipt) : null;
  }

  public async save(receipt: DeploymentReceipt): Promise<DeploymentReceipt> {
    const cloned = cloneReceipt(receipt);
    this.receipts.set(receipt.deploymentId, cloned);
    return cloneReceipt(cloned);
  }
}

export class InMemoryDeploymentMigrationRunner
  implements DeploymentMigrationRunner
{
  public async run(
    _deploymentId: string,
    plans: DeploymentMigrationPlan[],
  ): Promise<DeploymentMigrationResult[]> {
    return plans.map((plan) => ({
      key: plan.key,
      applied: true,
      skipped: false,
      checksum: plan.checksum ?? null,
      detail: plan.description ?? null,
    }));
  }
}

export class InMemoryRemoteConfigGateService
  implements RemoteConfigGateService
{
  private readonly gates = new Map<string, string>();

  public async applyMutations(
    _deploymentId: string,
    mutations: RemoteConfigGateMutation[],
  ): Promise<RemoteConfigGateMutationResult[]> {
    return mutations.map((mutation) => {
      const previousValue = this.gates.get(mutation.key) ?? null;
      this.gates.set(mutation.key, mutation.value);

      return {
        key: mutation.key,
        previousValue,
        nextValue: mutation.value,
        changed: previousValue !== mutation.value,
      };
    });
  }

  public getCurrentValue(key: string): string | null {
    return this.gates.get(key) ?? null;
  }
}

export class InMemoryCdnInvalidationService
  implements CdnInvalidationService
{
  private sequence = 0;

  public async invalidate(
    _deploymentId: string,
    requests: CdnInvalidationRequest[],
  ): Promise<CdnInvalidationResult[]> {
    return requests.map((request) => {
      this.sequence += 1;

      return {
        provider: request.provider,
        distributionId: request.distributionId,
        invalidationId: `invalidation-${this.sequence}`,
        pathCount: request.paths.length,
      };
    });
  }
}

export class DeploymentOrchestrator {
  private readonly migrationRunner: DeploymentMigrationRunner;
  private readonly remoteConfigGateService: RemoteConfigGateService;
  private readonly cdnInvalidationService: CdnInvalidationService;
  private readonly store: DeploymentOrchestratorStore;
  private readonly eventEmitter: DeploymentEventEmitter;
  private readonly logger: DeploymentOrchestratorLogger;
  private readonly now: () => Date;

  constructor(options: DeploymentOrchestratorOptions) {
    this.migrationRunner = options.migrationRunner;
    this.remoteConfigGateService = options.remoteConfigGateService;
    this.cdnInvalidationService = options.cdnInvalidationService;
    this.store = options.store;
    this.eventEmitter = options.eventEmitter ?? EventBus;
    this.logger = options.logger ?? new ConsoleDeploymentOrchestratorLogger();
    this.now = options.now ?? (() => new Date());
  }

  /**
   * Sequences migrations, flips remote-config gates, triggers CDN invalidations,
   * and emits a DeploymentReceipt event.
   *
   * Idempotency:
   * - If the deployment already completed, the stored receipt is returned unchanged.
   * - If the deployment partially completed, only incomplete or failed steps are retried.
   */
  public async sequenceDeployment(
    deploymentId: string,
    request: DeploymentSequenceRequest = {},
  ): Promise<DeploymentReceipt> {
    const normalizedDeploymentId = normalizeDeploymentId(deploymentId);
    let receipt =
      (await this.store.getByDeploymentId(normalizedDeploymentId)) ??
      this.createInitialReceipt(normalizedDeploymentId, request);

    if (receipt.status === 'completed') {
      this.logger.info('[deployment-orchestrator] deployment already completed', {
        deploymentId: normalizedDeploymentId,
      });
      return receipt;
    }

    if (receipt.status !== 'in_progress') {
      receipt.status = 'in_progress';
      receipt.finishedAt = null;
      receipt.timestamp = this.now().toISOString();
      receipt.lastErrorName = null;
      receipt.lastErrorMessage = null;
      receipt = await this.store.save(receipt);
    }

    try {
      receipt = await this.runStep(
        receipt,
        'migrations',
        async () => {
          const migrationPlans = [...(request.migrations ?? [])];
          const migrationResults = await this.migrationRunner.run(
            normalizedDeploymentId,
            migrationPlans,
          );

          return {
            migrationCount: migrationPlans.length,
            appliedCount: migrationResults.filter((result) => result.applied).length,
            skippedCount: migrationResults.filter((result) => result.skipped).length,
            migrations: migrationResults as unknown as Record<string, unknown>[],
          };
        },
      );

      receipt = await this.runStep(
        receipt,
        'remote_config',
        async () => {
          const mutations = this.resolveRemoteConfigMutations(request);
          const results = await this.remoteConfigGateService.applyMutations(
            normalizedDeploymentId,
            mutations,
          );

          return {
            mutationCount: mutations.length,
            changedCount: results.filter((result) => result.changed).length,
            mutations: mutations as unknown as Record<string, unknown>[],
            results: results as unknown as Record<string, unknown>[],
          };
        },
      );

      receipt = await this.runStep(
        receipt,
        'cdn_invalidation',
        async () => {
          const invalidations = [...(request.cdnInvalidations ?? [])];
          const results = await this.cdnInvalidationService.invalidate(
            normalizedDeploymentId,
            invalidations,
          );

          return {
            invalidationCount: invalidations.length,
            pathCount: invalidations.reduce(
              (total, item) => total + item.paths.length,
              0,
            ),
            requests: invalidations as unknown as Record<string, unknown>[],
            results: results as unknown as Record<string, unknown>[],
          };
        },
      );

      receipt = await this.runStep(
        receipt,
        'deployment_receipt',
        async () => {
          const payload = this.toEventPayload({
            ...receipt,
            status: 'completed',
            finishedAt: this.now().toISOString(),
            timestamp: this.now().toISOString(),
          });

          const dispatchReceipt = await this.eventEmitter.emit(
            'DEPLOYMENT_RECEIPT',
            payload,
            {
              source: 'deployment-orchestrator',
              actorId: receipt.actorId ?? undefined,
              correlationId: receipt.idempotencyKey,
              metadata: {
                deploymentId: receipt.deploymentId,
                environment: receipt.environment,
              },
            },
          );

          return {
            event: 'DEPLOYMENT_RECEIPT',
            dispatchReceipt: dispatchReceipt as Record<string, unknown>,
          };
        },
      );

      receipt.status = 'completed';
      receipt.finishedAt = this.now().toISOString();
      receipt.timestamp = receipt.finishedAt;
      receipt.lastErrorName = null;
      receipt.lastErrorMessage = null;

      receipt = await this.store.save(receipt);

      this.logger.info('[deployment-orchestrator] deployment completed', {
        deploymentId: receipt.deploymentId,
        environment: receipt.environment,
      });

      return receipt;
    } catch (error) {
      receipt.status = 'failed';
      receipt.finishedAt = this.now().toISOString();
      receipt.timestamp = receipt.finishedAt;
      receipt.lastErrorName = safeErrorName(error);
      receipt.lastErrorMessage = safeErrorMessage(error);

      receipt = await this.store.save(receipt);

      this.logger.error('[deployment-orchestrator] deployment failed', {
        deploymentId: receipt.deploymentId,
        environment: receipt.environment,
        errorName: receipt.lastErrorName ?? undefined,
        errorMessage: receipt.lastErrorMessage ?? undefined,
      });

      throw new DeploymentOrchestrationError(
        `Deployment failed for ${receipt.deploymentId}`,
        receipt,
        error,
      );
    }
  }

  private createInitialReceipt(
    deploymentId: string,
    request: DeploymentSequenceRequest,
  ): DeploymentReceipt {
    const startedAt = this.now().toISOString();
    const canaryPercent = normalizeCanaryPercent(request.canary);

    return {
      deploymentId,
      idempotencyKey:
        request.idempotencyKey?.trim() || `deployment:${deploymentId}`,
      actorId:
        request.actorId === undefined ? null : request.actorId,
      environment: request.environment?.trim() || 'production',
      status: 'in_progress',
      startedAt,
      finishedAt: null,
      canaryPercent,
      metadata: normalizeMetadata(request.metadata),
      stepReceipts: [],
      timestamp: startedAt,
      lastErrorName: null,
      lastErrorMessage: null,
    };
  }

  private async runStep(
    receipt: DeploymentReceipt,
    step: DeploymentStepName,
    action: () => Promise<Record<string, unknown>>,
  ): Promise<DeploymentReceipt> {
    const existing = receipt.stepReceipts.find(
      (stepReceipt) => stepReceipt.step === step,
    );

    if (existing?.status === 'completed') {
      return receipt;
    }

    const attempt = (existing?.attempt ?? 0) + 1;
    const startedAt = this.now().toISOString();

    receipt = this.upsertStepReceipt(receipt, {
      step,
      status: 'in_progress',
      attempt,
      startedAt,
      finishedAt: null,
      details: existing?.details ? { ...existing.details } : {},
      errorName: null,
      errorMessage: null,
    });

    receipt.timestamp = startedAt;
    receipt = await this.store.save(receipt);

    try {
      const details = await action();

      receipt = this.upsertStepReceipt(receipt, {
        step,
        status: 'completed',
        attempt,
        startedAt,
        finishedAt: this.now().toISOString(),
        details,
        errorName: null,
        errorMessage: null,
      });

      receipt.timestamp = this.now().toISOString();
      return await this.store.save(receipt);
    } catch (error) {
      receipt = this.upsertStepReceipt(receipt, {
        step,
        status: 'failed',
        attempt,
        startedAt,
        finishedAt: this.now().toISOString(),
        details: {
          errorName: safeErrorName(error),
          errorMessage: safeErrorMessage(error),
        },
        errorName: safeErrorName(error),
        errorMessage: safeErrorMessage(error),
      });

      receipt.timestamp = this.now().toISOString();
      await this.store.save(receipt);
      throw error;
    }
  }

  private upsertStepReceipt(
    receipt: DeploymentReceipt,
    nextStepReceipt: DeploymentStepReceipt,
  ): DeploymentReceipt {
    const stepReceipts = receipt.stepReceipts.filter(
      (stepReceipt) => stepReceipt.step !== nextStepReceipt.step,
    );

    stepReceipts.push(nextStepReceipt);
    stepReceipts.sort(
      (left, right) => getStepOrder(left.step) - getStepOrder(right.step),
    );

    return {
      ...receipt,
      stepReceipts,
    };
  }

  private resolveRemoteConfigMutations(
    request: DeploymentSequenceRequest,
  ): RemoteConfigGateMutation[] {
    const mutations = [...(request.remoteConfigMutations ?? [])];

    if (!request.canary) {
      return mutations;
    }

    const stages = dedupeAndSortNumbers(request.canary.stages);
    if (stages.length === 0) {
      return mutations;
    }

    const stageIndex = Math.max(
      0,
      Math.min(
        stages.length - 1,
        Math.trunc(request.canary.stageIndex ?? (stages.length - 1)),
      ),
    );

    const canaryPercent = stages[stageIndex];
    const canaryMutation: RemoteConfigGateMutation = {
      key: request.canary.gateKey,
      value: encodeCanaryValue(canaryPercent, request.canary.encodeAs),
      description:
        request.canary.description ??
        `canary rollout set to ${canaryPercent}%`,
    };

    const deduped = new Map<string, RemoteConfigGateMutation>();

    for (const mutation of mutations) {
      deduped.set(mutation.key, mutation);
    }

    deduped.set(canaryMutation.key, canaryMutation);

    return [...deduped.values()];
  }

  private toEventPayload(receipt: DeploymentReceipt): DeploymentReceiptPayload {
    return {
      deploymentId: receipt.deploymentId,
      idempotencyKey: receipt.idempotencyKey,
      actorId: receipt.actorId,
      environment: receipt.environment,
      status: receipt.status,
      startedAt: receipt.startedAt,
      finishedAt: receipt.finishedAt,
      canaryPercent: receipt.canaryPercent,
      metadata: { ...receipt.metadata },
      stepReceipts: receipt.stepReceipts.map((stepReceipt) => ({
        step: stepReceipt.step,
        status: stepReceipt.status,
        attempt: stepReceipt.attempt,
        startedAt: stepReceipt.startedAt,
        finishedAt: stepReceipt.finishedAt,
        details: stepReceipt.details ? { ...stepReceipt.details } : undefined,
        errorName: stepReceipt.errorName ?? null,
        errorMessage: stepReceipt.errorMessage ?? null,
      })),
      timestamp: receipt.timestamp,
    };
  }
}

export default DeploymentOrchestrator;
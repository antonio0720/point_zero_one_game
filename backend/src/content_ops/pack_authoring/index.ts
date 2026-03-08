/**
 * Pack Authoring API
 * backend/src/content_ops/pack_authoring/index.ts
 *
 * Repo-aligned rewrite:
 * - removes hard dependency on a missing ../database module
 * - removes hard dependency on express-validator
 * - uses repository injection so persistence can stay consistent with the rest of backend
 * - adds deterministic readiness inspection before publish
 */

import express, { Request, Response } from 'express';
import type {
  BenchmarkSeed,
  CreateBenchmarkSeedInput,
  CreatePackDraftInput,
  CreateRubricInput,
  EntityId,
  PackAuthoringRepository,
  PublishPackDraftInput,
  Rubric,
} from './interfaces';
import {
  PublishConflictError,
  PublishReceiptsService,
} from './publish_receipts';

export interface PackAuthoringRouterDependencies {
  repository: PackAuthoringRepository;
  publishReceiptsService?: PublishReceiptsService;
  resolvePublishActor?: (req: Request) => string;
  onError?: (error: unknown, req: Request) => void;
}

type JsonRecord = Record<string, unknown>;

const INTERNAL_ERROR_MESSAGE = 'Internal Server Error';

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function getBody(req: Request): JsonRecord {
  return isRecord(req.body) ? req.body : {};
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function optionalString(body: JsonRecord, field: string): string | null {
  return normalizeString(body[field]);
}

function requireString(body: JsonRecord, field: string): string | null {
  return normalizeString(body[field]);
}

function requirePositiveInteger(body: JsonRecord, field: string): number | null {
  const raw = body[field];
  const value = typeof raw === 'number' ? raw : Number(raw);

  if (!Number.isInteger(value) || value <= 0) {
    return null;
  }

  return value;
}

function readScenarioId(body: JsonRecord): EntityId | null {
  const raw = body.scenarioId;

  if (typeof raw === 'number' && Number.isInteger(raw) && raw > 0) {
    return raw;
  }

  const asString = normalizeString(raw);
  if (!asString) {
    return null;
  }

  const asNumber = Number(asString);
  if (Number.isInteger(asNumber) && asNumber > 0) {
    return asNumber;
  }

  return asString;
}

function readStringArray(body: JsonRecord, field: string): string[] {
  const raw = body[field];
  if (!Array.isArray(raw)) {
    return [];
  }

  return Array.from(
    new Set(
      raw
        .map((value) => normalizeString(value))
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

function readWeights(
  body: JsonRecord,
  field = 'weights',
): Record<string, number> {
  const raw = body[field];
  if (!isRecord(raw)) {
    return {};
  }

  const weights: Record<string, number> = {};

  for (const [key, value] of Object.entries(raw)) {
    const normalizedKey = normalizeString(key);
    const numericValue = typeof value === 'number' ? value : Number(value);

    if (normalizedKey && Number.isFinite(numericValue) && numericValue >= 0) {
      weights[normalizedKey] = numericValue;
    }
  }

  return weights;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

function readPackDraftId(req: Request): string | null {
  return normalizeString(req.params.packDraftId);
}

function validationError(res: Response, errors: string[]) {
  return res.status(400).json({ errors });
}

function notFound(res: Response, entity = 'Pack draft') {
  return res.status(404).json({ error: `${entity} not found` });
}

function handleRouteError(
  error: unknown,
  req: Request,
  res: Response,
  onError?: (error: unknown, req: Request) => void,
) {
  onError?.(error, req);

  if (error instanceof PublishConflictError) {
    return res.status(409).json({ error: error.message });
  }

  console.error(error);
  return res.status(500).json({ error: INTERNAL_ERROR_MESSAGE });
}

async function ensureDraftExists(
  repository: PackAuthoringRepository,
  packDraftId: EntityId,
) {
  return repository.getDraftById(packDraftId);
}

export function createPackAuthoringRouter(
  deps: PackAuthoringRouterDependencies,
): express.Router {
  const router = express.Router();
  const { repository, publishReceiptsService, resolvePublishActor, onError } =
    deps;

  router.post('/drafts', async (req, res) => {
    const body = getBody(req);
    const title = requireString(body, 'title');

    if (!title) {
      return validationError(res, ['title is required']);
    }

    const slug = optionalString(body, 'slug') ?? slugify(title);
    const description = optionalString(body, 'description');

    const input: CreatePackDraftInput = {
      title,
      slug,
      description,
    };

    try {
      const draft = await repository.createDraft(input);
      return res.status(201).json(draft);
    } catch (error) {
      return handleRouteError(error, req, res, onError);
    }
  });

  router.get('/drafts/:packDraftId', async (req, res) => {
    const packDraftId = readPackDraftId(req);

    if (!packDraftId) {
      return validationError(res, ['packDraftId is required']);
    }

    try {
      const draft = await repository.getDraftById(packDraftId);

      if (!draft) {
        return notFound(res);
      }

      return res.status(200).json(draft);
    } catch (error) {
      return handleRouteError(error, req, res, onError);
    }
  });

  router.get('/drafts/:packDraftId/readiness', async (req, res) => {
    const packDraftId = readPackDraftId(req);

    if (!packDraftId) {
      return validationError(res, ['packDraftId is required']);
    }

    try {
      const draft = await ensureDraftExists(repository, packDraftId);

      if (!draft) {
        return notFound(res);
      }

      const readiness = await repository.getDraftPublicationReadiness(
        packDraftId,
      );

      return res.status(200).json({
        draft,
        readiness,
      });
    } catch (error) {
      return handleRouteError(error, req, res, onError);
    }
  });

  router.post('/drafts/:packDraftId/scenarios', async (req, res) => {
    const packDraftId = readPackDraftId(req);
    const body = getBody(req);
    const scenarioId = readScenarioId(body);

    const errors: string[] = [];
    if (!packDraftId) {
      errors.push('packDraftId is required');
    }
    if (scenarioId === null) {
      errors.push('scenarioId must be a positive integer or non-empty string');
    }

    if (errors.length > 0) {
      return validationError(res, errors);
    }

    try {
      const draft = await ensureDraftExists(repository, packDraftId!);

      if (!draft) {
        return notFound(res);
      }

      await repository.attachScenario(packDraftId!, {
        scenarioId: scenarioId!,
        attachedBy:
          optionalString(body, 'attachedBy') ??
          normalizeString(req.header('x-actor-id')),
      });

      return res.sendStatus(204);
    } catch (error) {
      return handleRouteError(error, req, res, onError);
    }
  });

  router.post('/drafts/:packDraftId/rubrics', async (req, res) => {
    const packDraftId = readPackDraftId(req);
    const body = getBody(req);
    const name = requireString(body, 'name');

    const errors: string[] = [];
    if (!packDraftId) {
      errors.push('packDraftId is required');
    }
    if (!name) {
      errors.push('name is required');
    }

    if (errors.length > 0) {
      return validationError(res, errors);
    }

    const input: CreateRubricInput = {
      name: name!,
      description: optionalString(body, 'description'),
      weights: readWeights(body),
    };

    try {
      const draft = await ensureDraftExists(repository, packDraftId!);

      if (!draft) {
        return notFound(res);
      }

      const rubric: Rubric = await repository.createRubric(packDraftId!, input);
      return res.status(201).json(rubric);
    } catch (error) {
      return handleRouteError(error, req, res, onError);
    }
  });

  const createBenchmarkSeedHandler = async (req: Request, res: Response) => {
    const packDraftId = readPackDraftId(req);
    const body = getBody(req);
    const name = requireString(body, 'name');

    const errors: string[] = [];
    if (!packDraftId) {
      errors.push('packDraftId is required');
    }
    if (!name) {
      errors.push('name is required');
    }

    if (errors.length > 0) {
      return validationError(res, errors);
    }

    const input: CreateBenchmarkSeedInput = {
      name: name!,
      prompt: optionalString(body, 'prompt'),
      expectedOutcome: optionalString(body, 'expectedOutcome'),
      tags: readStringArray(body, 'tags'),
    };

    try {
      const draft = await ensureDraftExists(repository, packDraftId!);

      if (!draft) {
        return notFound(res);
      }

      const benchmarkSeed: BenchmarkSeed =
        await repository.createBenchmarkSeed(packDraftId!, input);

      return res.status(201).json(benchmarkSeed);
    } catch (error) {
      return handleRouteError(error, req, res, onError);
    }
  };

  router.post(
    '/drafts/:packDraftId/benchmark-seeds',
    createBenchmarkSeedHandler,
  );
  router.post(
    '/drafts/:packDraftId/benchmark_seeds',
    createBenchmarkSeedHandler,
  );

  router.post('/drafts/:packDraftId/publish', async (req, res) => {
    const packDraftId = readPackDraftId(req);
    const body = getBody(req);

    const version = requirePositiveInteger(body, 'version');
    const contentHash = requireString(body, 'contentHash');

    const errors: string[] = [];
    if (!packDraftId) {
      errors.push('packDraftId is required');
    }
    if (version === null) {
      errors.push('version must be a positive integer');
    }
    if (!contentHash) {
      errors.push('contentHash is required');
    }

    if (errors.length > 0) {
      return validationError(res, errors);
    }

    try {
      const draft = await ensureDraftExists(repository, packDraftId!);

      if (!draft) {
        return notFound(res);
      }

      const readiness = await repository.getDraftPublicationReadiness(
        packDraftId!,
      );

      if (!readiness.ok) {
        return res.status(409).json({
          error: 'Pack draft is not ready for publication',
          readiness,
        });
      }

      const explicitVersionPinSet = readStringArray(body, 'versionPinSet');
      const derivedVersionPinSet = [
        ...readiness.scenarioIds,
        ...readiness.rubricIds,
        ...readiness.benchmarkSeedIds,
      ];

      const versionPinSet =
        explicitVersionPinSet.length > 0
          ? explicitVersionPinSet
          : Array.from(new Set(derivedVersionPinSet));

      const publishActor =
        optionalString(body, 'publishActor') ??
        normalizeString(req.header('x-actor-id')) ??
        resolvePublishActor?.(req) ??
        'system';

      if (publishReceiptsService) {
        await publishReceiptsService.assertNoConflict(
          contentHash!,
          versionPinSet,
        );
      }

      const publishInput: PublishPackDraftInput = {
        version: version!,
        contentHash: contentHash!,
        versionPinSet,
        publishActor,
      };

      const publishedDraft = await repository.publishDraft(
        packDraftId!,
        publishInput,
      );

      const receipt = publishReceiptsService
        ? await publishReceiptsService.publish(
            contentHash!,
            versionPinSet,
            publishActor,
          )
        : null;

      return res.status(200).json({
        draft: publishedDraft,
        readiness,
        receipt,
      });
    } catch (error) {
      return handleRouteError(error, req, res, onError);
    }
  });

  return router;
}

export default createPackAuthoringRouter;
/**
 * Pack State Machine
 * backend/src/content_ops/pack_authoring/pack_state_machine.ts
 *
 * Deterministic lifecycle controller for authorable packs.
 */

export enum State {
  DRAFT = 'draft',
  READY = 'ready',
  VALIDATING = 'validating',
  PUBLISHED = 'published',
}

export interface Pack {
  id: number | string;
  name: string;
  slug: string;
  state: State;
  version?: number;
  pins?: string[];
  benchmarks?: string[];
  publishedAt?: Date | null;
}

export interface PackValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export interface PackRepository {
  createPack(pack: Pack): Promise<Pack>;
  updatePack(pack: Pack): Promise<Pack>;
  getPackById(id: number | string): Promise<Pack | null>;
}

export interface PackValidator {
  validate(pack: Pack): Promise<PackValidationResult> | PackValidationResult;
}

export interface PackPublisher {
  publish(pack: Pack): Promise<void> | void;
}

export class PackStateTransitionError extends Error {
  public readonly from: State;
  public readonly to: State;

  constructor(from: State, to: State) {
    super(`Invalid pack state transition from "${from}" to "${to}"`);
    this.name = 'PackStateTransitionError';
    this.from = from;
    this.to = to;
  }
}

export class PackValidationError extends Error {
  public readonly errors: string[];

  constructor(errors: string[]) {
    super(`Pack validation failed: ${errors.join('; ')}`);
    this.name = 'PackValidationError';
    this.errors = errors;
  }
}

const ALLOWED_TRANSITIONS: Record<State, State[]> = {
  [State.DRAFT]: [State.READY, State.VALIDATING],
  [State.READY]: [State.DRAFT, State.VALIDATING, State.PUBLISHED],
  [State.VALIDATING]: [State.DRAFT, State.READY, State.PUBLISHED],
  [State.PUBLISHED]: [],
};

function normalizeCollection(values?: string[]): string[] {
  return Array.from(
    new Set(
      (values ?? [])
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  ).sort();
}

function inferAuthoringState(result: PackValidationResult): State {
  return result.ok ? State.READY : State.DRAFT;
}

export class PackService {
  private readonly repository: PackRepository;
  private readonly validator: PackValidator;
  private readonly publisher: PackPublisher;

  constructor(
    repository: PackRepository,
    validator: PackValidator,
    publisher: PackPublisher,
  ) {
    this.repository = repository;
    this.validator = validator;
    this.publisher = publisher;
  }

  public async createPack(pack: Pack): Promise<Pack> {
    const normalizedPack: Pack = {
      ...pack,
      pins: normalizeCollection(pack.pins),
      benchmarks: normalizeCollection(pack.benchmarks),
    };

    const validation = await this.validator.validate(normalizedPack);
    return this.repository.createPack({
      ...normalizedPack,
      state: inferAuthoringState(validation),
    });
  }

  public async updatePack(pack: Pack): Promise<Pack> {
    const normalizedPack: Pack = {
      ...pack,
      pins: normalizeCollection(pack.pins),
      benchmarks: normalizeCollection(pack.benchmarks),
    };

    const validation = await this.validator.validate(normalizedPack);
    return this.repository.updatePack({
      ...normalizedPack,
      state: inferAuthoringState(validation),
    });
  }

  public async publishPack(id: number | string): Promise<Pack> {
    const currentPack = await this.repository.getPackById(id);

    if (!currentPack) {
      throw new Error('Pack not found');
    }

    if (currentPack.state === State.PUBLISHED) {
      throw new PackStateTransitionError(currentPack.state, State.PUBLISHED);
    }

    this.assertTransition(currentPack.state, State.VALIDATING);

    const validatingPack = await this.repository.updatePack({
      ...currentPack,
      state: State.VALIDATING,
    });

    const validation = await this.validator.validate(validatingPack);

    if (!validation.ok) {
      await this.repository.updatePack({
        ...validatingPack,
        state: State.DRAFT,
      });

      throw new PackValidationError(validation.errors);
    }

    this.assertTransition(validatingPack.state, State.PUBLISHED);

    await this.publisher.publish(validatingPack);

    return this.repository.updatePack({
      ...validatingPack,
      state: State.PUBLISHED,
      publishedAt: new Date(),
    });
  }

  private assertTransition(from: State, to: State): void {
    if (!ALLOWED_TRANSITIONS[from].includes(to)) {
      throw new PackStateTransitionError(from, to);
    }
  }
}
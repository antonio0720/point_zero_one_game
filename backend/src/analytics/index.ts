// backend/src/analytics/index.ts

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * POINT ZERO ONE — ANALYTICS / PUBLIC ENTRYPOINT
 * backend/src/analytics/index.ts
 *
 * Central exports and subsystem factories for backend analytics.
 *
 * This file gives the rest of the backend a single stable import surface while
 * preserving bounded contexts internally.
 *
 * Important:
 * - core modules remain flat exports
 * - domain modules are namespaced to prevent symbol collisions
 * - explicit top-level exports are kept only for subsystem construction
 * ═══════════════════════════════════════════════════════════════════════════════
 */

export * from './core/analytics_envelope';
export * from './core/analytics_names';
export * as AnalyticsValidation from './core/analytics_validation';
export * from './core/analytics_emitters';
export * from './core/analytics_outbox_emitter';
export * from './core/analytics_types';

export * as Season0Analytics from './season0';
export * as TrustAnalytics from './trust';
export * as VerificationAnalytics from './verification/events_verification';
export * as Season0DomainAnalytics from './mappers/season0_domain_mapper';
export * as TrustDomainAnalytics from './mappers/trust_domain_mapper';

export {
  createSeason0AnalyticsService,
  Season0AnalyticsService,
} from './season0';

export type { Season0EventContext } from './season0';

export {
  createTrustAnalyticsService,
  TrustAnalyticsService,
} from './trust';

export type { TrustEventContext } from './trust';

export {
  createVerificationAnalyticsService,
  VerificationAnalyticsService,
} from './verification/events_verification';

export type { VerificationEventContext } from './verification/events_verification';

export {
  createSeason0DomainAnalyticsMapper,
} from './mappers/season0_domain_mapper';

export type {
  Season0DomainAnalyticsMapper,
  Season0DomainMapperOptions,
} from './mappers/season0_domain_mapper';

export {
  createTrustDomainAnalyticsMapper,
} from './mappers/trust_domain_mapper';

export type {
  TrustDomainAnalyticsMapper,
  TrustDomainMapperOptions,
} from './mappers/trust_domain_mapper';

import {
  AnalyticsOutboxEmitter,
  createPgAnalyticsOutboxWriter,
} from './core/analytics_outbox_emitter';

import {
  CompositeAnalyticsEmitter,
  ConsoleAnalyticsEmitter,
  NoopAnalyticsEmitter,
} from './core/analytics_emitters';

import type {
  AnalyticsEmitter,
  AnalyticsSqlRunner,
} from './core/analytics_types';

import {
  createSeason0AnalyticsService,
  type Season0AnalyticsService,
  type Season0EventContext,
} from './season0';

import {
  createTrustAnalyticsService,
  type TrustAnalyticsService,
  type TrustEventContext,
} from './trust';

import {
  createVerificationAnalyticsService,
  type VerificationAnalyticsService,
  type VerificationEventContext,
} from './verification/events_verification';

import {
  createSeason0DomainAnalyticsMapper,
  type Season0DomainAnalyticsMapper,
  type Season0DomainMapperOptions,
} from './mappers/season0_domain_mapper';

import {
  createTrustDomainAnalyticsMapper,
  type TrustDomainAnalyticsMapper,
  type TrustDomainMapperOptions,
} from './mappers/trust_domain_mapper';

export interface AnalyticsSubsystem {
  emitter: AnalyticsEmitter;
  season0: Season0AnalyticsService;
  trust: TrustAnalyticsService;
  verification: VerificationAnalyticsService;
  mappers: {
    season0: Season0DomainAnalyticsMapper;
    trust: TrustDomainAnalyticsMapper;
  };
}

export interface AnalyticsSubsystemOptions {
  emitter?: AnalyticsEmitter;
  season0DefaultContext?: Season0EventContext;
  trustDefaultContext?: TrustEventContext;
  verificationDefaultContext?: VerificationEventContext;
  season0Mapper?: Omit<Season0DomainMapperOptions, 'analytics'>;
  trustMapper?: Omit<TrustDomainMapperOptions, 'analytics'>;
}

export function createAnalyticsSubsystem(
  options: AnalyticsSubsystemOptions = {},
): AnalyticsSubsystem {
  const emitter = options.emitter ?? new NoopAnalyticsEmitter();

  const season0 = createSeason0AnalyticsService(
    emitter,
    options.season0DefaultContext,
  );

  const trust = createTrustAnalyticsService(
    emitter,
    options.trustDefaultContext,
  );

  const verification = createVerificationAnalyticsService(
    emitter,
    options.verificationDefaultContext,
  );

  const season0Mapper = createSeason0DomainAnalyticsMapper({
    ...(options.season0Mapper ?? {}),
    analytics: season0,
  });

  const trustMapper = createTrustDomainAnalyticsMapper({
    ...(options.trustMapper ?? {}),
    analytics: trust,
  });

  return {
    emitter,
    season0,
    trust,
    verification,
    mappers: {
      season0: season0Mapper,
      trust: trustMapper,
    },
  };
}

export interface PgAnalyticsSubsystemOptions
  extends Omit<AnalyticsSubsystemOptions, 'emitter'> {
  tableName?: string;
  onConflictDoNothing?: boolean;
  withConsoleMirror?: boolean;
  consolePrefix?: string;
}

export function createPgAnalyticsSubsystem(
  runner: AnalyticsSqlRunner,
  options: PgAnalyticsSubsystemOptions = {},
): AnalyticsSubsystem {
  const outboxWriter = createPgAnalyticsOutboxWriter(
    runner,
    options.tableName,
  );

  const outboxEmitter = new AnalyticsOutboxEmitter(outboxWriter, {
    tableName: options.tableName,
    onConflictDoNothing: options.onConflictDoNothing ?? true,
  });

  const emitter =
    options.withConsoleMirror === true
      ? new CompositeAnalyticsEmitter(
          [
            outboxEmitter,
            new ConsoleAnalyticsEmitter(
              console,
              options.consolePrefix ?? '[pzo-analytics]',
            ),
          ],
          {
            sequential: true,
            failFast: true,
          },
        )
      : outboxEmitter;

  return createAnalyticsSubsystem({
    ...options,
    emitter,
  });
}
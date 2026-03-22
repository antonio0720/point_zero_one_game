/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT MEMORY SUBSYSTEM BARREL
 * FILE: backend/src/game/engine/chat/memory/index.ts
 * VERSION: 2026.03.22
 * AUTHORSHIP: Antonio T. Smith Jr. / OpenAI collaboration
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical, compile-oriented, truth-preserving entry point for the backend
 * chat memory subsystem.
 *
 * Design doctrine
 * ---------------
 * 1. Expose the full public surface of every memory module.
 * 2. Never fabricate exports that do not exist in source files.
 * 3. Preserve access to colliding module surfaces through namespace exports.
 * 4. Provide one deterministic subsystem factory for the instantiable runtime
 *    modules, without pretending broken or non-instantiable modules expose
 *    constructors they do not actually define.
 * 5. Keep imports genuinely used.
 * ============================================================================
 */

import type {
  ChatRelationshipServiceConfig,
} from '../ChatRelationshipService';
import {
  ChatRelationshipService,
  DEFAULT_CHAT_RELATIONSHIP_SERVICE_CONFIG,
} from '../ChatRelationshipService';

import * as ConversationMemoryStoreModule from './ConversationMemoryStore';
import * as MemorySalienceScorerModule from './MemorySalienceScorer';
import * as MemoryCompressionPolicyModule from './MemoryCompressionPolicy';
import * as QuoteRecallResolverModule from './QuoteRecallResolver';
import * as RelationshipLedgerModule from './RelationshipLedger';
import * as RelationshipResolverModule from './RelationshipResolver';
import * as RivalryEscalationPolicyModule from './RivalryEscalationPolicy';
import * as HelperTrustPolicyModule from './HelperTrustPolicy';

/**
 * Top-level star re-exports for modules whose public surfaces do not collide
 * with one another in a way that would make the barrel ambiguous.
 */
export * from './ConversationMemoryStore';
export * from './MemorySalienceScorer';
export * from './MemoryCompressionPolicy';
export * from './QuoteRecallResolver';
export * from './RelationshipLedger';
export * from './RivalryEscalationPolicy';
export * from './HelperTrustPolicy';

/**
 * Namespace re-exports for all modules, including colliding surfaces.
 *
 * RelationshipResolver.ts currently exports ledger-shaped symbols that collide
 * with RelationshipLedger.ts. Namespace exports preserve the full module
 * surface without turning the barrel into an ambiguous export graph.
 */
export {
  ConversationMemoryStoreModule,
  MemorySalienceScorerModule,
  MemoryCompressionPolicyModule,
  QuoteRecallResolverModule,
  RelationshipLedgerModule,
  RelationshipResolverModule,
  RivalryEscalationPolicyModule,
  HelperTrustPolicyModule,
};

export type ChatMemoryModuleName =
  | 'ConversationMemoryStore'
  | 'MemorySalienceScorer'
  | 'MemoryCompressionPolicy'
  | 'QuoteRecallResolver'
  | 'RelationshipLedger'
  | 'RelationshipResolver'
  | 'RivalryEscalationPolicy'
  | 'HelperTrustPolicy';

export interface ChatMemoryModuleDescriptor {
  readonly moduleName: ChatMemoryModuleName;
  readonly namespace: object;
  readonly hasTopLevelStarExport: boolean;
  readonly notes: readonly string[];
}


export type ConversationMemoryStoreExports = typeof ConversationMemoryStoreModule;
export type MemorySalienceScorerExports = typeof MemorySalienceScorerModule;
export type MemoryCompressionPolicyExports = typeof MemoryCompressionPolicyModule;
export type QuoteRecallResolverExports = typeof QuoteRecallResolverModule;
export type RelationshipLedgerExports = typeof RelationshipLedgerModule;
export type RelationshipResolverExports = typeof RelationshipResolverModule;
export type RivalryEscalationPolicyExports = typeof RivalryEscalationPolicyModule;
export type HelperTrustPolicyExports = typeof HelperTrustPolicyModule;

export const ConversationMemoryStoreExports = ConversationMemoryStoreModule;
export const MemorySalienceScorerExports = MemorySalienceScorerModule;
export const MemoryCompressionPolicyExports = MemoryCompressionPolicyModule;
export const QuoteRecallResolverExports = QuoteRecallResolverModule;
export const RelationshipLedgerExports = RelationshipLedgerModule;
export const RelationshipResolverExports = RelationshipResolverModule;
export const RivalryEscalationPolicyExports = RivalryEscalationPolicyModule;
export const HelperTrustPolicyExports = HelperTrustPolicyModule;

export const CHAT_MEMORY_MODULE_EXPORTS: Readonly<Record<ChatMemoryModuleName, ChatMemoryModuleDescriptor>> = Object.freeze({
  ConversationMemoryStore: Object.freeze({
    moduleName: 'ConversationMemoryStore',
    namespace: ConversationMemoryStoreModule,
    hasTopLevelStarExport: true,
    notes: Object.freeze([
      'Full top-level barrel export enabled.',
      'Namespace export preserved for grouped access and tooling introspection.',
    ]),
  }),
  MemorySalienceScorer: Object.freeze({
    moduleName: 'MemorySalienceScorer',
    namespace: MemorySalienceScorerModule,
    hasTopLevelStarExport: true,
    notes: Object.freeze([
      'Full top-level barrel export enabled.',
      'Includes report builders, replay frames, candidate selectors, and aggregate types.',
    ]),
  }),
  MemoryCompressionPolicy: Object.freeze({
    moduleName: 'MemoryCompressionPolicy',
    namespace: MemoryCompressionPolicyModule,
    hasTopLevelStarExport: true,
    notes: Object.freeze([
      'Full top-level barrel export enabled.',
      'Includes preview, execute, summarize, audit, digest, and comparison surfaces.',
    ]),
  }),
  QuoteRecallResolver: Object.freeze({
    moduleName: 'QuoteRecallResolver',
    namespace: QuoteRecallResolverModule,
    hasTopLevelStarExport: true,
    notes: Object.freeze([
      'Full top-level barrel export enabled.',
      'Includes all recall audit slices, proof packaging, cross-run intelligence, and utility functions.',
    ]),
  }),
  RelationshipLedger: Object.freeze({
    moduleName: 'RelationshipLedger',
    namespace: RelationshipLedgerModule,
    hasTopLevelStarExport: true,
    notes: Object.freeze([
      'Full top-level barrel export enabled.',
      'Primary canonical relationship read/write facade exposed directly.',
    ]),
  }),
  RelationshipResolver: Object.freeze({
    moduleName: 'RelationshipResolver',
    namespace: RelationshipResolverModule,
    hasTopLevelStarExport: false,
    notes: Object.freeze([
      'Preserved via namespace export only.',
      'Uploaded source collides with RelationshipLedger symbol names; top-level star export intentionally withheld to avoid ambiguous barrel exports.',
    ]),
  }),
  RivalryEscalationPolicy: Object.freeze({
    moduleName: 'RivalryEscalationPolicy',
    namespace: RivalryEscalationPolicyModule,
    hasTopLevelStarExport: true,
    notes: Object.freeze([
      'Full top-level barrel export enabled.',
      'Includes scenario presets, channel/persona/mode profiles, utility functions, telemetry, replay, and orchestration surfaces.',
    ]),
  }),
  HelperTrustPolicy: Object.freeze({
    moduleName: 'HelperTrustPolicy',
    namespace: HelperTrustPolicyModule,
    hasTopLevelStarExport: true,
    notes: Object.freeze([
      'Full top-level barrel export enabled.',
      'Includes assessments, selectors, delays, silence/followup decisions, diagnostics, examples, and class-based policy API.',
    ]),
  }),
});

export interface ChatMemorySubsystemConfig {
  readonly relationshipService?: ChatRelationshipService;
  readonly relationshipServiceConfig?: Partial<ChatRelationshipServiceConfig>;

  readonly store?: ConversationMemoryStoreModule.ConversationMemoryStore;
  readonly storeConfig?: Partial<ConversationMemoryStoreModule.ConversationMemoryStoreConfig>;

  readonly salienceScorer?: MemorySalienceScorerModule.MemorySalienceScorer;
  readonly salienceScorerConfig?: Partial<MemorySalienceScorerModule.MemorySalienceScorerConfig>;

  readonly compressionPolicy?: MemoryCompressionPolicyModule.MemoryCompressionPolicy;
  readonly compressionPolicyConfig?: Partial<MemoryCompressionPolicyModule.MemoryCompressionConfig>;

  readonly quoteRecallResolver?: QuoteRecallResolverModule.QuoteRecallResolver;
  readonly quoteRecallResolverConfig?: Partial<QuoteRecallResolverModule.QuoteRecallResolverConfig>;

  readonly relationshipLedger?: RelationshipLedgerModule.RelationshipLedger;
  readonly relationshipLedgerConfig?: Partial<
    Omit<RelationshipLedgerModule.RelationshipLedgerConfig, 'relationshipService'>
  >;

  readonly rivalryEscalationPolicy?: RivalryEscalationPolicyModule.RivalryEscalationPolicy;
  readonly rivalryEscalationPolicyConfig?: Partial<RivalryEscalationPolicyModule.RivalryEscalationPolicyConfig>;

  readonly helperTrustPolicy?: HelperTrustPolicyModule.HelperTrustPolicy;
  readonly helperTrustPolicyConfig?: Partial<HelperTrustPolicyModule.HelperTrustPolicyConfig>;
}

export interface ChatMemorySubsystem {
  readonly relationshipService: ChatRelationshipService;
  readonly store: ConversationMemoryStoreModule.ConversationMemoryStore;
  readonly salienceScorer: MemorySalienceScorerModule.MemorySalienceScorer;
  readonly compressionPolicy: MemoryCompressionPolicyModule.MemoryCompressionPolicy;
  readonly quoteRecallResolver: QuoteRecallResolverModule.QuoteRecallResolver;
  readonly relationshipLedger: RelationshipLedgerModule.RelationshipLedger;
  readonly rivalryEscalationPolicy: RivalryEscalationPolicyModule.RivalryEscalationPolicy;
  readonly helperTrustPolicy: HelperTrustPolicyModule.HelperTrustPolicy;
  readonly modules: typeof CHAT_MEMORY_MODULE_EXPORTS;
  readonly relationshipResolverModule: typeof RelationshipResolverModule;
}

export const DEFAULT_CHAT_MEMORY_SUBSYSTEM_CONFIG: ChatMemorySubsystemConfig = Object.freeze({
  relationshipServiceConfig: DEFAULT_CHAT_RELATIONSHIP_SERVICE_CONFIG,
  storeConfig: ConversationMemoryStoreModule.DEFAULT_CONVERSATION_MEMORY_STORE_CONFIG,
  salienceScorerConfig: {},
  compressionPolicyConfig: {},
  quoteRecallResolverConfig: QuoteRecallResolverModule.DEFAULT_QUOTE_RECALL_RESOLVER_CONFIG,
  relationshipLedgerConfig: Object.freeze({
    retention: RelationshipLedgerModule.DEFAULT_RELATIONSHIP_LEDGER_CONFIG.retention,
    highHeatThreshold01: RelationshipLedgerModule.DEFAULT_RELATIONSHIP_LEDGER_CONFIG.highHeatThreshold01,
    rescueDebtThreshold01: RelationshipLedgerModule.DEFAULT_RELATIONSHIP_LEDGER_CONFIG.rescueDebtThreshold01,
    rivalryThreshold01: RelationshipLedgerModule.DEFAULT_RELATIONSHIP_LEDGER_CONFIG.rivalryThreshold01,
    trustThreshold01: RelationshipLedgerModule.DEFAULT_RELATIONSHIP_LEDGER_CONFIG.trustThreshold01,
    callbackThreshold01: RelationshipLedgerModule.DEFAULT_RELATIONSHIP_LEDGER_CONFIG.callbackThreshold01,
    hotCounterpartWindowMs: RelationshipLedgerModule.DEFAULT_RELATIONSHIP_LEDGER_CONFIG.hotCounterpartWindowMs,
  }),
  rivalryEscalationPolicyConfig: RivalryEscalationPolicyModule.DEFAULT_RIVALRY_ESCALATION_POLICY_CONFIG,
  helperTrustPolicyConfig: HelperTrustPolicyModule.DEFAULT_HELPER_TRUST_POLICY_CONFIG,
});

export class ChatMemorySubsystemFactory {
  private readonly config: ChatMemorySubsystemConfig;

  public constructor(config: ChatMemorySubsystemConfig = DEFAULT_CHAT_MEMORY_SUBSYSTEM_CONFIG) {
    this.config = config;
  }

  public create(): ChatMemorySubsystem {
    const relationshipService =
      this.config.relationshipService ??
      new ChatRelationshipService({
        ...DEFAULT_CHAT_RELATIONSHIP_SERVICE_CONFIG,
        ...(this.config.relationshipServiceConfig ?? {}),
      });

    const store =
      this.config.store ??
      new ConversationMemoryStoreModule.ConversationMemoryStore({
        ...ConversationMemoryStoreModule.DEFAULT_CONVERSATION_MEMORY_STORE_CONFIG,
        ...(this.config.storeConfig ?? {}),
      });

    const salienceScorer =
      this.config.salienceScorer ??
      new MemorySalienceScorerModule.MemorySalienceScorer(
        this.config.salienceScorerConfig ?? {},
      );

    const compressionPolicy =
      this.config.compressionPolicy ??
      new MemoryCompressionPolicyModule.MemoryCompressionPolicy(
        this.config.compressionPolicyConfig ?? {},
        salienceScorer,
      );

    const quoteRecallResolver =
      this.config.quoteRecallResolver ??
      new QuoteRecallResolverModule.QuoteRecallResolver(
        store,
        this.config.quoteRecallResolverConfig ?? {},
      );

    const relationshipLedger =
      this.config.relationshipLedger ??
      new RelationshipLedgerModule.RelationshipLedger({
        ...(this.config.relationshipLedgerConfig ?? {}),
        relationshipService,
      });

    const rivalryEscalationPolicy =
      this.config.rivalryEscalationPolicy ??
      new RivalryEscalationPolicyModule.RivalryEscalationPolicy(
        this.config.rivalryEscalationPolicyConfig ?? {},
      );

    const helperTrustPolicy =
      this.config.helperTrustPolicy ??
      new HelperTrustPolicyModule.HelperTrustPolicy(
        this.config.helperTrustPolicyConfig ?? {},
      );

    return Object.freeze({
      relationshipService,
      store,
      salienceScorer,
      compressionPolicy,
      quoteRecallResolver,
      relationshipLedger,
      rivalryEscalationPolicy,
      helperTrustPolicy,
      modules: CHAT_MEMORY_MODULE_EXPORTS,
      relationshipResolverModule: RelationshipResolverModule,
    });
  }
}

export function createChatMemorySubsystem(config: ChatMemorySubsystemConfig = DEFAULT_CHAT_MEMORY_SUBSYSTEM_CONFIG): ChatMemorySubsystem {
  return new ChatMemorySubsystemFactory(config).create();
}

export function getChatMemoryModuleDescriptor(moduleName: ChatMemoryModuleName): ChatMemoryModuleDescriptor {
  return CHAT_MEMORY_MODULE_EXPORTS[moduleName];
}

export function listChatMemoryModules(): readonly ChatMemoryModuleDescriptor[] {
  return Object.freeze(Object.values(CHAT_MEMORY_MODULE_EXPORTS));
}

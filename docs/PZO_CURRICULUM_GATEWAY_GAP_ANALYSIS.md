# PZO Curriculum Gateway — Complete Gap Analysis & Script Specification Addendum

**Prepared for:** Antonio T. Smith Jr. / Density6 LLC  
**Date:** 2026-03-07  
**Scope:** Everything missing from the Phase 0–6 architecture document before the Python script can be written  
**Classification:** Execution-Grade Addendum — Not Theory

---

## 0. WHAT YOUR DOCUMENT GETS RIGHT

Your architecture document is structurally sound. The phase sequence (0→6), the domain decomposition (licensing control plane / curriculum services / content ops / trust-proof), the API surface map, the comparability envelope, and the "curriculum is a wrapper not a replacement" doctrine are all correct. The five forced decisions (schema system, gateway shape, institution truth, content truth, comparability definition) are the right decisions to force.

What follows is everything your document does not yet address that the Python script will need to handle — or that the script's output will be broken without.

---

## 1. THE GATEWAY-WIDE AUTH CRISIS (Not Just curriculum_routes.ts)

Your document focuses on fixing curriculum_routes.ts. But the problem is systemic. I counted **7 distinct auth patterns** across your 17 route files:

| Pattern | Files Using It | Problem |
|---------|---------------|---------|
| `authAndRbac(role)` — inline JWT + User.findOne | curriculum_routes.ts | Direct model import, inline JWT, role string matching |
| `jwt.verify(token, process.env.JWT_SECRET)` — raw inline | creator_economy_routes.ts, ladder_routes.ts | Duplicated JWT logic, inconsistent secret env var names |
| `jwt.verify(token, process.env.SECRET_KEY)` — different env var | institutions_routes.ts | **Different secret key name** than other files |
| `verifyToken` — imported from different paths | institutions_routes.ts (`../auth/jwt-utils`), partner_routes.ts (`../auth/jwt`) | Two different import paths for what should be the same thing |
| `verifyAdmin` — imported from `../auth/auth` | monetization_admin_routes.ts | Yet another auth module |
| `authMiddleware(role)` — imported from various paths | liveops_routes.ts (`../middleware/auth.middleware`), loss_is_content_routes.ts (`../middleware/auth`) | Different import paths, different module names |
| `AuthMiddleware` (HOF wrapper) | season0_routes.ts (from `../auth/auth.middleware`) | The only pattern that matches what the actual auth.middleware.ts file exports |

**What this means for the script:**

The Python script cannot just fix curriculum_routes.ts. It must generate a **unified gateway auth contract** that replaces all 7 patterns, or the curriculum routes will use one auth style while every other route file keeps its own incompatible variant. The script should:

1. Generate `backend/src/api-gateway/middleware/auth/index.ts` — the single canonical auth module
2. Generate a compatibility shim for each existing auth pattern that delegates to the canonical module
3. Emit a verification rule: "no route file imports jwt directly"
4. Emit a verification rule: "no route file references process.env.JWT_SECRET or process.env.SECRET_KEY directly"

**Decision required before scripting:** Do you want the script to normalize ALL 17 route files in Phase 0, or only curriculum? Recommendation: normalize all, because institutional routes (institutions_routes.ts) are a direct dependency of the curriculum gateway and they currently use a third auth pattern.

---

## 2. THE FOUR DIRECT-MODEL-IMPORT ROUTES

Your document identifies curriculum_routes.ts as importing models directly. But the repo has **four** files doing this:

| File | Models Imported |
|------|----------------|
| curriculum_routes.ts | OrgAdmin, Facilitator, User, Curriculum, Lesson, Pack |
| creator_economy_routes.ts | User, Creator, Subscription, Transaction |
| ladder_routes.ts | Ladder |
| monetization_admin_routes.ts | PolicyVersion, Experiment, KillswitchEvent |

The Python script must either:
- Fix all four (recommended), or
- Fix curriculum + institutions and flag the others as tech debt

**Decision required:** Fix all four, or scope to curriculum + institutions only?

---

## 3. MISSING: DATABASE MIGRATION STRATEGY

Your document defines 50+ new entity types (Institution, Cohort, CurriculumPack, PackVersion, BenchmarkDefinition, etc.) but never specifies how they get into the database. The deployment doc already has migration task stubs (`PZO_CURR_T030` through `PZO_CURR_T034`), but the Python script needs a concrete plan for:

1. **Migration file naming convention** — the deployment doc uses `2026_02_20_add_outcome_packs.sql` style. Is that canonical?
2. **Migration runner** — what tool? Raw SQL files? Knex? TypeORM migrations? Prisma? The repo appears to use a `migrations/` folder with raw SQL.
3. **Idempotency** — can the Python script generate migrations that are safe to re-run?
4. **Entity ↔ migration mapping** — the script should generate both the TypeScript entity/interface AND the SQL migration, keeping them in sync.

**What the script should add:**

- For every new entity interface generated, also generate a corresponding SQL migration file
- Generate a migration manifest that maps entity → migration → route → adapter
- Include rollback SQL for every migration

---

## 4. MISSING: EVENT BUS ARCHITECTURE

Your document mentions audit events but doesn't specify the event transport. At 20M concurrent, audit logging to a database table inside the request path is a non-starter. The script needs to know:

1. **Event transport** — BullMQ (already in the repo for roster imports), Redis Streams, Kafka, or NATS?
2. **Event schema** — what does a curriculum audit event look like?
3. **Event consumers** — who reads these events?

**Recommendation for the script:**

Generate an event catalog as a TypeScript enum + type map:

```typescript
enum CurriculumEvent {
  INSTITUTION_CREATED = 'curriculum.institution.created',
  COHORT_CREATED = 'curriculum.cohort.created',
  ROSTER_IMPORT_STARTED = 'curriculum.roster_import.started',
  ROSTER_IMPORT_COMPLETED = 'curriculum.roster_import.completed',
  PACK_ASSIGNED = 'curriculum.pack.assigned',
  PACK_VERSION_PUBLISHED = 'curriculum.pack_version.published',
  BENCHMARK_WINDOW_OPENED = 'curriculum.benchmark_window.opened',
  BENCHMARK_ATTEMPT_COMPLETED = 'curriculum.benchmark_attempt.completed',
  REPORT_REQUESTED = 'curriculum.report.requested',
  REPORT_GENERATED = 'curriculum.report.generated',
  EXPORT_DOWNLOADED = 'curriculum.export.downloaded',
  FACILITATOR_CERTIFIED = 'curriculum.facilitator.certified',
  BRANDING_UPDATED = 'curriculum.branding.updated',
}
```

The script should emit events to a pluggable transport (BullMQ queue by default, swappable to Kafka/Redis Streams via env flag). Not inline database writes.

**Decision required:** BullMQ as default event transport? Or do you want Kafka/Redis Streams from day one?

---

## 5. MISSING: MULTI-TENANCY ISOLATION MODEL

Your document says "resolve tenant from token and domain" but doesn't specify the isolation model. At 20M concurrent with multiple institutions, you need one of:

**Option A — Shared database, row-level tenant filtering (simplest)**  
Every query gets a `WHERE institution_id = ?` clause. The adapter layer enforces this. No institution ever sees another's data.

**Option B — Schema-per-tenant (PostgreSQL schemas)**  
Each institution gets its own schema. More isolation, more complexity.

**Option C — Database-per-tenant (maximum isolation)**  
Each institution gets its own database. Only viable for enterprise tier.

**Recommendation:** Option A for the script. Row-level filtering enforced in the service adapter layer, not in the gateway routes. The gateway attaches `tenantContext` to every request; adapters use it for every query.

**What the script must generate:**

- `TenantContext` interface: `{ institutionId, actorType, actorId, scopes[], requestId }`
- `resolveTenant` middleware that extracts this from the JWT
- Every adapter method signature must accept `TenantContext` as first parameter
- A verification rule: "no adapter method exists without TenantContext parameter"

---

## 6. MISSING: WEBHOOK / NOTIFICATION SYSTEM FOR INSTITUTIONS

Your document covers the API surface but never mentions webhooks. Institutional buyers need to know when:

- Roster import completes (success/failure)
- Benchmark window opens/closes
- Report generation finishes
- Export is ready for download
- Facilitator certification changes
- License is approaching expiration

**What the script should generate:**

- `backend/src/api-gateway/routes/curriculum/webhooks.routes.ts` — CRUD for webhook subscriptions
- `backend/src/services/curriculum/webhooks/webhook_dispatcher.ts` — event-driven webhook delivery
- Webhook event types enum
- Webhook subscription entity (institution_id, event_types[], target_url, secret, status)
- Retry policy (exponential backoff, dead letter after N failures)

---

## 7. MISSING: THE REQUEST/RESPONSE ENVELOPE IS NOT SPECIFIED

Your document says every response should normalize to `{ ok, requestId, data, error }`. But the script needs the exact TypeScript types:

```typescript
interface GatewayResponse<T = unknown> {
  ok: boolean;
  requestId: string;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
    cursor?: string;
  };
}
```

**What's missing from the envelope:**
- **Pagination metadata** — `meta.page`, `meta.pageSize`, `meta.total`, `meta.cursor`. Every list endpoint needs this.
- **Rate limit headers** — `X-RateLimit-Remaining`, `X-RateLimit-Reset` on every response.
- **Deprecation headers** — for future API versioning.

The script should generate response envelope utilities and enforce that every handler returns through them.

---

## 8. MISSING: OBSERVABILITY LAYER

Your document has zero mentions of structured logging, distributed tracing, metrics, or health checks. At 20M concurrent, you're flying blind without:

1. **Structured logging** — every log line must include `requestId`, `tenantId`, `actorId`, `route`, `statusCode`, `durationMs`
2. **Distributed tracing** — OpenTelemetry trace context propagation through gateway → adapter → service → queue
3. **Metrics** — request count by route/status, latency percentiles (p50/p95/p99), queue depth, active benchmark windows, report generation time
4. **Health checks** — `/health/live` (process alive), `/health/ready` (dependencies connected)
5. **Readiness probes** — for Kubernetes/container orchestration

**What the script should generate:**

- `backend/src/api-gateway/middleware/observability/logger.ts` — structured JSON logger
- `backend/src/api-gateway/middleware/observability/tracing.ts` — OpenTelemetry middleware
- `backend/src/api-gateway/middleware/observability/metrics.ts` — Prometheus-compatible metrics
- `backend/src/api-gateway/routes/health.routes.ts` — health/ready endpoints
- Correlation ID propagation through every adapter call

---

## 9. MISSING: RATE LIMITING AT SCALE

Your current rate limiter (`rate-limit.middleware.ts`) uses an **in-process `Map()`**. At 20M concurrent across multiple server instances, this means:

- Each instance has its own counter
- No shared state between instances
- A user can hit N × MAX_HITS (where N = number of instances)

**What the script should generate:**

- Redis-backed rate limiter (the `RateLimiterRedis` import exists in some route files but isn't actually wired to a shared Redis instance)
- Per-tenant rate limit buckets (institutions get different limits than consumer players)
- Separate rate limit tiers for:
  - Read endpoints (high limit)
  - Write endpoints (medium limit)
  - Report/export endpoints (low limit, these are expensive)
  - Roster import endpoints (very low limit, these are heavy)

---

## 10. MISSING: IDEMPOTENCY KEY IMPLEMENTATION

Your document mentions idempotency in Phase 0 but doesn't specify how. For institutional operations (roster import, pack assignment, benchmark creation, report generation), idempotency is critical because:

- Network retries can duplicate mutations
- Webhook deliveries can trigger duplicate downstream actions
- Queue workers can process the same job twice

**What the script should generate:**

- `backend/src/api-gateway/middleware/idempotency/idempotency.middleware.ts`
- Idempotency key extracted from `Idempotency-Key` header
- Redis-backed key store with TTL (24 hours default)
- On duplicate key: return cached response, do not re-execute
- Idempotency required on: POST (all mutations), PUT (all updates), not on GET/DELETE

---

## 11. MISSING: API VERSIONING STRATEGY

Your document uses `/api/v1/curriculum` but never specifies:

- How v2 gets introduced
- Whether v1 and v2 can coexist
- Deprecation timeline
- How clients discover API version changes

**Recommendation for the script:**

- Version in URL path (already chosen: `/api/v1/`)
- Script generates versioned route mounts: `app.use('/api/v1/curriculum', curriculumV1Router)`
- Script generates a version manifest at `/api/versions` that lists active versions
- Deprecation header middleware that adds `Deprecation: true` and `Sunset: <date>` when a version is scheduled for removal

---

## 12. MISSING: CONTENT DELIVERY / CDN STRATEGY FOR IMMUTABLE PACK ARTIFACTS

Your document says published packs should be immutable artifacts in object storage + CDN. But the script needs to know:

- Where are pack artifacts stored? S3? GCS? R2?
- What's the CDN? CloudFront? Cloudflare?
- What's the URL pattern for accessing a published pack version?
- How does the gateway serve pack metadata vs. the CDN serves pack content?

**What the script should generate:**

- `backend/src/services/curriculum/packs/pack_artifact_store.ts` — interface for storing/retrieving immutable pack artifacts
- `backend/src/services/curriculum/packs/pack_cdn_url_builder.ts` — generates signed CDN URLs for pack content
- Pack metadata served by gateway; pack content (scenario definitions, guide assets, debrief prompts) served by CDN
- Cache-Control headers: immutable for versioned content, short TTL for metadata

---

## 13. MISSING: TESTING PYRAMID SPECIFICATION

Your document has "verification rules" per phase but doesn't specify the actual testing strategy. The Python script should generate tests at four levels:

1. **Unit tests** — for each adapter, validator, middleware (mock dependencies)
2. **Integration tests** — for each route (real Express app, mocked services)
3. **Contract tests** — OpenAPI spec validation (generated spec matches actual route behavior)
4. **Load tests** — k6/Artillery scripts for benchmark/report/export endpoints

**What the script should generate per route module:**

- `*.unit.test.ts` — adapter logic tests
- `*.integration.test.ts` — HTTP-level route tests
- `*.contract.test.ts` — schema compliance tests
- Fixture factories for test data (institutions, cohorts, packs, benchmark windows)

---

## 14. MISSING: FEATURE FLAG INFRASTRUCTURE

Your document mentions feature flags but never specifies the system. At 20M concurrent, feature flags are how you safely roll out the curriculum product to institutions without affecting consumer players.

**What the script should generate:**

- `backend/src/api-gateway/middleware/feature-flags/feature_flags.middleware.ts`
- Flag evaluation: check flag → gate route → return 404 or proceed
- Flag sources: environment variables (simple), remote config service (scalable)
- Flags needed for curriculum launch:
  - `curriculum.enabled` — master switch
  - `curriculum.institutions.enabled` — institution registration
  - `curriculum.benchmarks.enabled` — benchmark system
  - `curriculum.reports.enabled` — report generation
  - `curriculum.exports.enabled` — export functionality
  - `curriculum.facilitator_os.enabled` — facilitator dashboard

---

## 15. MISSING: THE SEASON0 ↔ CURRICULUM BRIDGE

Your repo has a mature `season0_routes.ts` file that follows the correct pattern (imports `AuthMiddleware` from `../auth/auth.middleware`, uses `RateLimitMiddleware`, has proper typing). This is actually the **best-written route file in the gateway**. The curriculum routes should follow its patterns, not invent new ones.

**What the script should do:**

- Use `season0_routes.ts` as the architectural reference implementation
- Copy its patterns: HOF middleware wrapping, service injection, typed request/response, correlation ID
- Generate curriculum routes that are structurally identical to season0 patterns

---

## 16. MISSING: CROSS-ROUTE DEPENDENCIES (CURRICULUM ↔ INTEGRITY ↔ PROOF)

Your document acknowledges that curriculum is not isolated from run verification. But it doesn't specify the integration points. The Python script needs to generate adapter interfaces for:

1. **Curriculum → Integrity** — benchmark attempts must verify run integrity before contributing to institutional reports
2. **Curriculum → Proof** — benchmark receipts must include proof hashes from the CORD system
3. **Curriculum → Run Explorer** — benchmark replays must be accessible through the run explorer

**What the script should generate:**

- `backend/src/api-gateway/adapters/integrity_adapter.ts` — interface for verifying run integrity
- `backend/src/api-gateway/adapters/proof_adapter.ts` — interface for retrieving proof stamps
- `backend/src/api-gateway/adapters/run_explorer_adapter.ts` — interface for accessing run replays
- These adapters are used by the curriculum benchmark and measurement services

---

## 17. MISSING: GRACEFUL DEGRADATION & CIRCUIT BREAKER

At 20M concurrent, downstream services will fail. The curriculum gateway needs:

- Circuit breakers on every adapter call (trip after N failures, half-open after timeout)
- Fallback responses for read endpoints (serve cached data when service is down)
- Queue backpressure for report/export generation (reject new jobs when queue depth exceeds threshold)
- Timeout policies per adapter (roster import: 30s, report generation: 60s, metadata reads: 5s)

**What the script should generate:**

- `backend/src/api-gateway/middleware/resilience/circuit_breaker.ts`
- `backend/src/api-gateway/middleware/resilience/timeout.ts`
- `backend/src/api-gateway/middleware/resilience/backpressure.ts`
- Default timeout and circuit breaker configuration per adapter

---

## 18. MISSING: CORS AND SECURITY HEADERS

No mention of CORS policy for the curriculum API. Institutions will access this from their own domains. The script needs to generate:

- CORS middleware with configurable allowed origins (per institution)
- Security headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security`
- CSP headers for any HTML-rendered content (reports, trust packets)

---

## 19. MISSING: MANIFEST FORMAT SPECIFICATION

Your document says "the script reads a manifest." But you never defined the manifest format. Here's what I'd specify:

```yaml
# curriculum_gateway_manifest.yaml
version: "1.0"
gateway_prefix: "/api/v1/curriculum"
auth_contract: "bearer_jwt"
tenant_resolution: "jwt_claim"

routes:
  - module: institutions
    prefix: /institutions
    handlers:
      - method: POST
        path: /
        auth_scope: "curriculum:institutions:write"
        tenant_scope: "system_admin"
        request_schema: CreateInstitutionRequest
        response_schema: InstitutionResponse
        idempotent: true
        audit_event: INSTITUTION_CREATED
        cache_policy: none
        rate_limit_bucket: write
        adapter: licensingControlPlaneAdapter.createInstitution
      # ... more handlers

entities:
  - name: Institution
    table: institutions
    fields:
      - name: id
        type: uuid
        primary: true
      # ... more fields

adapters:
  - name: licensingControlPlaneAdapter
    target: backend/src/licensing_control_plane
    methods:
      - createInstitution
      - getInstitutionById
      # ... more methods

audit_events:
  - INSTITUTION_CREATED
  - COHORT_CREATED
  # ... more events

feature_flags:
  - curriculum.enabled
  - curriculum.institutions.enabled
  # ... more flags
```

The script should parse this manifest and generate everything from it. No hand-editing of generated files.

---

## 20. MISSING: SCRIPT SAFETY MECHANISMS

Your document says the script should have `plan`, `apply`, and `verify` modes. It should also have:

1. **Dry-run output** — show every file that would be created/modified with a diff preview
2. **Rollback manifest** — save a restore point before applying changes
3. **Conflict detection** — if a file already exists and differs from what the script would generate, prompt for resolution
4. **TypeScript compilation check** — after generating files, run `tsc --noEmit` to verify the generated code compiles
5. **Checksum verification** — after generating, compute SHA-256 of every generated file and store in a manifest for later verification
6. **Git integration** — optionally create a branch and commit the generated files

---

## 21. MISSING: THE PARTNER ↔ CURRICULUM OVERLAP

Your repo has `partner_routes.ts` which already has:
- `tenantRoutingMiddleware` (placeholder but correct concept)
- `verifyToken` auth
- `PartnerService` injection

Your deployment doc has partner distribution tasks (`PZO_DIST_T001` through `PZO_DIST_T063`) that define cohort assignment, enrollment, roster upload, and reporting — which significantly overlap with the curriculum control plane.

**The script must reconcile these two systems.** Either:
- Partners ARE institutions (just a different SKU/tier), or
- Partners are a separate entity that can OWN multiple institutions

**Recommendation:** Partners are a higher-order tenant. An institution belongs to a partner. The partner admin console delegates to institution-level controls. This matches your doc's "district and enterprise admin" phase (Phase 6).

**What the script should generate:**

- Partner entity as a parent of Institution
- Partner ↔ Institution relationship in the entity model
- Partner-scoped routes under `/api/v1/curriculum/partners/`
- Partner admin can see all institutions under their umbrella

---

## 22. MISSING: QUEUE TOPOLOGY FOR ASYNC OPERATIONS

Your document mentions async report/export generation and roster import queues. But the full queue topology needs to be specified:

| Queue | Purpose | Priority | Concurrency | Retry Policy |
|-------|---------|----------|-------------|-------------|
| `curriculum:roster-import` | Parse and validate roster files | Medium | 5 | 3 retries, exponential backoff |
| `curriculum:report-generation` | Generate cohort/institution reports | Low | 3 | 2 retries, 5min delay |
| `curriculum:export-generation` | Generate PDF/CSV/XLSX exports | Low | 2 | 2 retries, 5min delay |
| `curriculum:benchmark-scoring` | Score benchmark attempts | High | 10 | 3 retries, immediate |
| `curriculum:webhook-delivery` | Deliver webhook notifications | Medium | 5 | 5 retries, exponential backoff |
| `curriculum:measurement-rollup` | Aggregate measurement data | Low | 2 | 3 retries, 10min delay |
| `curriculum:audit-events` | Persist audit log entries | Low | 5 | 5 retries, 1min delay |

**What the script should generate:**

- Queue definitions in `backend/src/services/curriculum/queues/index.ts`
- Worker stubs for each queue
- Queue health monitoring (depth, failed jobs, processing rate)
- Dead letter queue configuration

---

## 23. MISSING: COPPA / FERPA / PRIVACY COMPLIANCE ENFORCEMENT IN CODE

Your deployment doc mentions COPPA-ready consent posture and FERPA considerations. But the script needs to enforce this in code, not just in docs:

1. **Age gate middleware** — if institution is K-12, enforce additional data minimization
2. **PII redaction** — learner names never appear in aggregate reports
3. **Data retention enforcement** — automatic purge jobs for expired data
4. **Consent tracking** — per-learner consent status must be checked before data collection
5. **Export restrictions** — learner-level exports blocked for restricted tiers

**What the script should generate:**

- `backend/src/api-gateway/middleware/privacy/age_gate.middleware.ts`
- `backend/src/api-gateway/middleware/privacy/pii_redaction.middleware.ts`
- `backend/src/services/curriculum/privacy/retention_enforcer.ts`
- Privacy tier enum: `MINIMAL | STANDARD | RESEARCH`
- Per-institution privacy tier configuration

---

## 24. CORRECTED: YOUR ENTITY LIST IS INCOMPLETE

Your document lists ~50 entities across four layers. Cross-referencing with your deployment doc tasks, monetization plan, and game mode bible, these entities are missing:

**From the monetization/entitlement system:**
- `CurriculumSku` — the purchasable unit (maps to monetization plan §20)
- `OrgEntitlement` — what an org has paid for
- `EntitlementReceipt` — append-only proof of purchase

**From the partner distribution system:**
- `Partner` — parent entity for institutions
- `PartnerEdition` — SKU customization per partner type (Employer/Bank/EAP)
- `PartnerContract` — billing/licensing terms

**From the game integration:**
- `ScenarioSeed` — the deterministic seed for a benchmark scenario (critical for comparability)
- `CardCatalogVersion` — pinned card catalog at time of benchmark (your card logic bible makes clear cards behave differently by mode; the version must be locked)
- `EngineVersion` — pinned engine version (your game mode bible has 7 engines whose behavior must be frozen for comparability)
- `ModeOverlayVersion` — pinned mode overlay (card legality/targeting changes by mode)

**From the CORD/proof system:**
- `CordScore` — the Cryptographically-Verified Sovereignty Score from a benchmark run
- `ProofHash` — SHA-256 of seed + tick stream checksum + outcome (from your game mode bible)
- `IntegrityVerification` — verification status of a benchmark attempt

---

## 25. THE COMPLETE FILE TREE THE SCRIPT SHOULD PRODUCE

Adding everything from sections 1–24 above to your original document's output list:

```
backend/src/api-gateway/
├── middleware/
│   ├── auth/
│   │   ├── index.ts                    # Unified auth contract
│   │   ├── require_auth.ts             # Base auth check
│   │   ├── resolve_tenant.ts           # Tenant context resolution
│   │   ├── require_scope.ts            # Scope-based access control
│   │   ├── require_institution_access.ts
│   │   └── require_facilitator_or_admin.ts
│   ├── validation/
│   │   ├── schema_validator.ts         # Ajv-based request validation
│   │   └── schemas/                    # Per-route JSON schemas
│   ├── observability/
│   │   ├── logger.ts                   # Structured JSON logger
│   │   ├── tracing.ts                  # OpenTelemetry middleware
│   │   ├── metrics.ts                  # Prometheus metrics
│   │   └── correlation_id.ts           # Request ID propagation
│   ├── resilience/
│   │   ├── circuit_breaker.ts
│   │   ├── timeout.ts
│   │   └── backpressure.ts
│   ├── privacy/
│   │   ├── age_gate.middleware.ts
│   │   └── pii_redaction.middleware.ts
│   ├── idempotency/
│   │   └── idempotency.middleware.ts
│   ├── feature_flags/
│   │   └── feature_flags.middleware.ts
│   ├── rate_limit/
│   │   └── distributed_rate_limit.ts   # Redis-backed, replaces in-process Map
│   ├── security/
│   │   ├── cors.ts
│   │   └── security_headers.ts
│   ├── errors/
│   │   └── error_handler.ts            # Centralized error → envelope conversion
│   ├── audit/
│   │   └── audit_logger.ts             # Event bus audit emitter
│   └── tenant/
│       └── tenant_context.ts           # TenantContext type + resolution
├── routes/
│   ├── curriculum/
│   │   ├── index.ts                    # Master curriculum router
│   │   ├── institutions.routes.ts
│   │   ├── facilitators.routes.ts
│   │   ├── cohorts.routes.ts
│   │   ├── rosters.routes.ts
│   │   ├── packs.routes.ts
│   │   ├── assignments.routes.ts
│   │   ├── benchmarks.routes.ts
│   │   ├── guides.routes.ts
│   │   ├── reports.routes.ts
│   │   ├── exports.routes.ts
│   │   ├── public.routes.ts
│   │   ├── webhooks.routes.ts
│   │   └── branding.routes.ts
│   └── health.routes.ts
├── adapters/
│   ├── licensing_control_plane.adapter.ts
│   ├── curriculum_packs.adapter.ts
│   ├── curriculum_measurement.adapter.ts
│   ├── curriculum_guides.adapter.ts
│   ├── trust_proof.adapter.ts
│   ├── integrity.adapter.ts
│   ├── run_explorer.adapter.ts
│   └── webhook_dispatcher.adapter.ts
├── contracts/
│   └── curriculum/
│       ├── gateway_response.ts         # GatewayResponse<T> envelope
│       ├── tenant_context.ts           # TenantContext interface
│       ├── institution.dto.ts
│       ├── facilitator.dto.ts
│       ├── cohort.dto.ts
│       ├── roster_import.dto.ts
│       ├── pack.dto.ts
│       ├── pack_version.dto.ts
│       ├── assignment.dto.ts
│       ├── benchmark.dto.ts
│       ├── benchmark_attempt.dto.ts
│       ├── guide.dto.ts
│       ├── report.dto.ts
│       ├── export.dto.ts
│       ├── branding.dto.ts
│       ├── webhook_subscription.dto.ts
│       └── audit_events.ts             # CurriculumEvent enum
├── events/
│   ├── curriculum_event_bus.ts         # Pluggable transport (BullMQ default)
│   └── curriculum_event_types.ts       # Event type definitions
└── queues/
    ├── index.ts                        # Queue definitions
    ├── roster_import.worker.ts
    ├── report_generation.worker.ts
    ├── export_generation.worker.ts
    ├── benchmark_scoring.worker.ts
    ├── webhook_delivery.worker.ts
    ├── measurement_rollup.worker.ts
    └── audit_event.worker.ts

backend/test/curriculum_gateway/
├── auth.test.ts
├── tenant_resolution.test.ts
├── institutions.integration.test.ts
├── cohorts.integration.test.ts
├── packs.integration.test.ts
├── benchmarks.integration.test.ts
├── reports.integration.test.ts
├── schema_validation.test.ts
├── idempotency.test.ts
├── rate_limit.test.ts
└── fixtures/
    ├── institution.fixture.ts
    ├── cohort.fixture.ts
    ├── pack.fixture.ts
    └── benchmark.fixture.ts

docs/curriculum_gateway/
├── architecture.md
├── api_reference.md
├── migration_manifest.md
├── event_catalog.md
├── queue_topology.md
├── privacy_compliance.md
└── runbook.md

migrations/curriculum/
├── 001_create_institutions.sql
├── 002_create_cohorts.sql
├── 003_create_roster_imports.sql
├── 004_create_packs.sql
├── 005_create_pack_versions.sql
├── 006_create_assignments.sql
├── 007_create_benchmarks.sql
├── 008_create_benchmark_attempts.sql
├── 009_create_reports.sql
├── 010_create_exports.sql
├── 011_create_facilitators.sql
├── 012_create_branding.sql
├── 013_create_webhook_subscriptions.sql
├── 014_create_audit_log.sql
├── 015_create_entitlements.sql
└── 016_create_measurement_rollups.sql

openapi/
└── curriculum.v1.yaml
```

---

## 26. DECISIONS REQUIRED BEFORE SCRIPTING

These are blocking decisions. The Python script cannot proceed without answers:

| # | Decision | Options | Recommendation |
|---|----------|---------|----------------|
| 1 | Fix all 17 routes or curriculum only? | All / Curriculum+Institutions / Curriculum only | All (auth unification) |
| 2 | Event transport | BullMQ / Redis Streams / Kafka | BullMQ (already in repo) |
| 3 | Tenant isolation model | Row-level / Schema-per-tenant / DB-per-tenant | Row-level |
| 4 | Migration tool | Raw SQL / Knex / TypeORM / Prisma | Raw SQL (matches existing repo) |
| 5 | Schema validation runtime | Ajv / Zod→Ajv / Joi | Ajv (your doc recommends this) |
| 6 | Partner ↔ Institution relationship | Partners ARE institutions / Partners OWN institutions | Partners OWN institutions |
| 7 | Season0 patterns as reference? | Yes / No | Yes (best-written route file) |
| 8 | Git branch creation? | Auto-branch / Manual | Your call |
| 9 | Script language | Python 3.10+ / Node.js | Python (your doc specifies Python) |
| 10 | Manifest format | YAML / JSON / TOML | YAML (most readable for this size) |

---

## 27. SCRIPT EXECUTION PHASES (REVISED)

Based on all gaps above, the Python script's internal execution should be:

```
Pass 0:  Parse manifest
Pass 1:  Inventory existing repo structure
Pass 2:  Validate expected directories exist (create if missing)
Pass 3:  Back up all files that will be touched
Pass 4:  Generate unified auth middleware (replaces 7 patterns)
Pass 5:  Generate tenant resolution middleware
Pass 6:  Generate observability middleware (logger, tracing, metrics)
Pass 7:  Generate resilience middleware (circuit breaker, timeout)
Pass 8:  Generate security middleware (CORS, headers, rate limit)
Pass 9:  Generate privacy middleware (age gate, PII redaction)
Pass 10: Generate gateway response envelope and error handler
Pass 11: Generate idempotency middleware
Pass 12: Generate feature flag middleware
Pass 13: Generate contracts and DTOs
Pass 14: Generate adapter interfaces
Pass 15: Generate route modules (13 sub-routers)
Pass 16: Generate event catalog and event bus
Pass 17: Generate queue definitions and worker stubs
Pass 18: Generate validation schemas (JSON Schema for Ajv)
Pass 19: Generate SQL migrations
Pass 20: Generate OpenAPI spec fragment
Pass 21: Generate test fixtures
Pass 22: Generate test files
Pass 23: Generate documentation
Pass 24: Patch curriculum_routes.ts into compatibility shim
Pass 25: Patch index mounts / exports
Pass 26: Run verification checks
Pass 27: Generate checksum manifest
```

---

## 28. VERIFICATION RULES (COMPLETE LIST)

Adding to your original verification rules:

**Architecture rules (fail the script if violated):**
1. No curriculum route imports models/entities directly
2. No route file imports `jwt` or `jsonwebtoken` directly
3. No route file references `process.env.JWT_SECRET` or `process.env.SECRET_KEY`
4. No route defines inline JWT verification
5. No mutation route lacks schema validation
6. No route lacks correlation ID attachment
7. No route lacks audit event mapping
8. No adapter method exists without TenantContext parameter
9. No published pack version missing comparability fields
10. No report path missing safe aggregation controls
11. All routes mounted under one canonical curriculum root
12. All benchmark/report/export flows require tenant context
13. No direct database access in any gateway route file
14. Every queue has a dead letter configuration
15. Every webhook subscription has a retry policy
16. Every feature flag has a default value
17. Every migration has a rollback SQL
18. Response envelope is used for every handler (no raw `res.json()`)
19. Rate limit middleware is attached to every non-public route
20. Health check routes exist and return structured responses

---

This document adds 28 sections of missing infrastructure, decisions, and specifications to your original Phase 0–6 architecture. With these gaps filled, the Python script can generate a complete, production-grade curriculum gateway — not a larger stub.

Next prompt: we build the script.

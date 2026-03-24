/*
 * POINT ZERO ONE — BACKEND CASCADE TEMPLATE VALIDATOR
 * /backend/src/game/engine/cascade/CascadeTemplateValidator.ts
 *
 * Doctrine:
 * - Validation is authoritative, standalone, and deterministic.
 * - Issue codes are sourced from the canonical types registry.
 * - All authored cascade templates must be validated before entering any engine.
 * - Warnings are advisory; errors are blocking for production deployment.
 * - Validators must remain snapshot-free: they consume authored definitions only.
 *
 * Design:
 * - CascadeTemplateValidator is a pure class — no constructor state required.
 * - validateTemplate() covers all fields in the CascadeTemplate interface.
 * - validateManifest() covers cross-template constraints.
 * - ML-facing methods expose numeric validation quality scores.
 * - All constants, comparators, and issue codes are sourced from types.ts.
 */

import type { EffectPayload, ModeCode, PressureTier } from '../core/GamePrimitives';
import {
  CASCADE_DEFAULT_MODE_OFFSET_MODIFIER,
  CASCADE_DEFAULT_PHASE_SCALAR,
  CASCADE_DEFAULT_PRESSURE_SCALAR,
  CASCADE_TEMPLATE_DEFAULTS,
  CASCADE_TEMPLATE_VALIDATION_ISSUE_CODES,
  EMPTY_TEMPLATE_NOTES,
  NUMERIC_EFFECT_FIELDS,
  RECOVERY_CONDITION_COMPARATOR_BY_KIND,
  RECOVERY_CONDITION_KINDS,
  RECOVERY_CONDITION_STATUSES,
  isCascadeSeverity,
  isCascadeTemplateId,
} from './types';
import type {
  CascadeManifestValidationResult,
  CascadeSeverity,
  CascadeSupportedPhase,
  CascadeTemplate,
  CascadeTemplateId,
  CascadeTemplateManifest,
  CascadeTemplateManifestSummary,
  CascadeTemplateValidationIssue,
  CascadeTemplateValidationIssueCode,
  CascadeTemplateValidationResult,
  CascadeTemplateValidationSeverity,
  NumericEffectField,
  RecoveryCondition,
  RecoveryConditionComparator,
  RecoveryConditionKind,
} from './types';

// -----------------------------------------------------------------------------
// Internal Validation Types
// -----------------------------------------------------------------------------

/**
 * Internal mutable issue builder — becomes frozen before it leaves the validator.
 */
interface MutableIssue {
  code: CascadeTemplateValidationIssueCode;
  severity: CascadeTemplateValidationSeverity;
  message: string;
  templateId: string;
  field: string | null;
  notes: string[];
}

/**
 * Internal context passed through field-level validators.
 */
interface ValidationContext {
  readonly templateId: string;
  readonly template: CascadeTemplate;
  readonly issues: MutableIssue[];
}

/**
 * Manifest-level context passed through cross-template validators.
 */
interface ManifestValidationContext {
  readonly manifest: CascadeTemplateManifest;
  readonly issues: MutableIssue[];
  readonly seenIds: Set<string>;
}

/**
 * Per-field severity override table. Fields that are optional in production
 * may be warnings rather than errors.
 *
 * Used by applyFieldSeverityOverrides() to remap validation result severities
 * without re-running validation — useful for authoring tools that want to
 * suppress specific advisory codes in a particular deployment context.
 */
export interface FieldSeverityOverride {
  readonly field: string;
  readonly code: CascadeTemplateValidationIssueCode;
  readonly severity: CascadeTemplateValidationSeverity;
}

// -----------------------------------------------------------------------------
// Internal Constants
// -----------------------------------------------------------------------------

/**
 * Hard limits used during link set and scalar validation.
 */
const HARD_LIMITS = Object.freeze({
  MAX_CONCURRENT_UPPER: 32,
  MAX_TRIGGERS_PER_RUN_UPPER: 128,
  MAX_LINKS: 16,
  MIN_OFFSET: 0,
  MIN_TICK_SPACING_LOWER: 0,
  MIN_TICK_SPACING_UPPER: 64,
  MODE_OFFSET_MODIFIER_LOWER: -20,
  MODE_OFFSET_MODIFIER_UPPER: 20,
  PRESSURE_SCALAR_LOWER: 0.5,
  PRESSURE_SCALAR_UPPER: 3.0,
  PHASE_SCALAR_LOWER: 0.5,
  PHASE_SCALAR_UPPER: 3.0,
  COMBINED_SCALAR_MIN_LOWER: 0.1,
  COMBINED_SCALAR_MAX_UPPER: 5.0,
  NUMERIC_DELTA_MAGNITUDE_UPPER: 100_000,
  RATIO_LOWER: 0.0,
  RATIO_UPPER: 1.0,
});

/**
 * Fields that must be checked for effects (numeric deltas in EffectPayload).
 */
const EFFECT_NUMERIC_FIELDS: readonly NumericEffectField[] = NUMERIC_EFFECT_FIELDS;

/**
 * Issue codes that are inherently errors (not warnings). All others default to WARNING.
 */
const ALWAYS_ERROR_CODES: ReadonlySet<CascadeTemplateValidationIssueCode> = new Set<CascadeTemplateValidationIssueCode>([
  'UNKNOWN_TEMPLATE_ID',
  'EMPTY_LABEL',
  'EMPTY_DEDUPE_KEY',
  'NON_POSITIVE_MAX_CONCURRENT',
  'NON_POSITIVE_MAX_TRIGGERS_PER_RUN',
  'OFFSET_EFFECT_LENGTH_MISMATCH',
  'EMPTY_LINK_SET',
  'NEGATIVE_OFFSET',
  'INVALID_RECOVERY_CONDITION',
  'DUPLICATE_TEMPLATE_ID',
]);

/**
 * Supported modes and pressure tiers used in scalar key validation.
 */
const VALID_MODE_CODES: readonly ModeCode[] = Object.freeze(
  Object.keys(CASCADE_DEFAULT_MODE_OFFSET_MODIFIER) as ModeCode[],
);

const VALID_PRESSURE_TIERS: readonly PressureTier[] = Object.freeze(
  Object.keys(CASCADE_DEFAULT_PRESSURE_SCALAR) as PressureTier[],
);

const VALID_PHASE_CODES: readonly CascadeSupportedPhase[] = Object.freeze(
  Object.keys(CASCADE_DEFAULT_PHASE_SCALAR) as CascadeSupportedPhase[],
);

/**
 * Default per-field severity overrides used by applyFieldSeverityOverrides().
 *
 * These downgrade specific advisory codes to WARNING so they do not block
 * production deployment while remaining visible in development reports:
 *
 * - UNSORTED_OFFSETS on baseOffsets: many authoring tools auto-sort; keep
 *   this advisory rather than blocking.
 * - EXCLUSIVITY_GROUP_EMPTY on exclusivityGroup: single-member groups are
 *   valid in manifests designed to grow.
 */
const DEFAULT_FIELD_SEVERITY_OVERRIDES: readonly FieldSeverityOverride[] = Object.freeze([
  { field: 'baseOffsets', code: 'UNSORTED_OFFSETS', severity: 'WARNING' },
  { field: 'exclusivityGroup', code: 'EXCLUSIVITY_GROUP_EMPTY', severity: 'WARNING' },
] as FieldSeverityOverride[]);

// -----------------------------------------------------------------------------
// CascadeTemplateValidator
// -----------------------------------------------------------------------------

/**
 * CascadeTemplateValidator
 *
 * Standalone, snapshot-free authoritative validator for cascade templates and
 * manifests. Produces structured `CascadeTemplateValidationResult` and
 * `CascadeManifestValidationResult` objects from the types registry.
 *
 * Validation covers:
 * - Template identity (id, label, dedupeKey, polarity)
 * - Concurrency and trigger budget limits
 * - Link sets (offsets, effects, sorted ordering, no negative offsets)
 * - Recovery conditions (structured) and legacy tags
 * - Scalar overrides (modeOffsetModifier, pressureScalar, phaseScalar)
 * - Combined scalar range constraints
 * - Timing constraints (minTickSpacing)
 * - Cross-template manifest constraints (duplicate IDs, exclusivity)
 *
 * All issue codes are sourced from `CASCADE_TEMPLATE_VALIDATION_ISSUE_CODES`.
 * All defaults are sourced from `CASCADE_TEMPLATE_DEFAULTS`.
 */
export class CascadeTemplateValidator {
  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Validates a single cascade template against the full authored interface.
   *
   * Returns a `CascadeTemplateValidationResult` with:
   * - `valid`: true only if there are zero ERROR-severity issues
   * - `issues`: all issues (errors + warnings)
   * - `errors`: only ERROR-severity issues
   * - `warnings`: only WARNING-severity issues
   *
   * Safe to call repeatedly; produces no side effects.
   */
  public validateTemplate(template: CascadeTemplate): CascadeTemplateValidationResult {
    const ctx: ValidationContext = {
      templateId: template.templateId ?? 'UNKNOWN',
      template,
      issues: [],
    };

    this.validateTemplateId(ctx);
    this.validateLabel(ctx);
    this.validateDedupeKey(ctx);
    this.validatePolarity(ctx);
    this.validateMaxConcurrent(ctx);
    this.validateMaxTriggersPerRun(ctx);
    this.validateLinkSet(ctx);
    this.validateRecovery(ctx);
    this.validateRecoveryTags(ctx);
    this.validateModeOffsetModifier(ctx);
    this.validatePressureScalar(ctx);
    this.validatePhaseScalar(ctx);
    this.validateCombinedScalarRange(ctx);
    this.validateMinTickSpacing(ctx);

    const issues = Object.freeze(ctx.issues.map((issue) => this.freezeIssue(issue)));
    const errors = issues.filter((issue) => issue.severity === 'ERROR');
    const warnings = issues.filter((issue) => issue.severity === 'WARNING');

    return Object.freeze({
      valid: errors.length === 0,
      issues,
      errors,
      warnings,
    });
  }

  /**
   * Validates a full cascade template manifest — all templates together.
   *
   * In addition to validating each template independently, checks for:
   * - Duplicate template IDs across the manifest
   * - Empty exclusivity groups
   * - Required template coverage (negative + positive IDs)
   *
   * Returns a `CascadeManifestValidationResult` with per-template issue grouping
   * and a manifest summary.
   */
  public validateManifest(manifest: CascadeTemplateManifest): CascadeManifestValidationResult {
    const manifestCtx: ManifestValidationContext = {
      manifest,
      issues: [],
      seenIds: new Set<string>(),
    };

    const byTemplateId: Record<string, CascadeTemplateValidationIssue[]> = {};

    for (const [templateId, template] of Object.entries(manifest)) {
      const templateResult = this.validateTemplate(template as CascadeTemplate);
      byTemplateId[templateId] = [...templateResult.issues];

      for (const issue of templateResult.issues) {
        manifestCtx.issues.push({
          code: issue.code,
          severity: issue.severity,
          message: issue.message,
          templateId: issue.templateId,
          field: issue.field,
          notes: [...issue.notes],
        });
      }

      this.validateManifestDuplicateId(manifestCtx, templateId);
    }

    this.validateManifestExclusivityGroups(manifestCtx);
    this.validateManifestCoverage(manifestCtx);

    const issues = Object.freeze(manifestCtx.issues.map((issue) => this.freezeIssue(issue)));
    const frozenByTemplateId: Record<string, readonly CascadeTemplateValidationIssue[]> = {};
    for (const [tid, tIssues] of Object.entries(byTemplateId)) {
      frozenByTemplateId[tid] = Object.freeze(tIssues.map((issue) => this.freezeIssue({
        code: issue.code,
        severity: issue.severity,
        message: issue.message,
        templateId: issue.templateId,
        field: issue.field,
        notes: [...issue.notes],
      })));
    }

    const summary = this.buildManifestSummary(manifest);

    return Object.freeze({
      valid: issues.every((issue) => issue.severity !== 'ERROR'),
      issues,
      byTemplateId: Object.freeze(frozenByTemplateId),
      summary,
    });
  }

  /**
   * Returns the complete canonical vocabulary of validation issue codes from
   * the types module. Useful for tooling that needs to enumerate all supported
   * error/warning states without running actual validation.
   */
  public listSupportedIssueCodes(): typeof CASCADE_TEMPLATE_VALIDATION_ISSUE_CODES {
    return CASCADE_TEMPLATE_VALIDATION_ISSUE_CODES;
  }

  /**
   * Returns the default severity for a given issue code.
   * All codes not in the explicit ERROR set default to WARNING.
   */
  public getDefaultSeverity(
    code: CascadeTemplateValidationIssueCode,
  ): CascadeTemplateValidationSeverity {
    return ALWAYS_ERROR_CODES.has(code) ? 'ERROR' : 'WARNING';
  }

  /**
   * Filters all supported issue codes by their default severity.
   */
  public getIssueCodesBySeverity(
    severity: CascadeTemplateValidationSeverity,
  ): readonly CascadeTemplateValidationIssueCode[] {
    return Object.freeze(
      CASCADE_TEMPLATE_VALIDATION_ISSUE_CODES.filter(
        (code) => this.getDefaultSeverity(code) === severity,
      ),
    );
  }

  /**
   * Returns the default template configuration from CASCADE_TEMPLATE_DEFAULTS.
   * Useful for diff-based validation that wants to highlight deviations from
   * authored defaults.
   */
  public getTemplateDefaults(): typeof CASCADE_TEMPLATE_DEFAULTS {
    return CASCADE_TEMPLATE_DEFAULTS;
  }

  /**
   * Returns the default mode offset modifier table.
   */
  public getDefaultModeOffsetModifier(): typeof CASCADE_DEFAULT_MODE_OFFSET_MODIFIER {
    return CASCADE_DEFAULT_MODE_OFFSET_MODIFIER;
  }

  /**
   * Returns the default pressure scalar table.
   */
  public getDefaultPressureScalar(): typeof CASCADE_DEFAULT_PRESSURE_SCALAR {
    return CASCADE_DEFAULT_PRESSURE_SCALAR;
  }

  /**
   * Returns the default phase scalar table.
   */
  public getDefaultPhaseScalar(): typeof CASCADE_DEFAULT_PHASE_SCALAR {
    return CASCADE_DEFAULT_PHASE_SCALAR;
  }

  /**
   * Returns the canonical vocabulary of recovery condition statuses.
   * Useful for tooling that wants to enumerate all valid evaluation states.
   */
  public getRecoveryConditionStatuses(): typeof RECOVERY_CONDITION_STATUSES {
    return RECOVERY_CONDITION_STATUSES;
  }

  /**
   * Returns the comparator for a given recovery condition kind.
   * Exposes `RECOVERY_CONDITION_COMPARATOR_BY_KIND` through a typed accessor.
   */
  public getComparatorForRecoveryKind(kind: RecoveryConditionKind): RecoveryConditionComparator {
    return RECOVERY_CONDITION_COMPARATOR_BY_KIND[kind];
  }

  /**
   * Returns the empty notes reference from the types module.
   * Used to initialize issue notes when none are authored.
   */
  public getEmptyTemplateNotes(): typeof EMPTY_TEMPLATE_NOTES {
    return EMPTY_TEMPLATE_NOTES;
  }

  /**
   * Computes a numeric validation quality score for a single template in [0, 1].
   *
   * Score composition:
   * - 0 if any ERROR issues exist
   * - 1 if no issues at all
   * - Intermediate: 1 - (warningCount / maxExpectedWarnings) where max is 8
   *
   * Useful for:
   * - ML-based quality sorting of authored templates
   * - Dashboard health indicators
   * - Authoring tool quality gates
   */
  public computeTemplateQualityScore(template: CascadeTemplate): number {
    const result = this.validateTemplate(template);

    if (!result.valid) {
      return 0;
    }

    if (result.warnings.length === 0) {
      return 1;
    }

    const maxExpectedWarnings = 8;
    return Math.max(0, 1 - result.warnings.length / maxExpectedWarnings);
  }

  /**
   * Computes a numeric validation quality score for a full manifest in [0, 1].
   * Returns the average quality score across all templates in the manifest.
   */
  public computeManifestQualityScore(manifest: CascadeTemplateManifest): number {
    const templates = Object.values(manifest) as CascadeTemplate[];

    if (templates.length === 0) {
      return 0;
    }

    const scores = templates.map((template) => this.computeTemplateQualityScore(template));
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }

  /**
   * Returns a human-readable validation report for a single template.
   * Suitable for developer consoles, CI output, and authoring tool feedback.
   */
  public getValidationReport(template: CascadeTemplate): string {
    const result = this.validateTemplate(template);
    const score = this.computeTemplateQualityScore(template);

    const lines: string[] = [
      `Template: ${template.templateId}`,
      `Label: ${template.label}`,
      `Valid: ${String(result.valid)}`,
      `Quality Score: ${score.toFixed(3)}`,
      `Errors: ${result.errors.length}`,
      `Warnings: ${result.warnings.length}`,
    ];

    if (result.errors.length > 0) {
      lines.push('--- ERRORS ---');
      for (const error of result.errors) {
        lines.push(`  [${error.code}] ${error.field ? `${error.field}: ` : ''}${error.message}`);
      }
    }

    if (result.warnings.length > 0) {
      lines.push('--- WARNINGS ---');
      for (const warning of result.warnings) {
        lines.push(`  [${warning.code}] ${warning.field ? `${warning.field}: ` : ''}${warning.message}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Returns a compact one-line validation summary for a template.
   */
  public getValidationSummaryLine(template: CascadeTemplate): string {
    const result = this.validateTemplate(template);
    const score = this.computeTemplateQualityScore(template);
    return `${template.templateId} valid=${String(result.valid)} errors=${result.errors.length} warnings=${result.warnings.length} score=${score.toFixed(3)}`;
  }

  /**
   * Validates multiple templates in batch and returns one result per template.
   * Results are ordered to match the input array order.
   */
  public validateBatch(
    templates: readonly CascadeTemplate[],
  ): readonly CascadeTemplateValidationResult[] {
    return Object.freeze(templates.map((template) => this.validateTemplate(template)));
  }

  /**
   * Returns which templates in a collection have at least one validation error.
   * Used for fast quality triage without building full issue lists.
   */
  public findInvalidTemplates(
    templates: readonly CascadeTemplate[],
  ): readonly CascadeTemplate[] {
    return Object.freeze(
      templates.filter((template) => !this.validateTemplate(template).valid),
    );
  }

  /**
   * Returns whether a given template passes all hard-error validation gates.
   */
  public isTemplateValid(template: CascadeTemplate): boolean {
    return this.validateTemplate(template).valid;
  }

  /**
   * Returns whether a given manifest passes all cross-template validation gates.
   */
  public isManifestValid(manifest: CascadeTemplateManifest): boolean {
    return this.validateManifest(manifest).valid;
  }

  /**
   * Returns the set of supported recovery condition kinds from RECOVERY_CONDITION_KINDS.
   * Useful for authoring tools that need to enumerate valid condition types.
   */
  public getSupportedRecoveryConditionKinds(): typeof RECOVERY_CONDITION_KINDS {
    return RECOVERY_CONDITION_KINDS;
  }

  /**
   * Validates a single recovery condition against all authored constraints.
   * Returns an array of issues (may be empty if the condition is valid).
   *
   * Used by authoring tools that validate conditions before adding them to templates.
   */
  public validateSingleRecoveryCondition(
    condition: RecoveryCondition,
    templateId = 'UNKNOWN',
  ): readonly CascadeTemplateValidationIssue[] {
    const issues: MutableIssue[] = [];
    this.validateRecoveryConditionShape(condition, templateId, issues);
    return Object.freeze(issues.map((issue) => this.freezeIssue(issue)));
  }

  /**
   * Validates only the link set of a template (offsets + effects).
   * Returns issues if any structural invariants are violated.
   */
  public validateLinkSetOnly(
    template: CascadeTemplate,
  ): readonly CascadeTemplateValidationIssue[] {
    const ctx: ValidationContext = {
      templateId: template.templateId ?? 'UNKNOWN',
      template,
      issues: [],
    };
    this.validateLinkSet(ctx);
    return Object.freeze(ctx.issues.map((issue) => this.freezeIssue(issue)));
  }

  /**
   * Returns all recovery condition comparators as a lookup map.
   * Exposes `RECOVERY_CONDITION_COMPARATOR_BY_KIND` for tooling consumers.
   */
  public getRecoveryConditionComparatorMap(): typeof RECOVERY_CONDITION_COMPARATOR_BY_KIND {
    return RECOVERY_CONDITION_COMPARATOR_BY_KIND;
  }

  /**
   * Returns the default field severity override table (`DEFAULT_FIELD_SEVERITY_OVERRIDES`).
   *
   * Consumers can extend or replace this to build their own severity context:
   *
   * ```ts
   * const validator = new CascadeTemplateValidator();
   * const overrides = [
   *   ...validator.getDefaultFieldSeverityOverrides(),
   *   { field: 'dedupeKey', code: 'EMPTY_DEDUPE_KEY', severity: 'WARNING' },
   * ];
   * const relaxed = validator.applyFieldSeverityOverrides(result, overrides);
   * ```
   */
  public getDefaultFieldSeverityOverrides(): readonly FieldSeverityOverride[] {
    return DEFAULT_FIELD_SEVERITY_OVERRIDES;
  }

  /**
   * Re-maps issue severities in an existing validation result using a provided
   * `FieldSeverityOverride[]` table.
   *
   * Does NOT re-run validation — it only adjusts severities of issues already
   * present in `result`.  Returns a new frozen result with the remapped issues.
   *
   * Use cases:
   * - Authoring-mode relaxation: downgrade advisory ERRORs to WARNINGs so
   *   in-progress templates don't hard-block the editor.
   * - Deployment gates: promote specific WARNINGs to ERRORs for production
   *   quality enforcement.
   * - Context-specific rules: allow a subset of templates to skip checks that
   *   don't apply in a particular game mode or run phase.
   *
   * Matching is exact on both `field` and `code`.  Overrides for non-matching
   * issues are silently ignored.
   *
   * @param result  A frozen validation result from `validateTemplate()`.
   * @param overrides  The severity override table to apply.
   * @returns A new frozen `CascadeTemplateValidationResult` with remapped severities.
   */
  public applyFieldSeverityOverrides(
    result: CascadeTemplateValidationResult,
    overrides: readonly FieldSeverityOverride[],
  ): CascadeTemplateValidationResult {
    if (overrides.length === 0) {
      return result;
    }

    // Build (field::code) → severity lookup for O(1) per-issue resolution.
    const overrideMap = new Map<string, CascadeTemplateValidationSeverity>();
    for (const override of overrides) {
      overrideMap.set(`${override.field}::${override.code}`, override.severity);
    }

    const remapped = result.issues.map((issue) => {
      const key = `${issue.field ?? ''}::${issue.code}`;
      const overrideSeverity = overrideMap.get(key);
      if (overrideSeverity === undefined || overrideSeverity === issue.severity) {
        return issue;
      }
      return Object.freeze({
        code: issue.code,
        severity: overrideSeverity,
        message: issue.message,
        templateId: issue.templateId,
        field: issue.field,
        notes: issue.notes,
      });
    });

    const remappedFrozen = Object.freeze(remapped);
    const errors = remappedFrozen.filter((i) => i.severity === 'ERROR');
    const warnings = remappedFrozen.filter((i) => i.severity === 'WARNING');

    return Object.freeze({
      valid: errors.length === 0,
      issues: remappedFrozen,
      errors: Object.freeze(errors),
      warnings: Object.freeze(warnings),
    });
  }

  // ---------------------------------------------------------------------------
  // Field-Level Validators (private)
  // ---------------------------------------------------------------------------

  private validateTemplateId(ctx: ValidationContext): void {
    if (!isCascadeTemplateId(ctx.templateId)) {
      this.addError(ctx, 'UNKNOWN_TEMPLATE_ID', 'templateId', [
        `"${ctx.templateId}" is not in the canonical CASCADE_TEMPLATE_IDS registry.`,
        `Valid IDs include: LIQUIDITY_SPIRAL, CREDIT_FREEZE, INCOME_SHOCK, NETWORK_LOCKDOWN, COMEBACK_SURGE, MOMENTUM_ENGINE.`,
      ]);
    }
  }

  private validateLabel(ctx: ValidationContext): void {
    const label = ctx.template.label;

    if (!label || label.trim().length === 0) {
      this.addError(ctx, 'EMPTY_LABEL', 'label', [
        'Templates must have a non-empty human-readable label.',
      ]);
      return;
    }

    if (label.length > 120) {
      this.addWarning(ctx, 'EMPTY_LABEL', 'label', [
        `Label is ${label.length} characters. Recommend keeping labels under 120 characters for tool compatibility.`,
      ]);
    }
  }

  private validateDedupeKey(ctx: ValidationContext): void {
    const key = ctx.template.dedupeKey;

    if (!key || key.trim().length === 0) {
      this.addError(ctx, 'EMPTY_DEDUPE_KEY', 'dedupeKey', [
        'dedupeKey must be a non-empty string used to deduplicate semantically identical trigger bursts.',
        `Default dedupeKey convention: "<templateId>_<triggerFamily>"`,
      ]);
      return;
    }

    if (/\s/.test(key)) {
      this.addWarning(ctx, 'EMPTY_DEDUPE_KEY', 'dedupeKey', [
        `dedupeKey "${key}" contains whitespace. Keys with spaces may cause matching inconsistencies.`,
        'Recommend using underscores or hyphens instead of spaces.',
      ]);
    }
  }

  private validatePolarity(ctx: ValidationContext): void {
    const { template } = ctx;

    if (template.authoredPolarity !== undefined) {
      const expectedPolarity = template.positive ? 'POSITIVE' : 'NEGATIVE';

      if (template.authoredPolarity !== expectedPolarity) {
        this.addError(ctx, 'POLARITY_MISMATCH', 'authoredPolarity', [
          `authoredPolarity="${template.authoredPolarity}" conflicts with positive=${String(template.positive)}.`,
          `Expected authoredPolarity="${expectedPolarity}" to match the positive flag.`,
        ]);
      }
    }

    if (!isCascadeSeverity(template.severity)) {
      this.addError(ctx, 'UNKNOWN_TEMPLATE_ID', 'severity', [
        `"${template.severity}" is not a recognized CascadeSeverity (LOW, MEDIUM, HIGH, CRITICAL).`,
      ]);
    }
  }

  private validateMaxConcurrent(ctx: ValidationContext): void {
    const { maxConcurrent } = ctx.template;
    const defaultMax = CASCADE_TEMPLATE_DEFAULTS.maxConcurrent;

    if (maxConcurrent <= 0) {
      this.addError(ctx, 'NON_POSITIVE_MAX_CONCURRENT', 'maxConcurrent', [
        `maxConcurrent must be > 0 (received ${maxConcurrent}).`,
        `Default value is ${defaultMax}.`,
      ]);
      return;
    }

    if (maxConcurrent > HARD_LIMITS.MAX_CONCURRENT_UPPER) {
      this.addWarning(ctx, 'NON_POSITIVE_MAX_CONCURRENT', 'maxConcurrent', [
        `maxConcurrent=${maxConcurrent} exceeds the engine guard of ${HARD_LIMITS.MAX_CONCURRENT_UPPER}.`,
        'The engine will silently cap concurrency at its hard limit. Authoring this value explicitly above the cap has no effect.',
      ]);
    }
  }

  private validateMaxTriggersPerRun(ctx: ValidationContext): void {
    const { maxTriggersPerRun } = ctx.template;
    const defaultMax = CASCADE_TEMPLATE_DEFAULTS.maxTriggersPerRun;

    if (maxTriggersPerRun <= 0) {
      this.addError(ctx, 'NON_POSITIVE_MAX_TRIGGERS_PER_RUN', 'maxTriggersPerRun', [
        `maxTriggersPerRun must be > 0 (received ${maxTriggersPerRun}).`,
        `Default value is ${defaultMax}.`,
      ]);
      return;
    }

    if (maxTriggersPerRun > HARD_LIMITS.MAX_TRIGGERS_PER_RUN_UPPER) {
      this.addWarning(ctx, 'NON_POSITIVE_MAX_TRIGGERS_PER_RUN', 'maxTriggersPerRun', [
        `maxTriggersPerRun=${maxTriggersPerRun} exceeds the engine guard of ${HARD_LIMITS.MAX_TRIGGERS_PER_RUN_UPPER}.`,
        'Values above the guard are silently capped. Authoring this explicitly above the cap has no effect.',
      ]);
    }
  }

  private validateLinkSet(ctx: ValidationContext): void {
    const { baseOffsets, effects } = ctx.template;

    if (baseOffsets.length === 0 || effects.length === 0) {
      this.addError(ctx, 'EMPTY_LINK_SET', 'baseOffsets', [
        'A cascade template must have at least one link (one baseOffset + one effect).',
        `baseOffsets.length=${baseOffsets.length}, effects.length=${effects.length}`,
      ]);
      return;
    }

    if (baseOffsets.length !== effects.length) {
      this.addError(ctx, 'OFFSET_EFFECT_LENGTH_MISMATCH', 'baseOffsets', [
        `baseOffsets.length (${baseOffsets.length}) !== effects.length (${effects.length}).`,
        'Every link must have exactly one baseOffset and one corresponding effect.',
      ]);
    }

    if (baseOffsets.length > HARD_LIMITS.MAX_LINKS) {
      this.addWarning(ctx, 'EMPTY_LINK_SET', 'baseOffsets', [
        `Template has ${baseOffsets.length} links, exceeding the recommended maximum of ${HARD_LIMITS.MAX_LINKS}.`,
        'Very long chains may be computationally expensive and may harm UX predictability.',
      ]);
    }

    this.validateOffsets(ctx);
    this.validateEffects(ctx);
  }

  private validateOffsets(ctx: ValidationContext): void {
    const { baseOffsets } = ctx.template;

    for (let i = 0; i < baseOffsets.length; i += 1) {
      const offset = baseOffsets[i];

      if (offset === undefined) {
        continue;
      }

      if (!Number.isFinite(offset)) {
        this.addError(ctx, 'NEGATIVE_OFFSET', `baseOffsets[${i}]`, [
          `baseOffsets[${i}]=${String(offset)} is not finite.`,
          'All offsets must be finite non-negative integers.',
        ]);
        continue;
      }

      if (offset < HARD_LIMITS.MIN_OFFSET) {
        this.addError(ctx, 'NEGATIVE_OFFSET', `baseOffsets[${i}]`, [
          `baseOffsets[${i}]=${offset} is negative. All offsets must be >= ${HARD_LIMITS.MIN_OFFSET}.`,
        ]);
      }

      if (i > 0) {
        const prev = baseOffsets[i - 1];
        if (prev !== undefined && Number.isFinite(prev) && offset < prev) {
          this.addWarning(ctx, 'UNSORTED_OFFSETS', `baseOffsets[${i}]`, [
            `baseOffsets[${i}]=${offset} is less than baseOffsets[${i - 1}]=${prev}.`,
            'Offsets should be non-decreasing for predictable UX. The engine applies monotonic correction.',
          ]);
        }
      }

      if (!Number.isInteger(offset)) {
        this.addWarning(ctx, 'NEGATIVE_OFFSET', `baseOffsets[${i}]`, [
          `baseOffsets[${i}]=${offset} is not an integer. The engine truncates non-integer offsets.`,
        ]);
      }
    }
  }

  private validateEffects(ctx: ValidationContext): void {
    for (let i = 0; i < ctx.template.effects.length; i += 1) {
      const effect = ctx.template.effects[i];
      if (effect !== undefined) {
        this.validateSingleEffect(ctx, effect, i);
      }
    }
  }

  private validateSingleEffect(
    ctx: ValidationContext,
    effect: EffectPayload,
    linkIndex: number,
  ): void {
    let hasAnyContent = false;

    for (const field of EFFECT_NUMERIC_FIELDS) {
      const value = effect[field];

      if (value === undefined || value === null) {
        continue;
      }

      hasAnyContent = true;

      if (!Number.isFinite(value)) {
        this.addError(ctx, 'UNKNOWN', `effects[${linkIndex}].${field}`, [
          `effects[${linkIndex}].${field}=${String(value)} is not finite.`,
          'All numeric effect fields must be finite numbers.',
        ]);
        continue;
      }

      const magnitude = Math.abs(value);
      if (magnitude > HARD_LIMITS.NUMERIC_DELTA_MAGNITUDE_UPPER) {
        this.addWarning(ctx, 'UNKNOWN', `effects[${linkIndex}].${field}`, [
          `effects[${linkIndex}].${field}=${value} has an unusually large magnitude (>${HARD_LIMITS.NUMERIC_DELTA_MAGNITUDE_UPPER}).`,
          'Very large deltas may destabilize game economy or shield models.',
        ]);
      }
    }

    if (effect.cascadeTag !== undefined && effect.cascadeTag !== null) {
      if (typeof effect.cascadeTag === 'string' && effect.cascadeTag.trim().length > 0) {
        hasAnyContent = true;
      } else if (typeof effect.cascadeTag === 'string' && effect.cascadeTag.trim().length === 0) {
        this.addWarning(ctx, 'UNKNOWN', `effects[${linkIndex}].cascadeTag`, [
          `effects[${linkIndex}].cascadeTag is an empty string. Set to null if no tag is needed.`,
        ]);
      }
    }

    if (effect.namedActionId !== undefined && effect.namedActionId !== null) {
      if (typeof effect.namedActionId === 'string' && effect.namedActionId.trim().length > 0) {
        hasAnyContent = true;
      }
    }

    const hasArrayContent =
      (effect.injectCards?.length ?? 0) > 0 ||
      (effect.exhaustCards?.length ?? 0) > 0 ||
      (effect.grantBadges?.length ?? 0) > 0;

    if (hasArrayContent) {
      hasAnyContent = true;
    }

    if (!hasAnyContent) {
      this.addWarning(ctx, 'UNKNOWN', `effects[${linkIndex}]`, [
        `effects[${linkIndex}] has no non-zero fields, no cascadeTag, and no named action.`,
        'A link with no observable effect may be intentional (a timing placeholder), but should be documented.',
      ]);
    }
  }

  private validateRecovery(ctx: ValidationContext): void {
    const { recovery } = ctx.template;

    if (ctx.template.positive && recovery.length > 0) {
      this.addWarning(ctx, 'INVALID_RECOVERY_CONDITION', 'recovery', [
        'Positive cascade templates do not use recovery. The authored conditions will be ignored.',
      ]);
      return;
    }

    for (let i = 0; i < recovery.length; i += 1) {
      const condition = recovery[i];
      if (condition !== undefined) {
        this.validateRecoveryConditionShape(condition, ctx.templateId, ctx.issues, i);
      }
    }
  }

  private validateRecoveryConditionShape(
    condition: RecoveryCondition,
    templateId: string,
    issues: MutableIssue[],
    index?: number,
  ): void {
    const field = index !== undefined ? `recovery[${index}]` : 'recovery';
    const kind = condition.kind as RecoveryConditionKind;

    if (!RECOVERY_CONDITION_KINDS.includes(kind)) {
      issues.push({
        code: 'INVALID_RECOVERY_CONDITION',
        severity: 'ERROR',
        message: `recovery condition kind "${kind}" is not in the canonical RECOVERY_CONDITION_KINDS registry.`,
        templateId,
        field,
        notes: Object.freeze([
          `Valid kinds: ${RECOVERY_CONDITION_KINDS.join(', ')}`,
          `Comparator type for valid kinds: ${Object.values(RECOVERY_CONDITION_COMPARATOR_BY_KIND).join(', ')}`,
        ]) as unknown as string[],
      });
      return;
    }

    const comparator = RECOVERY_CONDITION_COMPARATOR_BY_KIND[kind];

    switch (condition.kind) {
      case 'CARD_TAG_ANY':
      case 'LAST_PLAYED_TAG_ANY': {
        if (!condition.tags || condition.tags.length === 0) {
          issues.push({
            code: 'INVALID_RECOVERY_CONDITION',
            severity: 'ERROR',
            message: `${field}: ${kind} condition must have at least one tag (comparator: ${comparator}).`,
            templateId,
            field,
            notes: Object.freeze([
              'Tags are matched against the authoritative runtime token bag.',
              'Empty tag arrays will always fail and block recovery.',
            ]) as unknown as string[],
          });
        }

        const emptyTags = (condition.tags ?? []).filter((tag) => !tag || tag.trim().length === 0);
        if (emptyTags.length > 0) {
          issues.push({
            code: 'EMPTY_RECOVERY_TAG',
            severity: 'ERROR',
            message: `${field}: ${kind} condition contains ${emptyTags.length} empty tag(s).`,
            templateId,
            field,
            notes: Object.freeze([]) as unknown as string[],
          });
        }
        break;
      }

      case 'CASH_MIN': {
        if (!Number.isFinite(condition.amount) || condition.amount < 0) {
          issues.push({
            code: 'INVALID_RECOVERY_CONDITION',
            severity: 'ERROR',
            message: `${field}: CASH_MIN amount must be a finite non-negative number (received ${condition.amount}).`,
            templateId,
            field,
            notes: Object.freeze([
              `Comparator: ${comparator} — passes when cash >= amount.`,
            ]) as unknown as string[],
          });
        }
        break;
      }

      case 'WEAKEST_SHIELD_RATIO_MIN':
      case 'ALL_SHIELDS_RATIO_MIN': {
        if (
          !Number.isFinite(condition.ratio) ||
          condition.ratio < HARD_LIMITS.RATIO_LOWER ||
          condition.ratio > HARD_LIMITS.RATIO_UPPER
        ) {
          issues.push({
            code: 'INVALID_RECOVERY_CONDITION',
            severity: 'ERROR',
            message: `${field}: ${kind} ratio must be in [${HARD_LIMITS.RATIO_LOWER}, ${HARD_LIMITS.RATIO_UPPER}] (received ${condition.ratio}).`,
            templateId,
            field,
            notes: Object.freeze([
              `Comparator: ${comparator}`,
            ]) as unknown as string[],
          });
        }
        break;
      }

      case 'TRUST_ANY_MIN': {
        if (
          !Number.isFinite(condition.score) ||
          condition.score < HARD_LIMITS.RATIO_LOWER ||
          condition.score > HARD_LIMITS.RATIO_UPPER
        ) {
          issues.push({
            code: 'INVALID_RECOVERY_CONDITION',
            severity: 'ERROR',
            message: `${field}: TRUST_ANY_MIN score must be in [${HARD_LIMITS.RATIO_LOWER}, ${HARD_LIMITS.RATIO_UPPER}] (received ${condition.score}).`,
            templateId,
            field,
            notes: Object.freeze([
              `Comparator: ${comparator} — passes when any trust score >= the authored threshold.`,
            ]) as unknown as string[],
          });
        }
        break;
      }

      case 'HEAT_MAX': {
        if (!Number.isFinite(condition.amount) || condition.amount < 0) {
          issues.push({
            code: 'INVALID_RECOVERY_CONDITION',
            severity: 'ERROR',
            message: `${field}: HEAT_MAX amount must be a finite non-negative number (received ${condition.amount}).`,
            templateId,
            field,
            notes: Object.freeze([
              `Comparator: ${comparator} — passes when haterHeat <= amount.`,
            ]) as unknown as string[],
          });
        }
        break;
      }

      case 'PRESSURE_NOT_ABOVE': {
        if (!condition.tier) {
          issues.push({
            code: 'INVALID_RECOVERY_CONDITION',
            severity: 'ERROR',
            message: `${field}: PRESSURE_NOT_ABOVE requires a valid tier (T0, T1, T2, T3, T4).`,
            templateId,
            field,
            notes: Object.freeze([
              `Comparator: ${comparator} — passes when actual tier rank <= authored tier rank.`,
            ]) as unknown as string[],
          });
        }
        break;
      }

      default: {
        issues.push({
          code: 'INVALID_RECOVERY_CONDITION',
          severity: 'ERROR',
          message: `${field}: unrecognized recovery condition kind.`,
          templateId,
          field,
          notes: Object.freeze([]) as unknown as string[],
        });
      }
    }
  }

  private validateRecoveryTags(ctx: ValidationContext): void {
    const { recoveryTags } = ctx.template;

    if (ctx.template.positive) {
      if (recoveryTags.length > 0) {
        this.addWarning(ctx, 'EMPTY_RECOVERY_TAG', 'recoveryTags', [
          'Positive cascade templates do not use recoveryTags. The authored tags will be ignored by the engine.',
        ]);
      }
      return;
    }

    const seen = new Set<string>();
    for (let i = 0; i < recoveryTags.length; i += 1) {
      const tag = recoveryTags[i];

      if (!tag || tag.trim().length === 0) {
        this.addError(ctx, 'EMPTY_RECOVERY_TAG', `recoveryTags[${i}]`, [
          `recoveryTags[${i}] is empty. Empty strings in the recovery tag array have no effect and should be removed.`,
        ]);
        continue;
      }

      if (seen.has(tag.toLowerCase())) {
        this.addWarning(ctx, 'DUPLICATE_RECOVERY_TAG', `recoveryTags[${i}]`, [
          `recoveryTags contains duplicate tag "${tag}". Duplicates are harmless but increase noise.`,
        ]);
      }

      seen.add(tag.toLowerCase());
    }
  }

  private validateModeOffsetModifier(ctx: ValidationContext): void {
    const { modeOffsetModifier } = ctx.template;

    if (modeOffsetModifier === undefined) {
      return;
    }

    for (const [key, value] of Object.entries(modeOffsetModifier)) {
      const mode = key as ModeCode;

      if (!VALID_MODE_CODES.includes(mode)) {
        this.addError(ctx, 'INVALID_MODE_OFFSET_MODIFIER', `modeOffsetModifier.${key}`, [
          `"${key}" is not a recognized ModeCode. Valid modes: ${VALID_MODE_CODES.join(', ')}.`,
          `Default values from CASCADE_DEFAULT_MODE_OFFSET_MODIFIER: ${JSON.stringify(CASCADE_DEFAULT_MODE_OFFSET_MODIFIER)}`,
        ]);
        continue;
      }

      if (!Number.isFinite(value)) {
        this.addError(ctx, 'INVALID_MODE_OFFSET_MODIFIER', `modeOffsetModifier.${mode}`, [
          `modeOffsetModifier.${mode}=${String(value)} is not finite.`,
        ]);
        continue;
      }

      if (value < HARD_LIMITS.MODE_OFFSET_MODIFIER_LOWER || value > HARD_LIMITS.MODE_OFFSET_MODIFIER_UPPER) {
        this.addWarning(ctx, 'INVALID_MODE_OFFSET_MODIFIER', `modeOffsetModifier.${mode}`, [
          `modeOffsetModifier.${mode}=${value} is outside the recommended range [${HARD_LIMITS.MODE_OFFSET_MODIFIER_LOWER}, ${HARD_LIMITS.MODE_OFFSET_MODIFIER_UPPER}].`,
        ]);
      }
    }
  }

  private validatePressureScalar(ctx: ValidationContext): void {
    const { pressureScalar } = ctx.template;

    if (pressureScalar === undefined) {
      return;
    }

    for (const [key, value] of Object.entries(pressureScalar)) {
      const tier = key as PressureTier;

      if (!VALID_PRESSURE_TIERS.includes(tier)) {
        this.addError(ctx, 'INVALID_PRESSURE_SCALAR', `pressureScalar.${key}`, [
          `"${key}" is not a recognized PressureTier. Valid tiers: ${VALID_PRESSURE_TIERS.join(', ')}.`,
          `Default values from CASCADE_DEFAULT_PRESSURE_SCALAR: ${JSON.stringify(CASCADE_DEFAULT_PRESSURE_SCALAR)}`,
        ]);
        continue;
      }

      if (value === undefined || !Number.isFinite(value)) {
        this.addError(ctx, 'INVALID_PRESSURE_SCALAR', `pressureScalar.${tier}`, [
          `pressureScalar.${tier}=${String(value)} is not finite.`,
        ]);
        continue;
      }

      if (value < HARD_LIMITS.PRESSURE_SCALAR_LOWER || value > HARD_LIMITS.PRESSURE_SCALAR_UPPER) {
        this.addWarning(ctx, 'INVALID_PRESSURE_SCALAR', `pressureScalar.${tier}`, [
          `pressureScalar.${tier}=${value} is outside the recommended range [${HARD_LIMITS.PRESSURE_SCALAR_LOWER}, ${HARD_LIMITS.PRESSURE_SCALAR_UPPER}].`,
          `Default for ${tier}: ${CASCADE_DEFAULT_PRESSURE_SCALAR[tier]}`,
        ]);
      }
    }
  }

  private validatePhaseScalar(ctx: ValidationContext): void {
    const { phaseScalar } = ctx.template;

    if (phaseScalar === undefined) {
      return;
    }

    for (const [key, value] of Object.entries(phaseScalar)) {
      const phase = key as CascadeSupportedPhase;

      if (!VALID_PHASE_CODES.includes(phase)) {
        this.addError(ctx, 'INVALID_PHASE_SCALAR', `phaseScalar.${key}`, [
          `"${key}" is not a recognized CascadeSupportedPhase. Valid phases: ${VALID_PHASE_CODES.join(', ')}.`,
          `Default values from CASCADE_DEFAULT_PHASE_SCALAR: ${JSON.stringify(CASCADE_DEFAULT_PHASE_SCALAR)}`,
        ]);
        continue;
      }

      if (value === undefined || !Number.isFinite(value)) {
        this.addError(ctx, 'INVALID_PHASE_SCALAR', `phaseScalar.${phase}`, [
          `phaseScalar.${phase}=${String(value)} is not finite.`,
        ]);
        continue;
      }

      if (value < HARD_LIMITS.PHASE_SCALAR_LOWER || value > HARD_LIMITS.PHASE_SCALAR_UPPER) {
        this.addWarning(ctx, 'INVALID_PHASE_SCALAR', `phaseScalar.${phase}`, [
          `phaseScalar.${phase}=${value} is outside recommended range [${HARD_LIMITS.PHASE_SCALAR_LOWER}, ${HARD_LIMITS.PHASE_SCALAR_UPPER}].`,
          `Default for ${phase}: ${CASCADE_DEFAULT_PHASE_SCALAR[phase]}`,
        ]);
      }
    }
  }

  private validateCombinedScalarRange(ctx: ValidationContext): void {
    const { minCombinedScalar, maxCombinedScalar } = ctx.template;

    if (minCombinedScalar !== undefined) {
      if (!Number.isFinite(minCombinedScalar) || minCombinedScalar < HARD_LIMITS.COMBINED_SCALAR_MIN_LOWER) {
        this.addError(ctx, 'INVALID_COMBINED_SCALAR_RANGE', 'minCombinedScalar', [
          `minCombinedScalar=${minCombinedScalar} must be >= ${HARD_LIMITS.COMBINED_SCALAR_MIN_LOWER}.`,
        ]);
      }
    }

    if (maxCombinedScalar !== undefined) {
      if (!Number.isFinite(maxCombinedScalar) || maxCombinedScalar > HARD_LIMITS.COMBINED_SCALAR_MAX_UPPER) {
        this.addError(ctx, 'INVALID_COMBINED_SCALAR_RANGE', 'maxCombinedScalar', [
          `maxCombinedScalar=${maxCombinedScalar} must be <= ${HARD_LIMITS.COMBINED_SCALAR_MAX_UPPER}.`,
        ]);
      }
    }

    if (
      minCombinedScalar !== undefined &&
      maxCombinedScalar !== undefined &&
      Number.isFinite(minCombinedScalar) &&
      Number.isFinite(maxCombinedScalar) &&
      minCombinedScalar >= maxCombinedScalar
    ) {
      this.addError(ctx, 'INVALID_COMBINED_SCALAR_RANGE', 'minCombinedScalar', [
        `minCombinedScalar (${minCombinedScalar}) must be < maxCombinedScalar (${maxCombinedScalar}).`,
      ]);
    }
  }

  private validateMinTickSpacing(ctx: ValidationContext): void {
    const { minTickSpacing } = ctx.template;

    if (minTickSpacing === undefined) {
      return;
    }

    if (!Number.isFinite(minTickSpacing) || minTickSpacing < HARD_LIMITS.MIN_TICK_SPACING_LOWER) {
      this.addError(ctx, 'INVALID_MIN_TICK_SPACING', 'minTickSpacing', [
        `minTickSpacing=${minTickSpacing} must be a finite number >= ${HARD_LIMITS.MIN_TICK_SPACING_LOWER}.`,
      ]);
      return;
    }

    if (minTickSpacing > HARD_LIMITS.MIN_TICK_SPACING_UPPER) {
      this.addWarning(ctx, 'INVALID_MIN_TICK_SPACING', 'minTickSpacing', [
        `minTickSpacing=${minTickSpacing} exceeds the recommended maximum of ${HARD_LIMITS.MIN_TICK_SPACING_UPPER}.`,
        'Very large spacing values may effectively prevent template reactivation.',
      ]);
    }

    if (!Number.isInteger(minTickSpacing)) {
      this.addWarning(ctx, 'INVALID_MIN_TICK_SPACING', 'minTickSpacing', [
        `minTickSpacing=${minTickSpacing} is not an integer. The engine uses integer tick counts.`,
      ]);
    }
  }

  // ---------------------------------------------------------------------------
  // Manifest-Level Validators (private)
  // ---------------------------------------------------------------------------

  private validateManifestDuplicateId(
    ctx: ManifestValidationContext,
    templateId: string,
  ): void {
    if (ctx.seenIds.has(templateId)) {
      ctx.issues.push({
        code: 'DUPLICATE_TEMPLATE_ID',
        severity: 'ERROR',
        message: `Duplicate template ID "${templateId}" found in manifest.`,
        templateId,
        field: 'templateId',
        notes: ['Each template must have a unique templateId within the manifest.'],
      });
    }

    ctx.seenIds.add(templateId);
  }

  private validateManifestExclusivityGroups(ctx: ManifestValidationContext): void {
    const groupMembers = new Map<string, string[]>();

    for (const template of Object.values(ctx.manifest) as CascadeTemplate[]) {
      const group = template.exclusivityGroup;
      if (group === undefined || group === null) {
        continue;
      }

      if (!groupMembers.has(group)) {
        groupMembers.set(group, []);
      }
      groupMembers.get(group)!.push(template.templateId);
    }

    for (const [group, members] of groupMembers) {
      if (members.length < 2) {
        ctx.issues.push({
          code: 'EXCLUSIVITY_GROUP_EMPTY',
          severity: 'WARNING',
          message: `exclusivityGroup "${group}" has only one member (${members[0] ?? 'unknown'}).`,
          templateId: members[0] ?? 'UNKNOWN',
          field: 'exclusivityGroup',
          notes: ['Exclusivity groups with a single member have no effect.'],
        });
      }
    }
  }

  private validateManifestCoverage(ctx: ManifestValidationContext): void {
    const ids = new Set(Object.keys(ctx.manifest));

    // ─── Unknown template ID check ────────────────────────────────────────────
    // Every ID in the manifest must be a recognized cascade template ID.
    // Foreign IDs cannot be validated by the engine and will cause routing errors
    // at chain creation time — catching them here surfaces the problem early.
    for (const id of ids) {
      if (!isCascadeTemplateId(id)) {
        ctx.issues.push({
          code: 'UNKNOWN_TEMPLATE_ID',
          severity: 'ERROR',
          message: `Manifest contains unrecognized template ID "${id}".`,
          templateId: id,
          field: 'templateId',
          notes: ['All manifest entries must use IDs from the canonical CASCADE_TEMPLATE_IDS vocabulary.'],
        });
      }
    }

    // ─── Polarity coverage check ──────────────────────────────────────────────
    // A well-formed manifest should have at least one positive (opportunity) and
    // at least one negative (threat) template.  Imbalanced manifests produce
    // one-sided player experiences — all punishment or all reward with no contrast.
    const templates = Object.values(ctx.manifest) as CascadeTemplate[];
    const hasPositive = templates.some((t) => t.positive);
    const hasNegative = templates.some((t) => !t.positive);

    if (templates.length > 0 && !hasPositive) {
      ctx.issues.push({
        code: 'UNKNOWN',
        severity: 'WARNING',
        message: 'Manifest contains no positive (opportunity) cascade templates.',
        templateId: 'MANIFEST',
        field: null,
        notes: [
          'A manifest with only negative templates cannot generate positive cascade chains.',
          'Consider adding COMEBACK_SURGE or MOMENTUM_ENGINE templates.',
        ],
      });
    }

    if (templates.length > 0 && !hasNegative) {
      ctx.issues.push({
        code: 'UNKNOWN',
        severity: 'WARNING',
        message: 'Manifest contains no negative (threat) cascade templates.',
        templateId: 'MANIFEST',
        field: null,
        notes: [
          'A manifest with only positive templates cannot model economic threat cascades.',
          'Consider adding LIQUIDITY_SPIRAL, CREDIT_FREEZE, INCOME_SHOCK, or NETWORK_LOCKDOWN.',
        ],
      });
    }

    // ─── Issue code meta-validation (CASCADE_TEMPLATE_VALIDATION_ISSUE_CODES) ─
    // Confirm all issues accumulated so far use codes from the canonical vocabulary.
    // Guards against validator version drift where a new issue code is emitted
    // before it is registered in the types module, which would break consumer
    // code that enumerates known codes via listSupportedIssueCodes().
    const knownCodes = new Set<string>(CASCADE_TEMPLATE_VALIDATION_ISSUE_CODES);
    const snapshotLen = ctx.issues.length;
    for (let i = 0; i < snapshotLen; i += 1) {
      const issue = ctx.issues[i]!;
      if (!knownCodes.has(issue.code as string)) {
        ctx.issues.push({
          code: 'UNKNOWN',
          severity: 'WARNING',
          message: `Manifest validation produced issue with unregistered code '${issue.code}' on template '${issue.templateId as string}'.`,
          templateId: issue.templateId as string,
          field: issue.field,
          notes: [
            'Unregistered codes typically indicate a validator–types version mismatch.',
            `Registered codes: ${CASCADE_TEMPLATE_VALIDATION_ISSUE_CODES.join(', ')}`,
          ],
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Summary Builders (private)
  // ---------------------------------------------------------------------------

  private buildManifestSummary(
    manifest: CascadeTemplateManifest,
  ): CascadeTemplateManifestSummary {
    const templates = Object.values(manifest) as CascadeTemplate[];
    const positiveCount = templates.filter((t) => t.positive).length;
    const negativeCount = templates.length - positiveCount;

    const severityCounts: Record<CascadeSeverity, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    };

    for (const template of templates) {
      if (isCascadeSeverity(template.severity)) {
        severityCounts[template.severity] += 1;
      }
    }

    return Object.freeze({
      totalTemplates: templates.length,
      positiveTemplates: positiveCount,
      negativeTemplates: negativeCount,
      severityCounts: Object.freeze(severityCounts),
      templateIds: Object.freeze(Object.keys(manifest) as CascadeTemplateId[]),
    });
  }

  // ---------------------------------------------------------------------------
  // Issue Constructors (private)
  // ---------------------------------------------------------------------------

  private addError(
    ctx: ValidationContext,
    code: CascadeTemplateValidationIssueCode,
    field: string,
    notes: readonly string[],
  ): void {
    ctx.issues.push({
      code,
      severity: 'ERROR',
      message: this.buildMessage(code, field, 'error'),
      templateId: ctx.templateId,
      field,
      notes: [...notes, ...EMPTY_TEMPLATE_NOTES],
    });
  }

  private addWarning(
    ctx: ValidationContext,
    code: CascadeTemplateValidationIssueCode,
    field: string,
    notes: readonly string[],
  ): void {
    ctx.issues.push({
      code,
      severity: 'WARNING',
      message: this.buildMessage(code, field, 'warning'),
      templateId: ctx.templateId,
      field,
      notes: [...notes, ...EMPTY_TEMPLATE_NOTES],
    });
  }

  private buildMessage(
    code: CascadeTemplateValidationIssueCode,
    field: string,
    severity: 'error' | 'warning',
  ): string {
    return `[${severity.toUpperCase()}] ${code} on field "${field}"`;
  }

  private freezeIssue(issue: MutableIssue): CascadeTemplateValidationIssue {
    return Object.freeze({
      code: issue.code,
      severity: issue.severity,
      message: issue.message,
      templateId: issue.templateId,
      field: issue.field,
      notes: Object.freeze(issue.notes),
    });
  }
}

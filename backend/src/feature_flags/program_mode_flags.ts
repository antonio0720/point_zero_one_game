/**
 * Feature flags for institution program overlays.
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/remote_config/program_mode_flags.ts
 *
 * Purpose:
 * - defines the authoritative registry of institution-safe overlay flags
 * - provides deterministic safe fallbacks when remote config is unavailable
 * - enforces "no competitive advantage" guardrails for institution overlays
 * - keeps flag resolution dependency-light and repo-aligned
 *
 * Design alignment:
 * - Point Zero One uses mode-aware overlays that mutate runtime behavior per mode
 * - safe deploy / remote-config controls require explicit fallback behavior
 * - institutional layers must not corrupt verified ladders or win probability
 */

export type ProgramModeCode = 'solo' | 'pvp' | 'coop' | 'ghost';

export type InstitutionProgramType =
  | 'school'
  | 'employer'
  | 'church'
  | 'community'
  | 'facilitator'
  | 'internal';

export type ProgramFlagCategory =
  | 'ui_overlay'
  | 'curriculum'
  | 'facilitation'
  | 'telemetry'
  | 'proof'
  | 'moderation'
  | 'analytics'
  | 'safety'
  | 'compliance';

export type ProgramFlagExposure =
  | 'all'
  | 'institution_only'
  | 'staff_only'
  | 'facilitator_only';

export type CompetitiveImpact = 'none' | 'cosmetic_only' | 'restricted';

export type ProgramModeFlagId =
  | 'PROGRAM_OVERLAY_INSTITUTION_BRANDING'
  | 'PROGRAM_OVERLAY_FACILITATOR_PANEL'
  | 'PROGRAM_OVERLAY_CURRICULUM_GUIDANCE'
  | 'PROGRAM_OVERLAY_REFLECTION_PROMPTS'
  | 'PROGRAM_OVERLAY_SESSION_SUMMARY_EXPORT'
  | 'PROGRAM_OVERLAY_PRIVATE_LEADERBOARD'
  | 'PROGRAM_OVERLAY_PROOF_CARD_SUPPRESSION'
  | 'PROGRAM_OVERLAY_PROOF_CARD_WATERMARK'
  | 'PROGRAM_OVERLAY_VERIFIED_RUN_EXPLORER_LINK'
  | 'PROGRAM_OVERLAY_HOST_CONTROLS'
  | 'PROGRAM_OVERLAY_TEAM_SAFETY_RAILS'
  | 'PROGRAM_OVERLAY_ANONYMIZED_ANALYTICS'
  | 'PROGRAM_OVERLAY_COMPLIANCE_COPY'
  | 'PROGRAM_OVERLAY_MODERATION_QUEUE'
  | 'PROGRAM_OVERLAY_EPISODE_PINNING';

export interface ProgramModeFlag {
  /**
   * Stable identifier used by remote config and local fallback resolution.
   */
  id: ProgramModeFlagId;

  /**
   * Human-readable label for dashboards, internal admin tools, and docs.
   */
  name: string;

  /**
   * Operational description of what the flag does.
   */
  description?: string;

  /**
   * Safe local default when remote config is missing, stale, invalid, or withheld.
   */
  defaultValue: boolean;

  /**
   * What class of overlay this belongs to.
   */
  category: ProgramFlagCategory;

  /**
   * Which game modes may legally use this overlay.
   */
  allowedModes: readonly ProgramModeCode[];

  /**
   * Which institution lanes may legally use this overlay.
   */
  allowedPrograms: readonly InstitutionProgramType[];

  /**
   * Who may see or operate the overlay.
   */
  exposure: ProgramFlagExposure;

  /**
   * Institution overlays must never alter win probability for verified/competitive surfaces.
   */
  competitiveImpact: CompetitiveImpact;

  /**
   * Whether the overlay is allowed to appear on verified-ladder eligible runs.
   * If false, callers should suppress it automatically in those contexts.
   */
  allowedOnVerifiedRuns: boolean;

  /**
   * Whether the overlay is safe to use during quarantine/pending proof states.
   */
  allowedDuringQuarantine: boolean;

  /**
   * Owner or operating surface for internal governance.
   */
  owner: string;

  /**
   * Optional tags for grouping, admin filtering, or dashboards.
   */
  tags?: readonly string[];
}

export type ProgramModeFlagRegistry = Record<ProgramModeFlagId, ProgramModeFlag>;
export type ProgramModeFlagOverrideMap = Partial<Record<ProgramModeFlagId, boolean>>;

export interface ProgramOverlayResolutionContext {
  mode: ProgramModeCode;
  programType: InstitutionProgramType;
  isVerifiedRun?: boolean;
  isQuarantinedRun?: boolean;
  isStaffUser?: boolean;
  isFacilitatorUser?: boolean;
}

export interface ResolvedProgramModeFlag {
  flag: ProgramModeFlag;
  value: boolean;
  source: 'fallback' | 'override' | 'guardrail_forced_off';
  reason?: string;
}

export interface ProgramOverlayResolutionResult {
  context: Required<
    Pick<
      ProgramOverlayResolutionContext,
      'mode' | 'programType' | 'isVerifiedRun' | 'isQuarantinedRun' | 'isStaffUser' | 'isFacilitatorUser'
    >
  >;
  flags: Record<ProgramModeFlagId, ResolvedProgramModeFlag>;
}

const ALL_MODES: readonly ProgramModeCode[] = ['solo', 'pvp', 'coop', 'ghost'] as const;
const ALL_INSTITUTION_PROGRAMS: readonly InstitutionProgramType[] = [
  'school',
  'employer',
  'church',
  'community',
  'facilitator',
  'internal',
] as const;

function createFlag(flag: ProgramModeFlag): ProgramModeFlag {
  return Object.freeze({
    ...flag,
    allowedModes: Object.freeze([...flag.allowedModes]),
    allowedPrograms: Object.freeze([...flag.allowedPrograms]),
    tags: Object.freeze([...(flag.tags ?? [])]),
  });
}

/**
 * Safe fallback values for institution program mode flags.
 *
 * Doctrine:
 * - default ON only for overlays that are informational, cosmetic, or trust-building
 * - default OFF for overlays that expose extra control surfaces, exports, or organization-only tooling
 * - institution overlays never alter core outcome resolution or competitive fairness
 */
export const SAFE_FALLBACK_VALUES: ProgramModeFlagRegistry = Object.freeze({
  PROGRAM_OVERLAY_INSTITUTION_BRANDING: createFlag({
    id: 'PROGRAM_OVERLAY_INSTITUTION_BRANDING',
    name: 'Institution Branding Overlay',
    description:
      'Shows institution-safe brand framing, sponsor header copy, and neutral contextual chrome without altering gameplay outcomes.',
    defaultValue: true,
    category: 'ui_overlay',
    allowedModes: ALL_MODES,
    allowedPrograms: ALL_INSTITUTION_PROGRAMS,
    exposure: 'institution_only',
    competitiveImpact: 'none',
    allowedOnVerifiedRuns: true,
    allowedDuringQuarantine: true,
    owner: 'growth-platform',
    tags: ['branding', 'ui', 'institution'],
  }),

  PROGRAM_OVERLAY_FACILITATOR_PANEL: createFlag({
    id: 'PROGRAM_OVERLAY_FACILITATOR_PANEL',
    name: 'Facilitator Panel',
    description:
      'Enables facilitator-only controls for guided sessions, debrief pacing, and live observation surfaces.',
    defaultValue: false,
    category: 'facilitation',
    allowedModes: ['solo', 'coop', 'ghost'],
    allowedPrograms: ['school', 'employer', 'church', 'community', 'facilitator', 'internal'],
    exposure: 'facilitator_only',
    competitiveImpact: 'restricted',
    allowedOnVerifiedRuns: false,
    allowedDuringQuarantine: true,
    owner: 'program-ops',
    tags: ['facilitator', 'guided-session', 'controls'],
  }),

  PROGRAM_OVERLAY_CURRICULUM_GUIDANCE: createFlag({
    id: 'PROGRAM_OVERLAY_CURRICULUM_GUIDANCE',
    name: 'Curriculum Guidance Overlay',
    description:
      'Shows curriculum framing, lesson anchors, and reflection scaffolding around gameplay moments.',
    defaultValue: true,
    category: 'curriculum',
    allowedModes: ['solo', 'coop', 'ghost'],
    allowedPrograms: ['school', 'employer', 'church', 'community', 'facilitator', 'internal'],
    exposure: 'institution_only',
    competitiveImpact: 'none',
    allowedOnVerifiedRuns: true,
    allowedDuringQuarantine: true,
    owner: 'curriculum-platform',
    tags: ['curriculum', 'education', 'overlay'],
  }),

  PROGRAM_OVERLAY_REFLECTION_PROMPTS: createFlag({
    id: 'PROGRAM_OVERLAY_REFLECTION_PROMPTS',
    name: 'Reflection Prompts',
    description:
      'Shows post-run reflection prompts and guided debrief questions for program sessions.',
    defaultValue: true,
    category: 'curriculum',
    allowedModes: ['solo', 'coop', 'ghost'],
    allowedPrograms: ['school', 'employer', 'church', 'community', 'facilitator'],
    exposure: 'institution_only',
    competitiveImpact: 'none',
    allowedOnVerifiedRuns: true,
    allowedDuringQuarantine: true,
    owner: 'curriculum-platform',
    tags: ['reflection', 'debrief', 'post-run'],
  }),

  PROGRAM_OVERLAY_SESSION_SUMMARY_EXPORT: createFlag({
    id: 'PROGRAM_OVERLAY_SESSION_SUMMARY_EXPORT',
    name: 'Session Summary Export',
    description:
      'Allows program-safe export of session summaries, facilitator notes, and anonymized rollups.',
    defaultValue: false,
    category: 'analytics',
    allowedModes: ['solo', 'coop', 'ghost'],
    allowedPrograms: ['school', 'employer', 'church', 'community', 'facilitator', 'internal'],
    exposure: 'facilitator_only',
    competitiveImpact: 'restricted',
    allowedOnVerifiedRuns: false,
    allowedDuringQuarantine: false,
    owner: 'program-ops',
    tags: ['export', 'session', 'reporting'],
  }),

  PROGRAM_OVERLAY_PRIVATE_LEADERBOARD: createFlag({
    id: 'PROGRAM_OVERLAY_PRIVATE_LEADERBOARD',
    name: 'Private Program Leaderboard',
    description:
      'Enables organization-scoped leaderboard views that are private to the program cohort.',
    defaultValue: false,
    category: 'proof',
    allowedModes: ['solo', 'pvp', 'coop', 'ghost'],
    allowedPrograms: ['school', 'employer', 'church', 'community', 'internal'],
    exposure: 'institution_only',
    competitiveImpact: 'cosmetic_only',
    allowedOnVerifiedRuns: true,
    allowedDuringQuarantine: false,
    owner: 'trust-platform',
    tags: ['leaderboard', 'cohort', 'private'],
  }),

  PROGRAM_OVERLAY_PROOF_CARD_SUPPRESSION: createFlag({
    id: 'PROGRAM_OVERLAY_PROOF_CARD_SUPPRESSION',
    name: 'Proof Card Suppression',
    description:
      'Suppresses proof-card sharing in institution contexts where policy requires lower public exposure.',
    defaultValue: false,
    category: 'proof',
    allowedModes: ALL_MODES,
    allowedPrograms: ['school', 'employer', 'church', 'community', 'internal'],
    exposure: 'institution_only',
    competitiveImpact: 'none',
    allowedOnVerifiedRuns: true,
    allowedDuringQuarantine: true,
    owner: 'trust-platform',
    tags: ['proof', 'privacy', 'sharing'],
  }),

  PROGRAM_OVERLAY_PROOF_CARD_WATERMARK: createFlag({
    id: 'PROGRAM_OVERLAY_PROOF_CARD_WATERMARK',
    name: 'Program Proof Card Watermark',
    description:
      'Adds organization-safe watermarking to proof-card exports without altering verification state.',
    defaultValue: true,
    category: 'proof',
    allowedModes: ALL_MODES,
    allowedPrograms: ['school', 'employer', 'church', 'community', 'internal'],
    exposure: 'institution_only',
    competitiveImpact: 'none',
    allowedOnVerifiedRuns: true,
    allowedDuringQuarantine: true,
    owner: 'trust-platform',
    tags: ['proof', 'watermark', 'branding'],
  }),

  PROGRAM_OVERLAY_VERIFIED_RUN_EXPLORER_LINK: createFlag({
    id: 'PROGRAM_OVERLAY_VERIFIED_RUN_EXPLORER_LINK',
    name: 'Verified Run Explorer Link',
    description:
      'Shows institution-safe links to the verified run explorer or proof detail surface when available.',
    defaultValue: true,
    category: 'proof',
    allowedModes: ALL_MODES,
    allowedPrograms: ALL_INSTITUTION_PROGRAMS,
    exposure: 'institution_only',
    competitiveImpact: 'none',
    allowedOnVerifiedRuns: true,
    allowedDuringQuarantine: true,
    owner: 'trust-platform',
    tags: ['proof', 'run-explorer', 'verification'],
  }),

  PROGRAM_OVERLAY_HOST_CONTROLS: createFlag({
    id: 'PROGRAM_OVERLAY_HOST_CONTROLS',
    name: 'Host Controls',
    description:
      'Enables host-only controls for private room moderation, pacing, and session administration.',
    defaultValue: false,
    category: 'moderation',
    allowedModes: ['coop', 'pvp'],
    allowedPrograms: ['school', 'employer', 'church', 'community', 'facilitator', 'internal'],
    exposure: 'facilitator_only',
    competitiveImpact: 'restricted',
    allowedOnVerifiedRuns: false,
    allowedDuringQuarantine: true,
    owner: 'social-platform',
    tags: ['host', 'controls', 'room-admin'],
  }),

  PROGRAM_OVERLAY_TEAM_SAFETY_RAILS: createFlag({
    id: 'PROGRAM_OVERLAY_TEAM_SAFETY_RAILS',
    name: 'Team Safety Rails',
    description:
      'Applies institution-safe copy, guardrails, and session framing for co-op or team scenarios.',
    defaultValue: true,
    category: 'safety',
    allowedModes: ['coop'],
    allowedPrograms: ['school', 'employer', 'church', 'community', 'facilitator', 'internal'],
    exposure: 'institution_only',
    competitiveImpact: 'none',
    allowedOnVerifiedRuns: true,
    allowedDuringQuarantine: true,
    owner: 'trust-safety',
    tags: ['team', 'safety', 'coop'],
  }),

  PROGRAM_OVERLAY_ANONYMIZED_ANALYTICS: createFlag({
    id: 'PROGRAM_OVERLAY_ANONYMIZED_ANALYTICS',
    name: 'Anonymized Program Analytics',
    description:
      'Enables anonymized cohort-level analytics for institutional dashboards and outcome review.',
    defaultValue: false,
    category: 'analytics',
    allowedModes: ALL_MODES,
    allowedPrograms: ['school', 'employer', 'church', 'community', 'internal'],
    exposure: 'staff_only',
    competitiveImpact: 'none',
    allowedOnVerifiedRuns: true,
    allowedDuringQuarantine: true,
    owner: 'data-platform',
    tags: ['analytics', 'anonymized', 'dashboard'],
  }),

  PROGRAM_OVERLAY_COMPLIANCE_COPY: createFlag({
    id: 'PROGRAM_OVERLAY_COMPLIANCE_COPY',
    name: 'Compliance Copy Overlay',
    description:
      'Shows compliance-safe institutional wording, disclosures, and neutral educational framing.',
    defaultValue: true,
    category: 'compliance',
    allowedModes: ALL_MODES,
    allowedPrograms: ALL_INSTITUTION_PROGRAMS,
    exposure: 'institution_only',
    competitiveImpact: 'none',
    allowedOnVerifiedRuns: true,
    allowedDuringQuarantine: true,
    owner: 'compliance-ops',
    tags: ['copy', 'disclosures', 'institution'],
  }),

  PROGRAM_OVERLAY_MODERATION_QUEUE: createFlag({
    id: 'PROGRAM_OVERLAY_MODERATION_QUEUE',
    name: 'Moderation Queue',
    description:
      'Enables moderation and review surfaces for institution-owned rooms, cohorts, or submitted content.',
    defaultValue: false,
    category: 'moderation',
    allowedModes: ALL_MODES,
    allowedPrograms: ['school', 'employer', 'church', 'community', 'facilitator', 'internal'],
    exposure: 'staff_only',
    competitiveImpact: 'none',
    allowedOnVerifiedRuns: true,
    allowedDuringQuarantine: true,
    owner: 'trust-safety',
    tags: ['moderation', 'review', 'ops'],
  }),

  PROGRAM_OVERLAY_EPISODE_PINNING: createFlag({
    id: 'PROGRAM_OVERLAY_EPISODE_PINNING',
    name: 'Episode / Ruleset Pinning',
    description:
      'Pins approved episode, content, and ruleset versions for institution cohorts to preserve comparability.',
    defaultValue: true,
    category: 'safety',
    allowedModes: ALL_MODES,
    allowedPrograms: ALL_INSTITUTION_PROGRAMS,
    exposure: 'institution_only',
    competitiveImpact: 'none',
    allowedOnVerifiedRuns: true,
    allowedDuringQuarantine: true,
    owner: 'content-ops',
    tags: ['pinning', 'comparability', 'content-version'],
  }),
});

export const PROGRAM_MODE_FLAG_IDS = Object.freeze(
  Object.keys(SAFE_FALLBACK_VALUES) as ProgramModeFlagId[],
);

export function getProgramModeFlag(
  flagId: ProgramModeFlagId,
): ProgramModeFlag {
  return SAFE_FALLBACK_VALUES[flagId];
}

export function listProgramModeFlags(): ProgramModeFlag[] {
  return PROGRAM_MODE_FLAG_IDS.map((flagId) => SAFE_FALLBACK_VALUES[flagId]);
}

export function isProgramModeFlagId(value: string): value is ProgramModeFlagId {
  return Object.prototype.hasOwnProperty.call(SAFE_FALLBACK_VALUES, value);
}

export function sanitizeProgramModeFlagOverrides(
  overrides: Record<string, unknown> | null | undefined,
): ProgramModeFlagOverrideMap {
  const sanitized: ProgramModeFlagOverrideMap = {};

  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
    return sanitized;
  }

  for (const [rawKey, rawValue] of Object.entries(overrides)) {
    if (!isProgramModeFlagId(rawKey)) {
      continue;
    }

    if (typeof rawValue !== 'boolean') {
      continue;
    }

    sanitized[rawKey] = rawValue;
  }

  return sanitized;
}

export function isFlagAllowedForContext(
  flag: ProgramModeFlag,
  context: Required<
    Pick<
      ProgramOverlayResolutionContext,
      'mode' | 'programType' | 'isVerifiedRun' | 'isQuarantinedRun' | 'isStaffUser' | 'isFacilitatorUser'
    >
  >,
): { allowed: boolean; reason?: string } {
  if (!flag.allowedModes.includes(context.mode)) {
    return { allowed: false, reason: `mode_not_allowed:${context.mode}` };
  }

  if (!flag.allowedPrograms.includes(context.programType)) {
    return {
      allowed: false,
      reason: `program_not_allowed:${context.programType}`,
    };
  }

  if (context.isVerifiedRun && !flag.allowedOnVerifiedRuns) {
    return { allowed: false, reason: 'blocked_on_verified_run' };
  }

  if (context.isQuarantinedRun && !flag.allowedDuringQuarantine) {
    return { allowed: false, reason: 'blocked_during_quarantine' };
  }

  if (flag.exposure === 'staff_only' && !context.isStaffUser) {
    return { allowed: false, reason: 'staff_only' };
  }

  if (flag.exposure === 'facilitator_only' && !context.isFacilitatorUser && !context.isStaffUser) {
    return { allowed: false, reason: 'facilitator_only' };
  }

  return { allowed: true };
}

export function resolveProgramModeFlag(
  flagId: ProgramModeFlagId,
  context: ProgramOverlayResolutionContext,
  overrides?: ProgramModeFlagOverrideMap,
): ResolvedProgramModeFlag {
  const normalizedContext: Required<
    Pick<
      ProgramOverlayResolutionContext,
      'mode' | 'programType' | 'isVerifiedRun' | 'isQuarantinedRun' | 'isStaffUser' | 'isFacilitatorUser'
    >
  > = {
    mode: context.mode,
    programType: context.programType,
    isVerifiedRun: Boolean(context.isVerifiedRun),
    isQuarantinedRun: Boolean(context.isQuarantinedRun),
    isStaffUser: Boolean(context.isStaffUser),
    isFacilitatorUser: Boolean(context.isFacilitatorUser),
  };

  const flag = getProgramModeFlag(flagId);
  const eligibility = isFlagAllowedForContext(flag, normalizedContext);

  if (!eligibility.allowed) {
    return {
      flag,
      value: false,
      source: 'guardrail_forced_off',
      reason: eligibility.reason,
    };
  }

  const overrideValue = overrides?.[flagId];
  if (typeof overrideValue === 'boolean') {
    return {
      flag,
      value: overrideValue,
      source: 'override',
    };
  }

  return {
    flag,
    value: flag.defaultValue,
    source: 'fallback',
  };
}

export function resolveProgramOverlayFlags(
  context: ProgramOverlayResolutionContext,
  rawOverrides?: Record<string, unknown> | null,
): ProgramOverlayResolutionResult {
  const normalizedContext: Required<
    Pick<
      ProgramOverlayResolutionContext,
      'mode' | 'programType' | 'isVerifiedRun' | 'isQuarantinedRun' | 'isStaffUser' | 'isFacilitatorUser'
    >
  > = {
    mode: context.mode,
    programType: context.programType,
    isVerifiedRun: Boolean(context.isVerifiedRun),
    isQuarantinedRun: Boolean(context.isQuarantinedRun),
    isStaffUser: Boolean(context.isStaffUser),
    isFacilitatorUser: Boolean(context.isFacilitatorUser),
  };

  const overrides = sanitizeProgramModeFlagOverrides(rawOverrides);
  const flags = {} as Record<ProgramModeFlagId, ResolvedProgramModeFlag>;

  for (const flagId of PROGRAM_MODE_FLAG_IDS) {
    flags[flagId] = resolveProgramModeFlag(flagId, normalizedContext, overrides);
  }

  return {
    context: normalizedContext,
    flags,
  };
}

export function isProgramOverlayEnabled(
  flagId: ProgramModeFlagId,
  context: ProgramOverlayResolutionContext,
  rawOverrides?: Record<string, unknown> | null,
): boolean {
  return resolveProgramModeFlag(
    flagId,
    context,
    sanitizeProgramModeFlagOverrides(rawOverrides),
  ).value;
}

export function getEnabledProgramOverlayIds(
  context: ProgramOverlayResolutionContext,
  rawOverrides?: Record<string, unknown> | null,
): ProgramModeFlagId[] {
  const resolution = resolveProgramOverlayFlags(context, rawOverrides);

  return PROGRAM_MODE_FLAG_IDS.filter((flagId) => resolution.flags[flagId].value);
}

export function assertInstitutionOverlaySafety(flag: ProgramModeFlag): void {
  if (
    flag.competitiveImpact !== 'none' &&
    flag.allowedOnVerifiedRuns
  ) {
    throw new Error(
      `Institution overlay ${flag.id} cannot be both competitive-impacting and verified-run eligible`,
    );
  }
}

export function validateProgramModeFlagRegistry(
  registry: ProgramModeFlagRegistry = SAFE_FALLBACK_VALUES,
): void {
  for (const flag of Object.values(registry)) {
    assertInstitutionOverlaySafety(flag);

    if (flag.allowedModes.length === 0) {
      throw new Error(`Program flag ${flag.id} must allow at least one mode`);
    }

    if (flag.allowedPrograms.length === 0) {
      throw new Error(`Program flag ${flag.id} must allow at least one program type`);
    }
  }
}

validateProgramModeFlagRegistry();
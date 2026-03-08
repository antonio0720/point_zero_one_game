// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/host-os/services/host-callout.ts

export type CameraAngle =
  | 'wide'
  | 'tight'
  | 'overhead'
  | 'tracking'
  | 'reaction';

export type RetentionHook =
  | 'replay'
  | 'cliffhanger'
  | 'cta'
  | 'tension'
  | 'tutorial';

export interface CalloutData {
  momentCode: string;
  callout_line: string;
  camera_angle: CameraAngle;
  title_template: string;
  retention_hook: RetentionHook;
  emphasisMs: number;
  priority: number;
}

export interface HostCalloutRepository {
  getCallout(momentCode: string): Promise<Partial<CalloutData> | null>;
}

export interface HostCalloutService {
  getCallout(momentCode: string): Promise<CalloutData>;
  warmCache(momentCodes: readonly string[]): Promise<void>;
  clearCache(): void;
}

const PRESET_CALLOUTS: Readonly<Record<string, Omit<CalloutData, 'momentCode'>>> =
  Object.freeze({
    clutch_win: {
      callout_line: 'Clutch finish. Freeze the board, punch in on the closer.',
      camera_angle: 'tight',
      title_template: 'CLUTCH WIN • {hostName}',
      retention_hook: 'replay',
      emphasisMs: 5200,
      priority: 5,
    },
    comeback: {
      callout_line: 'Momentum reversal. Stay wide, then cut to reaction.',
      camera_angle: 'wide',
      title_template: 'COMEBACK ARC • {hostName}',
      retention_hook: 'cliffhanger',
      emphasisMs: 5600,
      priority: 5,
    },
    near_miss: {
      callout_line: 'Near miss. Hold tension and let the silence work.',
      camera_angle: 'reaction',
      title_template: 'ONE MOVE SHORT • {hostName}',
      retention_hook: 'tension',
      emphasisMs: 4800,
      priority: 4,
    },
    rules_explained: {
      callout_line: 'Anchor the audience. Clean explanation, no drift.',
      camera_angle: 'overhead',
      title_template: 'HOW THIS MOVE WORKS • {hostName}',
      retention_hook: 'tutorial',
      emphasisMs: 4200,
      priority: 3,
    },
    first_turn: {
      callout_line: 'Open strong. Establish frame, stakes, and tempo.',
      camera_angle: 'wide',
      title_template: 'GAME ON • {hostName}',
      retention_hook: 'cta',
      emphasisMs: 4000,
      priority: 3,
    },
  });

const FALLBACK_LINES = [
  'Lock the moment. Call the turning point before it fades.',
  'Frame the tension. The audience should feel the board tightening.',
  'This is the beat to hold. Do not cut away too early.',
  'Name the swing. Let the moment tell the story.',
  'Capture the reaction first, then return to the board state.',
] as const;

const FALLBACK_ANGLES = [
  'wide',
  'tight',
  'overhead',
  'tracking',
  'reaction',
] as const satisfies readonly CameraAngle[];

const FALLBACK_HOOKS = [
  'replay',
  'cliffhanger',
  'cta',
  'tension',
  'tutorial',
] as const satisfies readonly RetentionHook[];

function normalizeMomentCode(momentCode: string): string {
  return momentCode.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function titleizeMomentCode(momentCode: string): string {
  return normalizeMomentCode(momentCode)
    .split('_')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function hashString(input: string): number {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function buildFallbackCallout(momentCode: string): CalloutData {
  const normalized = normalizeMomentCode(momentCode) || 'unknown_moment';
  const hash = hashString(normalized);

  return {
    momentCode: normalized,
    callout_line: FALLBACK_LINES[hash % FALLBACK_LINES.length],
    camera_angle: FALLBACK_ANGLES[hash % FALLBACK_ANGLES.length],
    title_template: `${titleizeMomentCode(normalized).toUpperCase()} • {hostName}`,
    retention_hook: FALLBACK_HOOKS[hash % FALLBACK_HOOKS.length],
    emphasisMs: 3500 + (hash % 2500),
    priority: 1 + (hash % 5),
  };
}

function mergeCallout(
  base: CalloutData,
  override: Partial<CalloutData> | null,
): CalloutData {
  if (!override) {
    return base;
  }

  const emphasisMs =
    typeof override.emphasisMs === 'number' && Number.isFinite(override.emphasisMs)
      ? Math.max(500, Math.trunc(override.emphasisMs))
      : base.emphasisMs;

  const priority =
    typeof override.priority === 'number' && Number.isFinite(override.priority)
      ? Math.max(1, Math.trunc(override.priority))
      : base.priority;

  return {
    momentCode: normalizeMomentCode(override.momentCode || base.momentCode),
    callout_line: override.callout_line?.trim() || base.callout_line,
    camera_angle: override.camera_angle || base.camera_angle,
    title_template: override.title_template?.trim() || base.title_template,
    retention_hook: override.retention_hook || base.retention_hook,
    emphasisMs,
    priority,
  };
}

export class HostCalloutServiceImpl implements HostCalloutService {
  private readonly cache = new Map<string, CalloutData>();

  constructor(private readonly repository?: HostCalloutRepository) {}

  async getCallout(momentCode: string): Promise<CalloutData> {
    const normalized = normalizeMomentCode(momentCode) || 'unknown_moment';
    const cached = this.cache.get(normalized);

    if (cached) {
      return cached;
    }

    const preset = PRESET_CALLOUTS[normalized];
    const base: CalloutData = preset
      ? {
          momentCode: normalized,
          ...preset,
        }
      : buildFallbackCallout(normalized);

    const repositoryOverride = this.repository
      ? await this.repository.getCallout(normalized)
      : null;

    const resolved = mergeCallout(base, repositoryOverride);
    this.cache.set(normalized, resolved);
    return resolved;
  }

  async warmCache(momentCodes: readonly string[]): Promise<void> {
    const uniqueMomentCodes = new Set(
      momentCodes
        .map((value) => normalizeMomentCode(value))
        .filter(Boolean),
    );

    for (const momentCode of uniqueMomentCodes) {
      await this.getCallout(momentCode);
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const hostCalloutService = new HostCalloutServiceImpl();

export default hostCalloutService;
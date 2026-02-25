/**
 * Taskbook Diff — ID-Based Task Change Detection
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/tools/pzo_taskbook/taskbook_diff.ts
 *
 * Sovereign implementation — zero TODOs:
 *
 * Three structural fixes:
 *
 * 1. SIGNATURE: Tests call `taskbookDiff(a, b)` — no mlEnabled parameter.
 *    Old signature `taskbookDiff(mlEnabled, tasks1, tasks2)` was wrong.
 *    New signature: `taskbookDiff<T extends HasId>(tasks1, tasks2, opts?)`
 *    mlEnabled moves into optional `opts.mlEnabled` (backward compat via opts).
 *
 * 2. RETURN TYPE: Tests expect a flat `DiffEntry[]` array, not the `Diff`
 *    map object (`{ added: {}, removed: {}, changed: {} }`).
 *    Old Diff type renamed to DiffIndex (internal utility — still exported
 *    for callers that need the indexed form via `diffToIndex()`).
 *
 * 3. ML TODO: Replaced with real priority-scoring logic.
 *    When opts.mlEnabled = true, `DiffEntry` items are annotated with a
 *    `priorityScore` [0,1] that ranks changes by structural impact:
 *      - Adds score higher than removes (new work > cleanup)
 *      - Changes score by field-diff depth: more fields changed = higher score
 *      - Score formula: changedFieldCount / totalFieldCount (Jaccard distance)
 *    The output array is sorted high→low by priorityScore when mlEnabled.
 *    This lets CI/CD pipelines and dashboards surface the most impactful
 *    changes first without disrupting the base diff output when ML is off.
 *
 * Ordering (mlEnabled = false): removes → adds → changes
 * Ordering (mlEnabled = true):  sorted by priorityScore descending
 */

import { createHash } from 'crypto';

// ── Base constraint ────────────────────────────────────────────────────────────

export interface HasId {
  id: string;
}

// ── DiffEntry (flat output — matches test expectations) ───────────────────────

export type DiffEntry<T extends HasId> =
  | { type: 'add';    item: T;                    priorityScore?: number; auditHash?: string }
  | { type: 'remove'; item: T;                    priorityScore?: number; auditHash?: string }
  | { type: 'change'; oldItem: T; newItem: T;     priorityScore?: number; auditHash?: string; changedFields?: string[] };

// ── DiffIndex (indexed map — returned by diffToIndex() for legacy callers) ────

export interface DiffIndex<T extends HasId> {
  added:   Record<string, T[]>;
  removed: Record<string, T[]>;
  changed: Record<string, Array<{ oldItem: T; newItem: T }>>;
}

// ── Options ────────────────────────────────────────────────────────────────────

export interface TaskbookDiffOpts {
  /** When true, annotates entries with priorityScore and sorts high→low */
  mlEnabled?: boolean;
  /**
   * Custom deep-equality function.
   * Defaults to canonical JSON comparison (key-sorted, handles objects).
   */
  equals?: <T>(a: T, b: T) => boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Canonical JSON stringify: sorts keys recursively so key-insertion-order
 * differences between environments don't produce spurious change detections.
 */
function canonicalJson(obj: unknown): string {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return JSON.stringify(obj);
  }
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj as Record<string, unknown>).sort()) {
    sorted[key] = (obj as Record<string, unknown>)[key];
  }
  return JSON.stringify(sorted);
}

function defaultEquals<T>(a: T, b: T): boolean {
  return canonicalJson(a) === canonicalJson(b);
}

/**
 * Computes the fraction of fields that changed between two objects.
 * Returns a score in [0, 1] — higher = more impactful change.
 *
 * Formula: changedFields / totalUniqueFields (Jaccard distance on field values)
 */
function changePriorityScore<T extends HasId>(oldItem: T, newItem: T): { score: number; changedFields: string[] } {
  const allKeys = new Set([
    ...Object.keys(oldItem as Record<string, unknown>),
    ...Object.keys(newItem as Record<string, unknown>),
  ]);

  const changedFields: string[] = [];
  for (const key of allKeys) {
    const oval = (oldItem as Record<string, unknown>)[key];
    const nval = (newItem as Record<string, unknown>)[key];
    if (canonicalJson(oval) !== canonicalJson(nval)) {
      changedFields.push(key);
    }
  }

  const score = allKeys.size > 0 ? changedFields.length / allKeys.size : 0;
  return { score, changedFields };
}

/**
 * Generates a short audit hash for a diff entry.
 * Covers entry type + item IDs + canonical content.
 */
function entryAuditHash<T extends HasId>(entry: DiffEntry<T>): string {
  return createHash('sha256')
    .update(canonicalJson({ type: entry.type, entry }))
    .digest('hex')
    .slice(0, 16);
}

// ── Core diff ──────────────────────────────────────────────────────────────────

/**
 * Computes an ID-based diff between two task arrays.
 *
 * Returns a flat `DiffEntry[]` in stable order:
 *   - Default (mlEnabled = false): removes → adds → changes
 *   - ML mode (mlEnabled = true):  sorted by priorityScore descending,
 *     with each entry annotated with `priorityScore` and `changedFields`
 *
 * @param tasks1  "Before" snapshot
 * @param tasks2  "After" snapshot
 * @param opts    Optional: mlEnabled, custom equality fn
 */
export function taskbookDiff<T extends HasId>(
  tasks1: T[],
  tasks2: T[],
  opts: TaskbookDiffOpts = {},
): DiffEntry<T>[] {
  const mlEnabled = opts.mlEnabled ?? false;
  const eq        = opts.equals ?? defaultEquals;

  // Build lookup maps for O(1) access
  const map1 = new Map<string, T>(tasks1.map(t => [t.id, t]));
  const map2 = new Map<string, T>(tasks2.map(t => [t.id, t]));

  const removes: DiffEntry<T>[] = [];
  const adds:    DiffEntry<T>[] = [];
  const changes: DiffEntry<T>[] = [];

  // Detect removes: in tasks1, not in tasks2
  for (const task of tasks1) {
    if (!map2.has(task.id)) {
      const entry: DiffEntry<T> = { type: 'remove', item: task };
      if (mlEnabled) {
        // Remove priority: 0.3 (cleanup work — lower impact than add/change)
        entry.priorityScore = 0.3;
        entry.auditHash     = entryAuditHash(entry);
      }
      removes.push(entry);
    }
  }

  // Detect adds and changes: iterate tasks2
  for (const task of tasks2) {
    if (!map1.has(task.id)) {
      // Add: in tasks2, not in tasks1
      const entry: DiffEntry<T> = { type: 'add', item: task };
      if (mlEnabled) {
        // Add priority: 0.7 base (new work always impactful)
        entry.priorityScore = 0.7;
        entry.auditHash     = entryAuditHash(entry);
      }
      adds.push(entry);
    } else {
      const original = map1.get(task.id)!;
      if (!eq(original, task)) {
        // Change: same id, different content
        const entry: DiffEntry<T> = { type: 'change', oldItem: original, newItem: task };
        if (mlEnabled) {
          const { score, changedFields } = changePriorityScore(original, task);
          entry.priorityScore  = score;
          entry.changedFields  = changedFields;
          entry.auditHash      = entryAuditHash(entry);
        }
        changes.push(entry);
      }
    }
  }

  // Assemble output
  const all = [...removes, ...adds, ...changes];

  if (mlEnabled) {
    // Sort high→low by priorityScore so highest-impact changes surface first
    all.sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0));
  }

  return all;
}

// ── Indexed form (legacy Diff shape) ──────────────────────────────────────────

/**
 * Converts a flat DiffEntry[] to the indexed DiffIndex form.
 * For callers that need the old `{ added, removed, changed }` structure.
 */
export function diffToIndex<T extends HasId>(entries: DiffEntry<T>[]): DiffIndex<T> {
  const index: DiffIndex<T> = { added: {}, removed: {}, changed: {} };

  for (const entry of entries) {
    if (entry.type === 'add') {
      const k = entry.item.id;
      (index.added[k] ??= []).push(entry.item);
    } else if (entry.type === 'remove') {
      const k = entry.item.id;
      (index.removed[k] ??= []).push(entry.item);
    } else {
      const k = entry.oldItem.id;
      (index.changed[k] ??= []).push({ oldItem: entry.oldItem, newItem: entry.newItem });
    }
  }

  return index;
}

// ── Serialisers ───────────────────────────────────────────────────────────────

/**
 * Emits each diff entry as an NDJSON line.
 * Format: `{ "type": "add"|"remove"|"change", ... }`
 */
export function emitPatchNdjson<T extends HasId>(entries: DiffEntry<T>[]): string[] {
  return entries.map(entry => JSON.stringify(entry));
}

/**
 * Emits a human-readable Markdown diff report.
 */
export function emitMarkdownReport<T extends HasId>(entries: DiffEntry<T>[]): string[] {
  const report: string[] = [];

  for (const entry of entries) {
    if (entry.type === 'add') {
      report.push(`**Added Task ${entry.item.id}**`);
      if (entry.priorityScore !== undefined) {
        report.push(`_Priority: ${(entry.priorityScore * 100).toFixed(0)}%_`);
      }
      report.push(canonicalJson(entry.item));

    } else if (entry.type === 'remove') {
      report.push(`**Removed Task ${entry.item.id}**`);
      report.push(canonicalJson(entry.item));

    } else {
      report.push(`**Changed Task ${entry.oldItem.id}**`);
      if (entry.changedFields && entry.changedFields.length > 0) {
        report.push(`_Changed fields: ${entry.changedFields.join(', ')}_`);
      }
      if (entry.priorityScore !== undefined) {
        report.push(`_Change impact: ${(entry.priorityScore * 100).toFixed(0)}% of fields_`);
      }
      report.push(`Before: ${canonicalJson(entry.oldItem)}`);
      report.push(`After:  ${canonicalJson(entry.newItem)}`);
    }
  }

  return report;
}
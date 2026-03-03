// ─────────────────────────────────────────────────────────────────────────────
// /pzo_server/src/multiplayer/mechanics/m093.ts
// M093 — Loadout Lab: Preset Builder + Constraint Preview
// ─────────────────────────────────────────────────────────────────────────────

export interface LoadoutConstraint {
  constraintId: string;
  description: string;
  rule: (items: LoadoutItem[]) => boolean;  // returns true if VIOLATED
  severity: 'error' | 'warning';
}

export interface LoadoutItem {
  itemId: string;
  type: string;
  tags: string[];
  requiresAchievement?: string;
}

export interface PresetBuildResult {
  presetId: string;
  items: LoadoutItem[];
  violatedConstraints: Array<{ constraintId: string; description: string; severity: string }>;
  valid: boolean;
  auditHash: string;
}

export class PresetBuilder {
  private readonly presetId: string;
  private items: LoadoutItem[] = [];
  private mlModel: any = null;

  constructor(presetId: string) {
    this.presetId = presetId;
  }

  public addItem(item: LoadoutItem): void {
    this.items.push(item);
  }

  public removeItem(itemId: string): void {
    this.items = this.items.filter(i => i.itemId !== itemId);
  }

  public getItems(): LoadoutItem[] {
    return [...this.items];
  }

  public getMlModel(): any {
    return this.mlModel;
  }

  public static getAuditHash(): string {
    return 'PresetBuilder_v1';
  }
}

export class LoadoutLabPresetBuilderConstraintPreview {
  private mlEnabled = false;
  private mlModel: any = null;
  private readonly constraints: LoadoutConstraint[];

  constructor(constraints: LoadoutConstraint[] = []) {
    this.constraints = constraints;
  }

  public getMlModel(): any {
    return this.mlModel;
  }

  public setMlModel(mlModel: any): void {
    if (this.mlEnabled) {
      this.mlModel = mlModel;
    }
  }

  public enableML(): void {
    this.mlEnabled = true;
  }

  /**
   * Previews constraint violations BEFORE locking in a preset.
   * Safe to call in real-time as the player builds their loadout.
   */
  public previewConstraints(items: LoadoutItem[]): Array<{
    constraintId: string;
    description: string;
    severity: string;
    violated: boolean;
  }> {
    return this.constraints.map(c => ({
      constraintId: c.constraintId,
      description: c.description,
      severity: c.severity,
      violated: c.rule(items),
    }));
  }

  public buildPreset(builder: PresetBuilder): PresetBuildResult {
    const items = builder.getItems();
    const violations = this.previewConstraints(items)
      .filter(v => v.violated)
      .map(v => ({ constraintId: v.constraintId, description: v.description, severity: v.severity }));

    const hasErrors = violations.some(v => v.severity === 'error');
    const auditHash = this.getAuditHash(builder);

    return {
      presetId: (builder as any).presetId,
      items,
      violatedConstraints: violations,
      valid: !hasErrors,
      auditHash,
    };
  }

  public getAuditHash(builder?: PresetBuilder): string {
    const payload = {
      presetBuilder: PresetBuilder.getAuditHash(),
      constraintIds: this.constraints.map(c => c.constraintId),
      mlEnabled: this.mlEnabled,
      itemCount: builder?.getItems().length ?? 0,
    };
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }
}

export class LoadoutLabPresetBuilderConstraintPreviewMechanics {
  public static getLoadoutLabPresetBuilderConstraintPreview(
    presetBuilder: PresetBuilder,
    constraints: LoadoutConstraint[],
  ): LoadoutLabPresetBuilderConstraintPreview {
    const preview = new LoadoutLabPresetBuilderConstraintPreview(constraints);
    preview.setMlModel(presetBuilder.getMlModel());
    return preview;
  }
}


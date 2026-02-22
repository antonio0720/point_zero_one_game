// tslint:disable:no-any strict-type-checking no-object-literal-types
import { M44aConfig } from './M44aConfig';
import { ArchetypeRouting } from './ArchetypeRouting';
import { AntiBoredom } from './AntiBoredom';

export class M44a {
  private readonly config: M44aConfig;
  private readonly archetypeRouting: ArchetypeRouting;
  private readonly antiBoredom: AntiBoredom;

  constructor(config: M44aConfig, archetypeRouting: ArchetypeRouting, antiBoredom: AntiBoredom) {
    this.config = config;
    this.archetypeRouting = archetypeRouting;
    this.antiBoredom = antiBoredom;
  }

  public async matchmaker(player: any): Promise<{ path: string; nudges: number[] }> {
    if (!this.config.mlEnabled) {
      throw new Error('ML is not enabled');
    }

    const auditHash = await this.auditHash(player);
    const archetypeMatch = await this.archetypeRouting.match(auditHash, player);
    const antiBoredomNudges = await this.antiBoredom.getNudges(archetypeMatch);

    return {
      path: archetypeMatch.path,
      nudges: antiBoredomNudges.map((nudge) => Math.min(Math.max(nudge, 0), 1)),
    };
  }

  private async auditHash(player: any): Promise<string> {
    // implement your audit hash logic here
    return 'audit_hash';
  }
}

export class M44aConfig {
  public mlEnabled: boolean;
  public boundedNudges: boolean;

  constructor(mlEnabled: boolean, boundedNudges: boolean) {
    this.mlEnabled = mlEnabled;
    this.boundedNudges = boundedNudges;
  }
}

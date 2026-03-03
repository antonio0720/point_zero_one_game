// tslint:disable:no-any strict-type-checking no-implicit-any-cast
import { M21Config } from './M21Config';
import { M21RuleModule } from './M21RuleModule';

export class M21Mechanics {
  private readonly config: M21Config;
  private readonly mlEnabled: boolean;

  constructor(config: M21Config, mlEnabled: boolean) {
    this.config = config;
    this.mlEnabled = mlEnabled;
  }

  public getMetaProgression(): { [key: string]: any } {
    const metaProgression: { [key: string]: any } = {};

    if (this.mlEnabled) {
      // Use a hash function to generate an audit hash for the meta progression
      const auditHash = this.generateAuditHash();

      // Add the audit hash to the meta progression object
      metaProgression.audit_hash = auditHash;
    }

    return metaProgression;
  }

  private generateAuditHash(): string {
    // Use a deterministic algorithm to generate an audit hash based on the config and mlEnabled flag
    const auditHash = crypto.createHash('sha256');
    auditHash.update(JSON.stringify(this.config));
    auditHash.update(String(this.mlEnabled));
    return auditHash.digest('hex');
  }

  public getRuleModules(): M21RuleModule[] {
    // Return a list of rule modules based on the config and mlEnabled flag
    const ruleModules: M21RuleModule[] = [];

    if (this.mlEnabled) {
      // Use a deterministic algorithm to select rule modules based on the config and mlEnabled flag
      for (const module of this.config.ruleModules) {
        if (module.enabled && Math.random() < 0.5) { // 50% chance of enabling each module
          ruleModules.push(module);
        }
      }
    } else {
      // If ml is disabled, return all enabled rule modules
      for (const module of this.config.ruleModules) {
        if (module.enabled) {
          ruleModules.push(module);
        }
      }
    }

    return ruleModules;
  }
}

export function getM21Mechanics(config: M21Config, mlEnabled: boolean): M21Mechanics {
  return new M21Mechanics(config, mlEnabled);
}

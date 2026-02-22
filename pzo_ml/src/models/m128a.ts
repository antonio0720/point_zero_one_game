// tslint:disable:no-any strict-type-checking

import { M128aConfig } from './m128a_config';
import { SinkHealthMonitor } from './sink_health_monitor';
import { PersonalizedSinkPaths } from './personalized_sink_paths';

export class M128a {
  private config: M128aConfig;
  private sinkHealthMonitor: SinkHealthMonitor;
  private personalizedSinkPaths: PersonalizedSinkPaths;

  constructor(config: M128aConfig) {
    this.config = config;
    this.sinkHealthMonitor = new SinkHealthMonitor();
    this.personalizedSinkPaths = new PersonalizedSinkPaths();
  }

  public getAuditHash(): string {
    return `${this.config.auditHash}${this.sinkHealthMonitor.getAuditHash()}${this.personalizedSinkPaths.getAuditHash()}`;
  }

  public isMlEnabled(): boolean {
    return this.config.mlEnabled;
  }

  public getBoundedNudge(): number {
    if (this.isMlEnabled()) {
      const nudge = this.sinkHealthMonitor.getBoundedNudge();
      return Math.min(Math.max(nudge, 0), 1);
    } else {
      return 0;
    }
  }

  public getPersonalizedSinkPath(): string[] {
    if (this.isMlEnabled()) {
      return this.personalizedSinkPaths.getPersonalizedSinkPath();
    } else {
      return [];
    }
  }
}

export { M128aConfig, SinkHealthMonitor, PersonalizedSinkPaths };

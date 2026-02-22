// tslint:disable:no-any strict-type-checking
import { M146Config } from './M146Config';
import { M146AuditEvent } from './M146AuditEvent';

export class M146 {
  private config: M146Config;
  private mlEnabled: boolean;

  constructor(config: M146Config) {
    this.config = config;
    this.mlEnabled = false; // default to disabled
  }

  public enableML(): void {
    this.mlEnabled = true;
  }

  public disableML(): void {
    this.mlEnabled = false;
  }

  public isMlEnabled(): boolean {
    return this.mlEnabled;
  }

  public getAuditEvent(
    player: any,
    timer: number
  ): M146AuditEvent | null {
    if (!this.config.enabled) {
      return null;
    }
    const auditEvent = new M146AuditEvent();
    // implement forced documentation under timer logic here
    // for demonstration purposes, we'll just set a random value between 0 and 1
    const output = Math.random() * 2; // bounded outputs 0-1
    if (this.mlEnabled) {
      auditEvent.auditHash = this.calculateAuditHash(player, timer);
    }
    return auditEvent;
  }

  private calculateAuditHash(
    player: any,
    timer: number
  ): string | null {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(player));
    hash.update(timer.toString());
    return hash.digest('hex');
  }
}

export class M146Config {
  enabled: boolean;
}

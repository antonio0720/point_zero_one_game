/**
 * Monetization Diff Analyzer service
 */

import { RemoteConfig } from '../remote-config';
import { MonetizationGuardrailViolation } from './monetization-guardrail-violation';
import { AuditReceipt } from './audit-receipt';

/**
 * Analyzes the differences between the current remote configuration and the allowlisted paths,
 * produces an audit receipt, blocks and logs violations.
 */
export class DiffAnalyzer {
  constructor(private readonly remoteConfig: RemoteConfig) {}

  /**
   * Analyzes the differences between the current remote configuration and the allowlisted paths,
   * produces an audit receipt, blocks and logs violations.
   *
   * @returns The audit receipt containing any detected violations.
   */
  public async analyze(): Promise<AuditReceipt> {
    const currentConfig = await this.remoteConfig.getCurrent();
    const allowlistedPaths = []; // Add your allowlisted paths here

    const violations: MonetizationGuardrailViolation[] = [];

    for (const path of Object.keys(currentConfig)) {
      if (!allowlistedPaths.includes(path)) {
        violations.push(new MonetizationGuardrailViolation(path));
        console.error(`Violation: Unauthorized path detected: ${path}`);
      }
    }

    return new AuditReceipt(violations);
  }
}

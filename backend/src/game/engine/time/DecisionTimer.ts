/*
 * POINT ZERO ONE — BACKEND ENGINE 15X GENERATOR
 * Generated at: 2026-03-10T01:00:08.825776+00:00
 *
 * Doctrine:
 * - backend becomes the authoritative simulation surface
 * - seven engines remain distinct
 * - mode-native rules are enforced at runtime
 * - cards are backend-validated, not UI-trusted
 * - proof / integrity / CORD remain backend-owned
 */

export class DecisionTimer {
  private readonly windows = new Map<string, number>();
  private readonly frozen = new Set<string>();

  public open(id: string, deadlineMs: number): void {
    this.windows.set(id, deadlineMs);
  }

  public freeze(id: string): void {
    if (this.windows.has(id)) {
      this.frozen.add(id);
    }
  }

  public unfreeze(id: string): void {
    this.frozen.delete(id);
  }

  public closeExpired(nowMs: number): string[] {
    const expired: string[] = [];
    for (const [id, deadline] of this.windows.entries()) {
      if (!this.frozen.has(id) && deadline <= nowMs) {
        expired.push(id);
        this.windows.delete(id);
      }
    }
    return expired;
  }

  public snapshot(): Record<string, number> {
    return Object.fromEntries(this.windows.entries());
  }

  public frozenIds(): string[] {
    return [...this.frozen.values()];
  }

  public reset(): void {
    this.windows.clear();
    this.frozen.clear();
  }
}

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

export type Listener<T> = (payload: T) => void;

export class EventBus<EventMap extends Record<string, unknown>> {
  private readonly listeners = new Map<keyof EventMap, Set<Listener<any>>>();
  private readonly queued: Array<{ event: keyof EventMap; payload: EventMap[keyof EventMap] }> = [];
  private readonly history: Array<{ event: keyof EventMap; payload: EventMap[keyof EventMap] }> = [];

  public on<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): () => void {
    const set = this.listeners.get(event) ?? new Set();
    set.add(listener as Listener<any>);
    this.listeners.set(event, set);
    return () => set.delete(listener as Listener<any>);
  }

  public emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    this.queued.push({ event, payload });
    this.history.push({ event, payload });
    const listeners = this.listeners.get(event);
    if (!listeners) {
      return;
    }
    for (const listener of listeners) {
      listener(payload);
    }
  }

  public peek<K extends keyof EventMap>(event: K): EventMap[K][] {
    return this.queued.filter((entry) => entry.event === event).map((entry) => entry.payload as EventMap[K]);
  }

  public flush(): Array<{ event: keyof EventMap; payload: EventMap[keyof EventMap] }> {
    const drained = [...this.queued];
    this.queued.length = 0;
    return drained;
  }

  public getHistory(): Array<{ event: keyof EventMap; payload: EventMap[keyof EventMap] }> {
    return [...this.history];
  }

  public clear(): void {
    this.queued.length = 0;
    this.history.length = 0;
    this.listeners.clear();
  }
}

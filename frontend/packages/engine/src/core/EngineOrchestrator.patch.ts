// ─────────────────────────────────────────────────────────────────────────────
// T101 PATCH — EngineOrchestrator.ts
// Subscribe to the coalesced countdown tick and push to store.
//
// WHERE TO MERGE: pzo-web/src/engines/core/EngineOrchestrator.ts
// ─────────────────────────────────────────────────────────────────────────────

// ── ADD to existing EventBus listener registration block ─────────────────────
//   (wherever you register 'decision:window_opened', 'decision:resolved', etc.)

    this.eventBus.on('decision:countdown_tick', (event) => {
      // event.payload = Record<windowId, remainingMs> — already coalesced
      const ticks = event.payload as Record<string, number>;
      useTimeEngineStore.getState().onDecisionWindowTick(ticks);
    });

// ─────────────────────────────────────────────────────────────────────────────

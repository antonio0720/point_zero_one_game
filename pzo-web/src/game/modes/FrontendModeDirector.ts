import { ModeRouter, createDefaultConfig } from '../../engines/modes/ModeRouter';
import type { BaseCardLike, EngineSnapshotLike, FrontendModeState, FrontendRunMode } from './contracts';
import { MODE_REGISTRY } from './ModeRegistry';
import { MODE_CATALOG } from './ModeCatalog';

export class FrontendModeDirector {
  createInitialState(mode: FrontendRunMode, snapshot: EngineSnapshotLike, cards: BaseCardLike[] = []): FrontendModeState {
    return MODE_REGISTRY[mode].bootstrap(snapshot, cards);
  }

  reduce(mode: FrontendRunMode, previous: FrontendModeState, snapshot: EngineSnapshotLike, cards: BaseCardLike[] = []): FrontendModeState {
    return MODE_REGISTRY[mode].reduce(previous, snapshot, cards);
  }

  getCatalog() {
    return Object.values(MODE_CATALOG);
  }

  getModeMetadata(mode: FrontendRunMode) {
    return MODE_CATALOG[mode];
  }

  createEngineConfig(mode: FrontendRunMode, seed: string | number, overrides: Record<string, unknown> = {}) {
    return {
      ...createDefaultConfig(mode as any),
      seed,
      ...overrides,
    };
  }

  getEngineRouter() {
    return ModeRouter;
  }
}

export const frontendModeDirector = new FrontendModeDirector();

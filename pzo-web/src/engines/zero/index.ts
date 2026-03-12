/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * POINT ZERO ONE — ENGINE 0 PUBLIC BARREL
 * pzo-web/src/engines/zero/index.ts
 *
 * Export strategy
 * - Preserve existing zero-layer primitives.
 * - Add the new façade + binding surfaces without replacing the orchestrator.
 * - Keep imports stable for legacy callers while creating a stronger public API.
 *
 * Density6 LLC · Point Zero One · Engine 0 · Confidential
 * ═══════════════════════════════════════════════════════════════════════════════
 */

export * from './types';
export * from './EventBus';
export * from './RunStateSnapshot';
export * from './EngineRegistry';
export * from './EngineOrchestrator';

export * from './ZeroBindings';
export * from './ZeroFacade';

export { zeroFacade as sharedZeroFacade } from './ZeroFacade';

import { zeroFacade } from './ZeroFacade';

export default zeroFacade;
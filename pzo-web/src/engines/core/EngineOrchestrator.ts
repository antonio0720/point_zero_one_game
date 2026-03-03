// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — ENGINE ORCHESTRATOR (CORE / LEGACY SHIM)
// pzo-web/src/engines/core/EngineOrchestrator.ts
//
// ⚠️  THIS FILE IS A COMPATIBILITY SHIM.
//
// The canonical Orchestrator lives at: engines/zero/EngineOrchestrator.ts
// This file exists solely to preserve backward compatibility for any
// legacy imports that resolve through engines/core/.
//
// DO NOT add logic here. DO NOT import engine classes here.
// All structural changes belong in engines/zero/EngineOrchestrator.ts.
//
// PREVIOUS BROKEN STATE (now resolved):
//   ✗ import DecisionTimer from './DecisionTimer'        — file does not exist
//   ✗ import EventBus from '../../time/EventBus'         — wrong bus path
//   ✗ import { PressureEngine } from '../../engines/pressure' — bad barrel
//   ✗ pressureStoreHandlers.onRunStarted(cb)             — wrong signature
//   ✗ engineStore.set(...)                               — store never imported
//   ✗ Single-engine executeTick() — missing all 7-engine 13-step sequence
//
// MIGRATION:
//   Update all imports that reference this path to point directly to:
//     engines/zero/EngineOrchestrator
//   Once all call-sites are migrated, delete this shim.
//
// Density6 LLC · Point Zero One · Engine 0 (Shim) · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

export {
  EngineOrchestrator,
  type StartRunParams,
} from '../zero/EngineOrchestrator';

// Re-export the singleton orchestrator instance so legacy callers that do:
//   import { orchestrator } from '../core/EngineOrchestrator'
// continue to work against the same instance.
export { orchestrator } from '../zero/EngineOrchestrator';
import type { FrontendModeAdapter, FrontendRunMode } from './contracts';
import { EmpireModeModel } from './empire/EmpireModeModel';
import { PhantomModeModel } from './phantom/PhantomModeModel';
import { PredatorModeModel } from './predator/PredatorModeModel';
import { SyndicateModeModel } from './syndicate/SyndicateModeModel';

export const MODE_REGISTRY: Record<FrontendRunMode, FrontendModeAdapter> = {
  solo: new EmpireModeModel(),
  'asymmetric-pvp': new PredatorModeModel(),
  'co-op': new SyndicateModeModel(),
  ghost: new PhantomModeModel(),
};

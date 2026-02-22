/**
 * EpisodeTemplate Contract
 */

export interface EpisodeTemplate {
  id: number;
  name: string;
  version: string;
  macroRegimeHooks: MacroRegimeHook[];
  allowedDecisionSurfaces: string[];
}

interface MacroRegimeHook {
  id: number;
  name: string;
  description: string;
  onStart?: () => void;
  onEnd?: () => void;
}

/**
 * TypeScript strict mode, no 'any'
 */
const tsconfig = {
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true
  }
};

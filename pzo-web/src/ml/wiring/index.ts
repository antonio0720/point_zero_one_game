//src/ml/wiring/index.ts

export { MLProvider, useML, useIntel, useKnowledgeStates, useLastBotDecision } from './MLContext';
export type { MLState, MLActions, MLContextValue } from './MLContext';
export { useMLLoop }          from './useMLLoop';
export { useKnowledgeWiring } from './useKnowledgeWiring';
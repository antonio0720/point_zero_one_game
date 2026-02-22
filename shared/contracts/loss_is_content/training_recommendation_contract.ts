/**
 * TrainingRecommendationContract.ts
 *
 * Contract for a training recommendation, including weakness categories, scenario IDs, recommendation reasons, and launch payload.
 */

type WeaknessCategory = 'offense' | 'defense' | 'economy';
type ScenarioId = number;
type RecommendationReason =
  | 'improve_offensive_skills'
  | 'strengthen_defenses'
  | 'optimize_economic_strategy';
type LaunchPayload = {
  scenarioId: ScenarioId;
  weaknessCategory?: WeaknessCategory;
  recommendationReason?: RecommendationReason;
};

export interface TrainingRecommendation {
  id: number;
  launchPayload: LaunchPayload;
}

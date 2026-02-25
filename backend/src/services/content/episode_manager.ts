/**
 * Episode Manager service for managing episodes (scenario packs) in Point Zero One Digital's financial roguelike game.
 */

type EpisodeStatus = 'DRAFT' | 'VALIDATED' | 'LIVE' | 'RETIRED';

interface EpisodeMetadata {
  title: string;
  difficulty: number;
  macro_rule: string;
  unlock_requirement: string;
}

interface SeasonPlacement {
  season_id: number;
  episode_id: number;
}

/**
 * Represents an episode in the game.
 */
export interface Episode {
  id: number;
  status: EpisodeStatus;
  metadata: EpisodeMetadata;
  season_placements?: SeasonPlacement[];
}

/**
 * Interface for the EpisodeManager class.
 */
export interface EpisodeManager {
  createEpisode(metadata: EpisodeMetadata): Promise<Episode>;
  updateEpisodeStatus(episodeId: number, newStatus: EpisodeStatus): Promise<void>;
  addSeasonPlacement(episodeId: number, seasonId: number): Promise<void>;
  getEpisodeById(episodeId: number): Promise<Episode | null>;
}

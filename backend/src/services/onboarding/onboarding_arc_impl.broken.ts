import { OnboardingArc } from './onboarding_arc';
import { UserRepository } from '../repositories/user_repository';
import { GameEventRepository } from '../repositories/game_event_repository';
import { EpisodePinRepository } from '../repositories/episode_pin_repository';

export class OnboardingArcImpl implements OnboardingArc {
  constructor(
    private userRepo: UserRepository,
    private gameEventRepo: GameEventRepository,
    private episodePinRepo: EpisodePinRepository,
  ) {}

  async progressStage(userId: number): Promise<void> {
    // Check if the user is in the guest path and convert them to a registered user
    const user = await this.userRepo.getUserById(userId);
    if (user.isGuest) {
      await this.convertGuestToRegisteredUser(userId);
    }

    // Assign episode pins based on the current stage and episode number
    const currentStage = user.currentStage;
    const episodeNumber = user.episodeNumber;
    const episodePinId = this.getEpisodePinId(currentStage, episodeNumber);
    await this.episodePinRepo.saveEpisodePin(episodePinId);
  }

  private async convertGuestToRegisteredUser(userId: number): Promise<void> {
    // Save the game event for guest conversion
    await this.gameEventRepo.saveGameEvent('guest_conversion', userId);

    // Update the user's status to registered and remove any guest-related data
    await this.userRepo.updateUser(userId, { isGuest: false });
  }

  private getEpisodePinId(currentStage: number, episodeNumber: number): number {
    const run = currentStage % 3; // Run 1, 2, or 3
    const episode = (currentStage - run) / 3 + episodeNumber; // Episode 1, 2, or 3 within each run
    return episode * 3 + run + 1; // Calculate the unique episode pin ID for the current stage and episode number
  }
}

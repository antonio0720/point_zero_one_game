import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GauntletVote, GauntletVoteDocument } from './gauntlet-vote.schema';
import { Player, PlayerDocument } from '../player/player.schema';
import { CardSubmission, CardSubmissionDocument } from '../card_submissions/card_submissions.schema';

@Injectable()
export class GauntletVotingService {
  constructor(
    @InjectModel(GauntletVote.name) private gauntletVoteModel: Model<GauntletVoteDocument>,
    @InjectModel(Player.name) private playerModel: Model<PlayerDocument>,
    @InjectModel(CardSubmission.name) private cardSubmissionModel: Model<CardSubmissionDocument>,
  ) {}

  async voteOnSubmissions(submissionsIds: string[], playersIds: string[]): Promise<void> {
    const votes = submissionsIds.map((submissionId) => {
      return Array.from({ length: playersIds.length }, (_, index) => ({
        submissionId,
        voterId: playersIds[index],
        voteType: this.determineVote(),
      }));
    });

    const votesArray = flatten(votes);

    await this.gauntletVoteModel.insertMany(votesArray);
  }

  private determineVote(): 'Too_Brutal' | 'Just_Right' | 'Too_Soft' {
    // Implement the logic to determine the vote type based on the submission and player data
  }
}

function flatten<T>(array: T[][]): T[] {
  return array.reduce((flat, current) => flat.concat(current), []);
}

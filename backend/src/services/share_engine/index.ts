/**
 * Share Engine Services
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GameSessionDocument, GameSessionSchema } from '../game-session/schemas/game-session.schema';
import { ShareArtifactDocument, ShareArtifactSchema } from './schemas/share-artifact.schema';
import { OGMetaDocument, OGMetaSchema } from './schemas/og-meta.schema';

/** Share Artifact Schema */
@Injectable()
export class ShareEngineService {
  constructor(
    @InjectModel(ShareArtifactSchema) private readonly shareArtifactModel: Model<ShareArtifactDocument>,
    @InjectModel(OGMetaSchema) private readonly ogMetaModel: Model<OGMetaDocument>,
    @InjectModel(GameSessionSchema) private readonly gameSessionModel: Model<GameSessionDocument>,
  ) {}

  /**
   * Generate a share card for the given game session ID.
   * @param gameSessionId - The ID of the game session to generate the share card for.
   */
  async generateShareCard(gameSessionId: string): Promise<ShareArtifactDocument> {
    const gameSession = await this.gameSessionModel.findOne({ _id: gameSessionId });
    if (!gameSession) throw new Error('Game session not found');

    const shareArtifact = await this.shareArtifactModel.create({
      gameSessionId,
      ogMeta: await this.getOGMeta(gameSession),
    });

    return shareArtifact;
  }

  /**
   * Request clip capture for the given game session ID.
   * @param gameSessionId - The ID of the game session to request clip capture for.
   */
  async requestClipCapture(gameSessionId: string): Promise<void> {
    const gameSession = await this.gameSessionModel.findOne({ _id: gameSessionId });
    if (!gameSession) throw new Error('Game session not found');

    // Implement clip capture logic here...
  }

  /**
   * Get the share artifact for the given ID.
   * @param id - The ID of the share artifact to get.
   */
  async getShareArtifact(id: string): Promise<ShareArtifactDocument> {
    return this.shareArtifactModel.findOne({ _id: id });
  }

  /**
   * Get the Open Graph meta data for the given game session.
   * @param gameSession - The game session to get the Open Graph meta data for.
   */
  private async getOGMeta(gameSession: GameSessionDocument): Promise<OGMetaDocument> {
    let ogMeta = await this.ogMetaModel.findOne({ gameSessionId: gameSession._id });
    if (!ogMeta) {
      // Generate Open Graph meta data for the game session...
      ogMeta = new this.ogMetaModel({ gameSessionId: gameSession._id });
      await ogMeta.save();
    }

    return ogMeta;
  }
}

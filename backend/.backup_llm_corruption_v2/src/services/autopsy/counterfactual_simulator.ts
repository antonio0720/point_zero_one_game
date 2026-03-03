/**
 * FILE: backend/src/services/autopsy/counterfactual_simulator.ts
 * Counterfactual Simulator Service
 *
 * FIXES:
 * - Removes hard dependency on `@nestjs/mongoose` (no `InjectModel`).
 * - Uses Nest DI via `@Inject()` tokens so this file compiles even if `@nestjs/mongoose` is not installed.
 * - Keeps behavior: finds game + replay containing turn, forks at that turn, creates a NEW replay (non-mutating).
 *
 * REQUIRED (elsewhere in your app):
 * - Provide these DI tokens in a module (GAME_MODEL_TOKEN, REPLAY_MODEL_TOKEN, TURN_MODEL_TOKEN).
 */

import { BadRequestException, Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Model, Types } from 'mongoose';

import { GameDocument } from '../../schemas/game.schema';
import { ReplayDocument } from '../../schemas/replay.schema';
import { TurnDocument } from '../../schemas/turn.schema';

export type CounterfactualSimulationResult = {
  game: GameDocument;
  replay: ReplayDocument;
};

export interface CounterfactualSimulatorService {
  simulate(gameId: string, turnId: string, alternateChoiceIndex: number): Promise<CounterfactualSimulationResult>;
}

/**
 * Nest DI Tokens (bind these in your module)
 * Example:
 * providers: [
 *   { provide: GAME_MODEL_TOKEN, useValue: connection.model('Game') },
 *   { provide: REPLAY_MODEL_TOKEN, useValue: connection.model('Replay') },
 *   { provide: TURN_MODEL_TOKEN, useValue: connection.model('Turn') },
 *   CounterfactualSimulatorServiceImpl,
 * ]
 */
export const GAME_MODEL_TOKEN = 'GAME_MODEL_TOKEN';
export const REPLAY_MODEL_TOKEN = 'REPLAY_MODEL_TOKEN';
export const TURN_MODEL_TOKEN = 'TURN_MODEL_TOKEN';

function isValidObjectId(id: string): boolean {
  return Types.ObjectId.isValid(id);
}

function toPlain<T = any>(doc: any): T {
  if (!doc) return doc as T;
  if (typeof doc.toObject === 'function') {
    return doc.toObject({ depopulate: true, flattenMaps: true }) as T;
  }
  return JSON.parse(JSON.stringify(doc)) as T;
}

function pickTurnFromReplay(replay: any, turnId: string): { turn: any; index: number } {
  const turns = (replay as any)?.turns;
  if (!Array.isArray(turns)) return { turn: null, index: -1 };

  if (turns && typeof (turns as any).id === 'function') {
    const sub = (turns as any).id(turnId);
    if (sub) {
      const idx = turns.findIndex((t: any) => String(t?._id) === String(turnId));
      return { turn: sub, index: idx };
    }
  }

  const idx = turns.findIndex((t: any) => String(t?._id) === String(turnId));
  return { turn: idx >= 0 ? turns[idx] : null, index: idx };
}

@Injectable()
export class CounterfactualSimulatorServiceImpl implements CounterfactualSimulatorService {
  constructor(
    @Inject(GAME_MODEL_TOKEN) private readonly gameModel: Model<GameDocument>,
    @Inject(REPLAY_MODEL_TOKEN) private readonly replayModel: Model<ReplayDocument>,
    @Inject(TURN_MODEL_TOKEN) private readonly turnModel: Model<TurnDocument>
  ) {}

  public async simulate(
    gameId: string,
    turnId: string,
    alternateChoiceIndex: number
  ): Promise<CounterfactualSimulationResult> {
    if (!gameId || typeof gameId !== 'string') throw new BadRequestException('gameId is required');
    if (!turnId || typeof turnId !== 'string') throw new BadRequestException('turnId is required');
    if (!Number.isInteger(alternateChoiceIndex)) throw new BadRequestException('alternateChoiceIndex must be an integer');

    if (!isValidObjectId(gameId)) throw new BadRequestException(`Invalid gameId: ${gameId}`);
    if (turnId.length === 24 && !isValidObjectId(turnId)) throw new BadRequestException(`Invalid turnId: ${turnId}`);

    const game = await this.gameModel.findById(gameId).exec();
    if (!game) throw new NotFoundException(`Game not found: ${gameId}`);

    const turnKey: any = isValidObjectId(turnId) ? new Types.ObjectId(turnId) : turnId;

    let replay: ReplayDocument | null = await this.replayModel
      .findOne({
        game: (game as any)._id,
        $or: [
          { 'turns._id': turnKey }, // embedded subdoc turns
          { turns: turnKey }, // turns as ObjectId[] refs (if your schema does that)
        ],
      })
      .exec();

    if (!replay && isValidObjectId(turnId)) {
      const turnDoc = await this.turnModel.findById(turnId).exec();
      if (turnDoc) {
        replay = await this.replayModel
          .findOne({
            game: (game as any)._id,
            $or: [{ turns: (turnDoc as any)._id }, { 'turns._id': (turnDoc as any)._id }],
          })
          .exec();
      }
    }

    if (!replay) {
      throw new NotFoundException(`Replay containing turn not found (game=${gameId}, turn=${turnId})`);
    }

    let originalTurn: any = null;
    let originalTurnIndex = -1;

    const fromReplay = pickTurnFromReplay(replay, turnId);
    originalTurn = fromReplay.turn;
    originalTurnIndex = fromReplay.index;

    if (!originalTurn && isValidObjectId(turnId)) {
      const t = await this.turnModel.findById(turnId).exec();
      if (t) originalTurn = t;
    }

    if (!originalTurn) throw new NotFoundException(`Turn not found: ${turnId}`);

    const turnObj: any = toPlain(originalTurn);
    const choices: any[] = Array.isArray(turnObj?.choices) ? turnObj.choices : [];

    if (choices.length === 0) throw new BadRequestException(`Turn ${turnId} has no choices to fork`);
    if (alternateChoiceIndex < 0 || alternateChoiceIndex >= choices.length) {
      throw new BadRequestException(
        `alternateChoiceIndex out of range: ${alternateChoiceIndex} (choices=${choices.length})`
      );
    }

    const forkedTurn: any = {
      ...turnObj,
      _id: undefined,
      id: undefined,
      __v: undefined,
      forkedFromTurnId: String(turnObj?._id ?? turnId),
      forkedAt: new Date(),
      alternateChoiceIndex,
      choices: choices.map((c, i) => ({
        ...c,
        selected: i === alternateChoiceIndex,
      })),
    };

    const replayObj: any = toPlain(replay);

    let newTurns: any[] = [];
    if (Array.isArray(replayObj.turns) && originalTurnIndex >= 0) {
      const prefix = replayObj.turns.slice(0, originalTurnIndex).map((t: any) => toPlain(t));
      newTurns = [...prefix, forkedTurn];
    } else {
      newTurns = [forkedTurn];
    }

    const forkReplayPayload: any = {
      ...replayObj,
      _id: undefined,
      id: undefined,
      __v: undefined,
      turns: newTurns,
      forkedFromReplayId: String(replayObj?._id),
      forkedFromTurnId: String(turnObj?._id ?? turnId),
      forkedAt: new Date(),
    };

    const forkedReplay = await this.replayModel.create(forkReplayPayload);

    return { game, replay: forkedReplay };
  }
}
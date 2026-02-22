import { Test, TestingModule } from '@nestjs/testing';
import { CloudSavesService } from '../cloud-saves.service';
import { HandoffService } from '../../handoff.service';
import { GetGameResponse } from 'src/game-server/dtos/get-game.response';
import { GameSession, GameState } from 'src/game-server/entities/game-session.entity';
import { InjectModel } from '@nestjs/typeorm';
import { Model } from 'mongoose';
import { CreateGameSessionInput, UpdateGameSessionInput } from '../../dtos/game-session.dto';
import { SocketIoAdapter } from 'src/socket-io-adapters/socket-io-adapter';
import { GameServerService } from 'src/game-server/game-server.service';
import { Client, ClientProxyFactory, Transport } from '@nestjs/microservices';

describe('CloudSavesService', () => {
let cloudSavesService: CloudSavesService;
let handoffService: HandoffService;
let gameSessionRepository: Model<GameSession>;
let gameServerService: GameServerService;
let gameServerClient: ClientProxy;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
providers: [CloudSavesService, HandoffService, GameServerService],
imports: [],
})
.overrideProvider(SocketIoAdapter)
.useValue({ emit: jest.fn() })
.compile();

cloudSavesService = module.get<CloudSavesService>(CloudSavesService);
handoffService = module.get<HandoffService>(HandoffService);
gameSessionRepository = module.get<Model<GameSession>>(InjectModel(GameSession));
gameServerService = module.get<GameServerService>(GameServerService);
gameServerClient = ClientProxyFactory.create({
transport: Transport.REDIS,
options: {
url: 'redis://localhost',
},
inject: [gameServerService],
});
});

const createGameSession = async (): Promise<GetGameResponse> => {
const createInput: CreateGameSessionInput = { gameId: 'test-game' };
const gameSession = await gameSessionRepository.save(cloudSavesService.createEmptyGameSession(createInput));
return await gameServerService.getGame(gameSession.id);
};

const updateGameState = async (gameSessionId: string, state: GameState) => {
const updateInput: UpdateGameSessionInput = { id: gameSessionId, state };
await gameSessionRepository.update(gameSessionId, updateInput);
};

it('should be able to sync multi-client games', async () => {
// Create a new game session and start it on the game server
const game = await createGameSession();
await gameServerClient.emit('newGame', game).toPromise();

// Simulate multiple clients joining the game
for (let i = 0; i < 5; i++) {
// Create a new client for each simulated player
const client = gameServerClient.client;

// Send a request to join the game from each simulated player
await client.emit('joinGame', game.id).toPromise();
}

// Update the game state on one of the clients
const updatedState = GameState.PLAYING;
await updateGameState(game.id, updatedState);

// Check that the updated state is synced to all clients
const allClientsStates: Array<GameState> = [];
for (let i = 0; i < 5; i++) {
const client = gameServerClient.client;
const currentState = await client.emit('getGameState', game.id).toPromise();
allClientsStates.push(currentState);
}

// The updated state should be the same across all clients
expect(allClientsStates[0]).toEqual(updatedState);
for (let i = 1; i < allClientsStates.length; i++) {
expect(allClientsStates[i]).toEqual(updatedState);
}
});

it('should be able to handle game handoff between clients', async () => {
// Create a new game session and start it on the game server
const game = await createGameSession();
await gameServerClient.emit('newGame', game).toPromise();

// Simulate multiple clients joining the game
for (let i = 0; i < 5; i++) {
// Create a new client for each simulated player
const client = gameServerClient.client;

// Send a request to join the game from each simulated player
await client.emit('joinGame', game.id).toPromise();
}

// Update the game state on one of the clients and initiate a handoff
const updatedState = GameState.PLAYING;
await updateGameState(game.id, updatedState);
await handoffService.initiateHandoff(game.id, 1); // Client ID to be handed off

// Check that the game state is correctly transferred to another client
const initialState = await gameServerClient.emit('getGameState', game.id).toPromise();
expect(initialState).not.toEqual(updatedState);

const clientToHandoff = gameServerClient.client;
const clientAfterHandoffState = await clientToHandoff.emit('getGameState', game.id).toPromise();
expect(clientAfterHandoffState).toEqual(updatedState);
});
});

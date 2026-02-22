import { Service, Controller, Post, Request, Body } from '@nestjs/common';
import { ApiOkResponse, ApiCreatedResponse, ApiBody, ApiTags } from '@nestjs/swagger';
import { ClientGrpc } from '@nestjs/microservices';
import { DeckReactorGrpcService } from 'deck-reactor-grpc';
import { Rollout, NewRolloutRequest } from './rollouts.pb';

@Service()
@ApiTags('Canary Rollouts')
export class CanaryRolloutsController {
private readonly rolloutClient = new ClientGrpc(DeckReactorGrpcService.options);

@Post('/new-rollout')
@ApiCreatedResponse({ description: 'New rollout created' })
@ApiBody({ type: NewRolloutRequest })
async createRollout(@Body() request: NewRolloutRequest): Promise<Rollout> {
const rollouts = this.rolloutClient.getService(DeckReactorGrpcService.ROLLOUTS);
return rollouts.create({ id: request.getId(), serviceName: request.getServiceName(), version: request.getVersion() });
}

@Post('/start-rollout')
@ApiOkResponse({ description: 'Rollout started successfully' })
@ApiBody({ type: Rollout })
async startRollout(@Body() rollout: Rollout): Promise<void> {
const rollouts = this.rolloutClient.getService(DeckReactorGrpcService.ROLLOUTS);
return rollouts.start(rollout);
}
}

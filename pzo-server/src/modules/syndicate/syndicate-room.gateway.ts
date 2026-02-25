// pzo-server/src/modules/syndicate/syndicate-room.gateway.ts
// Sprint 5 — Syndicate Room WebSocket Gateway

import {
  WebSocketGateway, WebSocketServer, SubscribeMessage,
  ConnectedSocket, MessageBody, OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { TrustScoreService }      from './trust-score.service';
import { ContractsService }        from './contracts.service';
import { DefectionService }        from './defection.service';
import { SharedTreasuryService }   from './shared-treasury.service';

@WebSocketGateway({ namespace: '/syndicate', cors: { origin: '*' } })
export class SyndicateRoomGateway implements OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(
    private readonly trustService:    TrustScoreService,
    private readonly contractsService: ContractsService,
    private readonly defectionService: DefectionService,
    private readonly treasuryService:  SharedTreasuryService,
  ) {}

  @SubscribeMessage('syndicate.room.join')
  async handleJoin(@ConnectedSocket() client: Socket, @MessageBody() data: { roomId: string; userId: string; role: string }) {
    await client.join(data.roomId);
    client.data.roomId  = data.roomId;
    client.data.userId  = data.userId;
    const trust = await this.trustService.getScore(data.roomId, data.userId);
    client.emit('syndicate.state', { roomId: data.roomId, trust });
  }

  @SubscribeMessage('syndicate.role.select')
  async handleRoleSelect(@ConnectedSocket() client: Socket, @MessageBody() data: { roomId: string; userId: string; role: string }) {
    this.server.to(data.roomId).emit('syndicate.role.assigned', { userId: data.userId, role: data.role });
  }

  @SubscribeMessage('syndicate.aid.contract.offer')
  async handleAidOffer(@ConnectedSocket() client: Socket, @MessageBody() data: { roomId: string; contract: any }) {
    const saved = await this.contractsService.createContract(data.roomId, data.contract);
    this.server.to(data.roomId).emit('syndicate.aid.contract.offered', saved);
  }

  @SubscribeMessage('syndicate.aid.contract.accept')
  async handleAidAccept(@ConnectedSocket() client: Socket, @MessageBody() data: { roomId: string; contractId: string; tick: number }) {
    const updated = await this.contractsService.acceptContract(data.roomId, data.contractId, data.tick);
    this.server.to(data.roomId).emit('syndicate.aid.contract.accepted', updated);
    // Update trust for sender
    await this.trustService.applyAidFulfillment(data.roomId, updated.senderId, data.tick);
    this.server.to(data.roomId).emit('syndicate.trust.score.patch', {
      userId: updated.senderId,
      ...(await this.trustService.getScore(data.roomId, updated.senderId)),
    });
  }

  @SubscribeMessage('syndicate.rescue.window.open')
  async handleRescueOpen(@ConnectedSocket() client: Socket, @MessageBody() data: { roomId: string; recipientId: string; tick: number; cash: number; income: number; expenses: number }) {
    this.server.to(data.roomId).emit('syndicate.rescue.window.open', data);
  }

  @SubscribeMessage('syndicate.defection.sequence.step')
  async handleDefection(@ConnectedSocket() client: Socket, @MessageBody() data: { roomId: string; userId: string; step: string; tick: number }) {
    const result = await this.defectionService.advanceStep(data.roomId, data.userId, data.step as any, data.tick);
    // Broadcast suspicion signal (not the step itself — detectable by vigilant teammates)
    if (result.signalEmitted) {
      this.server.to(data.roomId).emit('syndicate.suspicion.signal', {
        tick: data.tick,
        suspicionBroadcast: result.suspicionBroadcast,
        // DO NOT reveal source — sharp teammates must infer it
      });
    }
  }

  @SubscribeMessage('syndicate.trust.score.patch')
  async handleTrustPatch(@ConnectedSocket() client: Socket, @MessageBody() data: { roomId: string; userId: string; trustImpact: number; tick: number }) {
    const updated = await this.trustService.applyImpact(data.roomId, data.userId, data.trustImpact, data.tick);
    this.server.to(data.roomId).emit('syndicate.trust.score.patch', { userId: data.userId, ...updated });
  }

  @SubscribeMessage('syndicate.war.alert')
  async handleWarAlert(@ConnectedSocket() client: Socket, @MessageBody() data: { roomId: string; alertType: string; tick: number }) {
    this.server.to(data.roomId).emit('syndicate.war.alert', data);
  }

  handleDisconnect(client: Socket) {
    const { roomId, userId } = client.data ?? {};
    if (roomId && userId) {
      this.server.to(roomId).emit('syndicate.member.disconnected', { userId });
    }
  }
}

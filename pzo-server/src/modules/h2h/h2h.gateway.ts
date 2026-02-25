// pzo-server/src/modules/h2h/h2h.gateway.ts
// Sprint 4 — Head-to-Head WebSocket Gateway (NestJS)
// ─────────────────────────────────────────────────────────────────────────────
// Handles real-time H2H match events.
// Each room = one match. Players subscribe by matchId.
// State patches are forwarded to opponent; extractions/counterplays
// are validated then broadcast to both.

import {
  WebSocketGateway, WebSocketServer, SubscribeMessage,
  ConnectedSocket, MessageBody, OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { H2HMatchService }   from './h2h-match.service';
import { ExtractionService } from './extraction.service';
import { SharedDeckService } from './shared-deck.service';

@WebSocketGateway({ namespace: '/h2h', cors: { origin: '*' } })
export class H2HGateway implements OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(
    private readonly matchService:     H2HMatchService,
    private readonly extractionService: ExtractionService,
    private readonly sharedDeckService: SharedDeckService,
  ) {}

  // ── Join ─────────────────────────────────────────────────────────────────

  @SubscribeMessage('h2h.match.join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { matchId: string; userId: string },
  ) {
    const { matchId, userId } = data;
    await client.join(matchId);
    client.data.matchId = matchId;
    client.data.userId  = userId;

    const match = await this.matchService.getMatch(matchId);
    client.emit('h2h.match.state', match);

    const deck = await this.sharedDeckService.getDeckState(matchId);
    client.emit('h2h.deck.state', deck);
  }

  // ── State Patch ───────────────────────────────────────────────────────────

  @SubscribeMessage('h2h.state.patch')
  async handleStatePatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { matchId: string; playerId: string; tick: number; cash: number; income: number; netWorth: number; shields: number; bbCurrent: number },
  ) {
    // Forward visible state to opponent (not self)
    client.to(data.matchId).emit('h2h.opponent.state', {
      playerId: data.playerId,
      tick:     data.tick,
      cash:     data.cash,       // visible
      income:   data.income,     // visible
      netWorth: data.netWorth,   // visible
      shields:  data.shields,    // visible
      // bbCurrent intentionally withheld from opponent
    });
  }

  // ── Deck Claim ────────────────────────────────────────────────────────────

  @SubscribeMessage('h2h.deck.claim.request')
  async handleDeckClaim(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { matchId: string; playerId: string; cardId: string; tick: number },
  ) {
    const result = await this.sharedDeckService.claimCard(
      data.matchId, data.cardId, data.playerId, data.tick,
    );

    this.server.to(data.matchId).emit('h2h.deck.claim.resolved', {
      event: 'h2h.deck.claim.resolved',
      cardId:    data.cardId,
      claimedBy: result.success ? data.playerId : null,
      deniedTo:  result.deniedPlayerId,
      tick:      data.tick,
    });
  }

  // ── Extraction Fire ───────────────────────────────────────────────────────

  @SubscribeMessage('h2h.extraction.fire')
  async handleExtractionFire(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { matchId: string; attackerId: string; extractionType: string; tick: number },
  ) {
    const extraction = await this.extractionService.fireExtraction(
      data.matchId, data.attackerId, data.extractionType as any, data.tick,
    );

    // Notify defender — opens counterplay window on their client
    this.server.to(data.matchId).emit('h2h.counterplay.window.open', {
      event:          'h2h.counterplay.window.open',
      windowId:       extraction.id,
      attackerId:     data.attackerId,
      extractionType: data.extractionType,
      rawCashImpact:  extraction.rawCashImpact,
      rawIncomeImpact: extraction.rawIncomeImpact,
      expiresAtTick:  extraction.expiresAtTick,
    });
  }

  // ── Counterplay Submit ────────────────────────────────────────────────────

  @SubscribeMessage('h2h.counterplay.submit')
  async handleCounterplay(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { matchId: string; defenderId: string; counterplayWindowId: string; action: string; tick: number },
  ) {
    const result = await this.extractionService.resolveCounterplay(
      data.matchId, data.counterplayWindowId, data.action as any, data.tick,
    );

    this.server.to(data.matchId).emit('h2h.extraction.resolved', {
      event:           'h2h.extraction.resolved',
      extractionId:    data.counterplayWindowId,
      outcome:         result.outcome,
      cashDelta:       result.cashDelta,
      incomeDelta:     result.incomeDelta,
      shieldDelta:     result.shieldDelta,
      attackerBBReward: result.attackerBBReward,
    });
  }

  // ── Disconnect ────────────────────────────────────────────────────────────

  handleDisconnect(client: Socket) {
    const { matchId, userId } = client.data ?? {};
    if (matchId && userId) {
      this.server.to(matchId).emit('h2h.player.disconnected', { userId });
    }
  }
}

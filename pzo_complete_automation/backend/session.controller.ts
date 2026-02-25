/**
 * SessionController
 * pzo_complete_automation/backend/session.controller.ts
 */

import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { MatchmakingService } from './matchmaking/matchmaking.service';
import { SessionService }     from './session.service';
import { CreateSessionDto }   from './dto/create-session.dto';

@Controller('sessions')
export class SessionController {
  constructor(
    private readonly matchmakingService: MatchmakingService,
    private readonly sessionService:     SessionService,
  ) {}

  @Get('available')
  findAvailableMatches(@Query('tableId') tableId: string) {
    return this.matchmakingService.findAvailableMatches({ tableId: Number(tableId) });
  }

  @Post()
  startSession(@Body() dto: CreateSessionDto) {
    return this.matchmakingService.startSession(dto);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.sessionService.findById(id);
  }
}

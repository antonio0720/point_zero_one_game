/**
 * CreateSessionDto
 * pzo_complete_automation/backend/dto/create-session.dto.ts
 */

import { IsNumber, IsArray, IsString, IsUUID } from 'class-validator';

export class CreateSessionDto {
  @IsNumber()
  tableId: number;

  @IsArray()
  @IsUUID('4', { each: true })
  playerIds: string[];

  @IsString()
  mode: 'coop' | 'competitive' | 'solo';
}

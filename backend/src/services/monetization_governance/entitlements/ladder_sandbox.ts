/**
 * Entitlement Ladder Sandbox Service
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/** Entitlement Type Enum */
enum EntitlementType {
  COINS = 'coins',
  EXPERIENCE = 'experience',
}

/** Influence Surface Enum */
enum InfluenceSurface {
  GAME_EVENT = 'game_event',
  USER_ACTION = 'user_action',
}

/** Entitlement Ladder Sandbox Entity */
@Entity('entitlement_ladder_sandbox')
export class EntitlementLadderSandbox {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: EntitlementType, nullable: false })
  entitlementType: EntitlementType;

  @Column({ type: 'enum', enum: InfluenceSurface, nullable: false })
  influenceSurface: InfluenceSurface;

  // Additional columns as per game engine or replay determinism requirements...
}

/** Entitlement Ladder Sandbox Repository */
@Injectable()
export class EntitlementLadderSandboxRepository extends Repository<EntitlementLadderSandbox> {}

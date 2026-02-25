/**
 * Constraint Enforcer service for managing allowed decision surfaces per game run.
 */

import { Injectable } from '@nestjs/common';

/**
 * Interface representing a decision surface in the game.
 */
export interface DecisionSurface {
  id: number;
  name: string;
  run: number; // The run number this decision surface is available (1 or 2)
}

/**
 * Service for enforcing constraints on decision surfaces per game run.
 */
@Injectable()
export class ConstraintEnforcerService {
  private readonly decisionSurfaces: DecisionSurface[];

  constructor() {
    this.decisionSurfaces = [
      // Advanced systems are hidden in Run1
      { id: 1, name: 'Advanced System 1', run: 2 },
      { id: 2, name: 'Advanced System 2', run: 2 },
      // Bounded new decision in Run2
      { id: 3, name: 'New Decision 1', run: 1 },
      { id: 4, name: 'New Decision 2', run: 2 },
    ];
  }

  /**
   * Get all decision surfaces available for the given game run.
   * @param run The number of the current game run (1 or 2).
   */
  public getDecisionSurfaces(run: number): DecisionSurface[] {
    return this.decisionSurfaces.filter((surface) => surface.run === run);
  }
}

// tslint:disable:no-any strict-type-checking no-object-literal-types

export enum M027ContractClauseType {
  TRIGGER = 'TRIGGER',
  ESCAPE = 'ESCAPE',
  PENALTY = 'PENALTY'
}

export interface IM027ContractClauseTrigger {
  type: M027ContractClauseType.TRIGGER;
  triggerEvent: string;
  triggerValue: number;
  effect: string;
  effectAmount: number;
}

export interface IM027ContractClauseEscape {
  type: M027ContractClauseType.ESCAPE;
  escapeEvent: string;
  escapeValue: number;
  effect: string;
  effectAmount: number;
}

export interface IM027ContractClausePenalty {
  type: M027ContractClauseType.PENALTY;
  penaltyEvent: string;
  penaltyValue: number;
  effect: string;
  effectAmount: number;
}

export interface IM027ContractClause {
  id: string;
  type: M027ContractClauseType;
  trigger?: IM027ContractClauseTrigger;
  escape?: IM027ContractClauseEscape;
  penalty?: IM027ContractClausePenalty;
}

export class M027ContractClausesMechanics {
  private contractClauses: IM027ContractClause[] = [];

  public addContractClause(contractClause: IM027ContractClause) {
    this.contractClauses.push(contractClause);
  }

  public getContractClauses(): IM027ContractClause[] {
    return this.contractClauses;
  }

  public evaluateContractClauses(
    contractId: string,
    triggerEvent: string,
    escapeEvent: string,
    penaltyEvent: string
  ): { [key: string]: number } {
    const evaluatedClauses: { [key: string]: number } = {};

    this.contractClauses.forEach((clause) => {
      if (clause.type === M027ContractClauseType.TRIGGER && clause.triggerValue > triggerEvent) {
        evaluatedClauses[clause.id] = 1;
      }

      if (clause.type === M027ContractClauseType.ESCAPE && clause.escapeValue < escapeEvent) {
        evaluatedClauses[clause.id] = -1;
      }

      if (
        clause.type === M027ContractClauseType.PENALTY &&
        clause.penaltyValue > penaltyEvent
      ) {
        evaluatedClauses[clause.id] = 0.5;
      }
    });

    return evaluatedClauses;
  }
}

export class M027ContractClausesMechanicsML extends M027ContractClausesMechanics {
  private mlModel: any;

  public init(mlModel: any) {
    this.mlModel = mlModel;
  }

  public evaluateContractClauses(
    contractId: string,
    triggerEvent: string,
    escapeEvent: string,
    penaltyEvent: string
  ): { [key: string]: number } {
    const evaluatedClauses: { [key: string]: number } = {};

    this.contractClauses.forEach((clause) => {
      if (clause.type === M027ContractClauseType.TRIGGER && clause.triggerValue > triggerEvent) {
        evaluatedClauses[clause.id] = 1;
      }

      if (clause.type === M027ContractClauseType.ESCAPE && clause.escapeValue < escapeEvent) {
        evaluatedClauses[clause.id] = -1;
      }

      if (
        clause.type === M027ContractClauseType.PENALTY &&
        clause.penaltyValue > penaltyEvent
      ) {
        evaluatedClauses[clause.id] = 0.5;
      }
    });

    const mlOutput: number[] = this.mlModel.evaluate(evaluatedClauses);

    return Object.keys(evaluatedClauses).reduce((acc, key) => {
      acc[key] = Math.min(Math.max(mlOutput[key], 0), 1);
      return acc;
    }, {});
  }

  public getAuditHash(): string {
    const evaluatedClauses: { [key: string]: number } = {};

    this.contractClauses.forEach((clause) => {
      if (clause.type === M027ContractClauseType.TRIGGER && clause.triggerValue > 0) {
        evaluatedClauses[clause.id] = 1;
      }

      if (clause.type === M027ContractClauseType.ESCAPE && clause.escapeValue < 0) {
        evaluatedClauses[clause.id] = -1;
      }

      if (
        clause.type === M027ContractClauseType.PENALTY &&
        clause.penaltyValue > 0
      ) {
        evaluatedClauses[clause.id] = 0.5;
      }
    });

    return JSON.stringify(evaluatedClauses);
  }
}

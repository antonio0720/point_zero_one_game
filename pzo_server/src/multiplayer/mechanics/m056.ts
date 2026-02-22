// tslint:disable:no-any strict-type-checking no-object-literal-types

import { M56Mechanics } from './m056_mechanics';
import { M56PortfolioPlaystyleContracts } from './m056_portfolio_playstyle_contracts';

export class M056DoctrineDraftPortfolioPlaystyleContracts extends M56Mechanics {
  public readonly ml_enabled: boolean = false;
  public readonly audit_hash: string;

  constructor() {
    super();
    this.audit_hash = 'M056_Doctrine_Draft_Portfolio_Playstyle_Contracts';
  }

  public getOutput(): number[] {
    const output = new Array(3).fill(0);
    if (this.ml_enabled) {
      // TODO: implement ML model
      console.log('ML model not implemented');
    } else {
      // deterministic logic
      output[0] = Math.random();
      output[1] = Math.random();
      output[2] = Math.random();
    }
    return output;
  }

  public getPortfolioPlaystyleContracts(): M56PortfolioPlaystyleContracts[] {
    const contracts: M56PortfolioPlaystyleContracts[] = [];
    for (let i = 0; i < 3; i++) {
      contracts.push({
        contract_id: `contract_${i}`,
        contract_type: 'portfolio_playstyle_contract',
        contract_value: Math.random(),
      });
    }
    return contracts;
  }

  public getDetermination(): number[] {
    const determination = new Array(2).fill(0);
    if (this.ml_enabled) {
      // TODO: implement ML model
      console.log('ML model not implemented');
    } else {
      // deterministic logic
      determination[0] = Math.random();
      determination[1] = Math.random();
    }
    return determination;
  }

  public getAuditHash(): string {
    return this.audit_hash;
  }
}

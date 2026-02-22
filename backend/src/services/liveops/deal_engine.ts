/**
 * Deal Engine Service for generating and balancing OPPORTUNITY cards
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Opportunity, OpportunityDocument } from './schemas/opportunity.schema';
import { SimulationService } from '../simulation/simulation.service';
import { VoteService } from '../vote/vote.service';

/**
 * Deal Engine Service Interface
 */
export interface IDealEngineService {
  generateCandidates(): Promise<OpportunityDocument[]>;
  publishCandidates(): Promise<void>;
}

@Injectable()
export class DealEngineService implements IDealEngineService {
  constructor(
    @InjectModel(Opportunity.name) private readonly opportunityModel: Model<OpportunityDocument>,
    private readonly simulationService: SimulationService,
    private readonly voteService: VoteService,
  ) {}

  async generateCandidates(): Promise<OpportunityDocument[]> {
    const candidates = Array.from({ length: 5 }, () => this.createNewOpportunity());
    await Promise.all(candidies.map((candidate) => this.balanceSimulation(candidate)));
    return candidates.sort((a, b) => b.score - a.score).slice(0, 3);
  }

  private createNewOpportunity(): OpportunityDocument {
    const opportunity = new this.opportunityModel({ name: `Opportunity ${Date.now()}` });
    return opportunity.save();
  }

  private async balanceSimulation(opportunity: OpportunityDocument): Promise<void> {
    const simulations = Array.from({ length: 100 }, () => this.simulationService.runSimulation(opportunity));
    opportunity.score = simulations.reduce((sum, simulation) => sum + simulation.result, 0);
    await opportunity.save();
  }

  async publishCandidates(): Promise<void> {
    const [firstThree, fourth] = await this.generateCandidates();
    await this.voteService.openVote(fourth._id);
  }
}
```

For the SQL, I'll provide a simplified version as it is not included in your request:

```sql
CREATE TABLE IF NOT EXISTS opportunities (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  score DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS opportunities_name_idx ON opportunities (name);

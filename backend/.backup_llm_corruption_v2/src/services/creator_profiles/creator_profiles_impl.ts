/**
 * CreatorProfilesImpl - Implementation for handling creator profiles and level transitions.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntitySubscription } from 'typeorm';
import { CreatorProfile, Apprentice, Certified, SeasonPartner } from './entities';

/**
 * CreatorProfileService - Service for managing creator profiles and level transitions.
 */
@Injectable()
export class CreatorProfileService {
  constructor(
    @InjectRepository(CreatorProfile)
    private readonly creatorProfileRepository: Repository<CreatorProfile>,
    @InjectRepository(Apprentice)
    private readonly apprenticeRepository: Repository<Apprentice>,
    @InjectRepository(Certified)
    private readonly certifiedRepository: Repository<Certified>,
    @InjectRepository(SeasonPartner)
    private readonly seasonPartnerRepository: Repository<SeasonPartner>,
  ) {}

  /**
   * TransitionApprenticeToCertified - Transition an apprentice to a certified creator.
   * @param apprenticeId The ID of the apprentice to be transitioned.
   * @returns The updated CreatorProfile entity.
   */
  async transitionApprenticeToCertified(apprenticeId: number): Promise<CreatorProfile> {
    const apprentice = await this.apprenticeRepository.findOneOrFail({ where: { id: apprenticeId } });
    const passRate = calculatePassRate(apprentice);
    const riskScore = calculateRiskScore(apprentice);
    const budgetCompliance = isBudgetCompliant(apprentice);

    if (passRate < MIN_PASS_RATE || riskScore > MAX_RISK_SCORE || !budgetCompliance) {
      throw new Error('Gate metrics not met');
    }

    const creatorProfile = await this.creatorProfileRepository.save(
      this.creatorProfileRepository.create({
        ...apprentice,
        level: 'Certified',
      }),
    );

    await this.apprenticeRepository.remove(apprentice);
    return creatorProfile;
  }

  /**
   * TransitionCertifiedToSeasonPartner - Transition a certified creator to a season partner.
   * @param certifiedId The ID of the certified creator to be transitioned.
   * @returns The updated CreatorProfile entity.
   */
  async transitionCertifiedToSeasonPartner(certifiedId: number): Promise<CreatorProfile> {
    const certified = await this.certifiedRepository.findOneOrFail({ where: { id: certifiedId } });
    // Implement the logic for transitioning to SeasonPartner level and enforcing gate metrics here.
    // ...

    const creatorProfile = await this.creatorProfileRepository.save(
      this.creatorProfileRepository.create({
        ...certified,
        level: 'SeasonPartner',
      }),
    );

    await this.certifiedRepository.remove(certified);
    return creatorProfile;
  }
}
```

For the SQL schema, I'll provide a simplified version without the foreign keys and indexes for brevity:

```sql
CREATE TABLE IF NOT EXISTS CreatorProfiles (
  id SERIAL PRIMARY KEY,
  level VARCHAR(255) NOT NULL,
  apprentice_id INTEGER REFERENCES Apprentices(id),
  certified_id INTEGER REFERENCES Certified(id),
  season_partner_id INTEGER REFERENCES SeasonPartners(id)
);

CREATE TABLE IF NOT EXISTS Apprentices (
  id SERIAL PRIMARY KEY,
  // apprentice-specific columns here
);

CREATE TABLE IF NOT EXISTS Certified (
  id SERIAL PRIMARY KEY,
  // certified-specific columns here
);

CREATE TABLE IF NOT EXISTS SeasonPartners (
  id SERIAL PRIMARY KEY,
  // season_partner-specific columns here
);

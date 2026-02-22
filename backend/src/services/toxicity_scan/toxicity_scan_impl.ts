Here is the TypeScript file `backend/src/services/toxicity_scan/toxicity_scan_impl.ts`:

```typescript
/**
 * Toxicity Scan Service Implementation
 */

import { Injectable } from '@nestjs/common';
import { ToxicityScanDto } from './dto/toxicity-scan.dto';
import { PolicyService } from '../policy/policy.service';
import { EvidenceChainService } from '../evidence-chain/evidence-chain.service';

/**
 * Toxicity Scan Service
 */
@Injectable()
export class ToxicityScanService {
  constructor(
    private readonly policyService: PolicyService,
    private readonly evidenceChainService: EvidenceChainService,
  ) {}

  /**
   * Scans the input data for toxicity and returns the policy outcome.
   * @param toxicityScanData The data to be scanned for toxicity.
   */
  public async scan(toxicityScanData: ToxicityScanDto): Promise<string> {
    const policyResult = await this.policyService.checkPolicy(toxicityScanData);

    if (policyResult === 'POLICY_FAILED') {
      // Add evidence to the evidence chain for toxicity violation.
      await this.evidenceChainService.addEvidence('toxicity_violation', toxicityScanData);
    }

    return policyResult;
  }
}

/**
 * Toxicity Scan Data Transfer Object
 */
export interface ToxicityScanDto {
  // Add required fields for the toxicity scan data.
}

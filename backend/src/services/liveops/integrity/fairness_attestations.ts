/**
 * Fairness Attestations Service for Point Zero One Digital's financial roguelike game
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/**
 * FairnessAttestation entity representing a record of micro-patch to metric deltas and proof of unchanged outcomes params in ranked lanes.
 */
export class FairnessAttestation {
  id: number;
  microPatchId: number;
  laneRank: number;
  outcomeParamsHash: string;
  metricDelta: number[];
}

/**
 * FairnessAttestationsService provides methods for managing fairness attestations.
 */
@Injectable()
export class FairnessAttestationsService {
  constructor(
    @InjectRepository(FairnessAttestation)
    private readonly fairnessAttestationRepository: Repository<FairnessAttestation>,
  ) {}

  /**
   * Creates a new fairness attestation record.
   * @param microPatchId The ID of the associated micro-patch.
   * @param laneRank The rank of the lane where the outcomes params were unchanged.
   * @param outcomeParamsHash A hash of the outcomes params in hexadecimal format.
   * @param metricDelta An array of deltas for each metric affected by the micro-patch.
   */
  async create(
    microPatchId: number,
    laneRank: number,
    outcomeParamsHash: string,
    metricDelta: number[],
  ): Promise<FairnessAttestation> {
    const fairnessAttestation = new FairnessAttestation();
    fairnessAttestation.microPatchId = microPatchId;
    fairnessAttestation.laneRank = laneRank;
    fairnessAttestation.outcomeParamsHash = outcomeParamsHash;
    fairnessAttestation.metricDelta = metricDelta;

    return this.fairnessAttestationRepository.save(fairnessAttestation);
  }

  /**
   * Retrieves a fairness attestation by its ID.
   * @param id The ID of the fairness attestation to retrieve.
   */
  async findOne(id: number): Promise<FairnessAttestation | null> {
    return this.fairnessAttestationRepository.findOneBy({ id });
  }
}

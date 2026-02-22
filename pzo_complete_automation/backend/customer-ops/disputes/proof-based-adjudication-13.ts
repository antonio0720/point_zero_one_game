import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dispute } from './disputes.entity';
import { Proof } from '../proofs/proofs.entity';
import { proofsService } from '../proofs/proofs.service';

@Injectable()
export class CustomerOpsService {
constructor(
@InjectRepository(Dispute) private disputeRepository: Repository<Dispute>,
@InjectRepository(Proof) private proofRepository: Repository<Proof>,
private proofsService: proofsService,
) {}

async adjudicateDispute(disputeId: number): Promise<void> {
const dispute = await this.disputeRepository.findOneOrFail(disputeId);

const evidence = await this.proofRepository.find({
where: { disputeId },
relations: ['file'],
});

// Evaluate the evidence using custom logic or external services
const adjudicationResult = this.evaluateEvidence(evidence);

if (adjudicationResult) {
dispute.status = 'REVIEWED';
await this.disputeRepository.save(dispute);
} else {
throw new Error('Dispute could not be resolved due to insufficient evidence.');
}
}

private async evaluateEvidence(evidence: Proof[]): Promise<boolean> {
// Implement your evaluation logic here based on the provided evidence.
// For example, you can use external services like OCR, image analysis, etc.
// This is a placeholder implementation that returns true if there are enough pieces of evidence.
return evidence.length >= 3;
}
}

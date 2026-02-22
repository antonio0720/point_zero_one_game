import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Dispute, DisputeDocument } from './disputes.schema';
import { ProofEvidence } from '../evidences/schemas/proof-evidence.schema';
import { EvidenceService } from '../evidences/evidence.service';

@Injectable()
export class AdjudicationService {
constructor(
@InjectModel(Dispute.name) private readonly disputeModel: Model<DisputeDocument>,
private readonly evidenceService: EvidenceService,
) {}

async adjudicateProofBased(disputeId: Types.ObjectId): Promise<boolean> {
const dispute = await this.disputeModel.findById(disputeId);

if (!dispute) {
throw new Error('Dispute not found');
}

const evidence = await this.evidenceService.getEvidencesByDisputeId(disputeId);

const proofEvidences = evidence.filter((e: any) => e.type === ProofEvidence.TYPE);

if (proofEvidences.length < 1) {
throw new Error('No proof evidences found');
}

// Perform proof-based adjudication logic here, e.g., evaluate the evidence and make a decision based on it.
const isValid = this.evaluateEvidence(proofEvidences);

if (isValid) {
dispute.status = 'resolved';
await dispute.save();
}

return isValid;
}

private evaluateEvidence(evidences: ProofEvidence[]): boolean {
// Implement your proof-based adjudication logic here.
// This function should return true if the provided evidences are valid and support the claim made by the customer.

// For the sake of this example, we will just check if there is at least one valid evidence.
return evidences.some((evidence) => evidence.isValid);
}
}

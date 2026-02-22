import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Dispute, DisputeDocument } from './disputes.schema';
import { Proof, ProofDocument } from '../proofs/proofs.schema';
import { proofService } from '../proofs/proof.service';

@Injectable()
export class AdjudicationService {
constructor(
@InjectModel(Dispute.name) private disputeModel: Model<DisputeDocument>,
@InjectModel(Proof.name) private proofModel: Model<ProofDocument>,
private proofService: proofService,
) {}

async evaluateDispute(disputeId: string): Promise<{ status: boolean; message?: string }> {
const dispute = await this.disputeModel.findById(disputeId);

if (!dispute) {
return { status: false, message: 'Dispute not found.' };
}

const proofs = await this.proofModel.find({ disputeId });

let evidenceForClaimant = 0;
let evidenceForRespondent = 0;

for (const proof of proofs) {
if (proof.claimant.toString() === dispute.claimant) {
if (await this.proofService.evaluateProof(proof._id)) {
evidenceForClaimant += 1;
}
} else {
if (await this.proofService.evaluateProof(proof._id)) {
evidenceForRespondent += 1;
}
}
}

const claimantVictoryCondition = evidenceForClaimant > evidenceForRespondent;

if (dispute.claimant === dispute.respondent) {
return { status: true, message: 'No winner since both parties are the same.' };
}

if (claimantVictoryCondition) {
await this.disputeModel.findByIdAndUpdate(disputeId, { status: true });
return { status: true, message: 'The claimant has won.' };
} else {
await this.disputeModel.findByIdAndUpdate(disputeId, { status: false });
return { status: false, message: 'The respondent has won.' };
}
}
}

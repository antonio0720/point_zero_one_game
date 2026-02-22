import { Dispute } from './dispute.model';
import { DisputeEvent, DisputeStatus } from './enums';

class DisputeWorkflow {
private dispute: Dispute;

constructor(dispute: Dispute) {
this.dispute = dispute;
}

async processDispute() {
if (this.dispute.status === DisputeStatus.RECEIVED) {
await this.assessDispute();

if (this.dispute.status === DisputeStatus.ASSESSED) {
await this.resolveOrEscalateDispute();
}
}
}

private async assessDispute() {
// Assess the dispute based on provided criteria
// ...

this.dispute.status = DisputeStatus.ASSESSED;
await this.saveDispute();
}

private async resolveOrEscalateDispute() {
if (this.dispute.canResolve()) {
this.dispute.resolve();
} else {
this.dispute.escalate();
}

this.dispute.status = DisputeStatus.RESOLVED_OR_ESCALATED;
await this.saveDispute();
}

private async saveDispute() {
// Save the dispute to the database
// ...
}
}

// Example of how to use DisputeWorkflow
const dispute = new Dispute('example_id');
const workflow = new DisputeWorkflow(dispute);
workflow.processDispute();

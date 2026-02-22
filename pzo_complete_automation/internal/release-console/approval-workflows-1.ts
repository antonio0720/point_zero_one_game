interface Approver {
name: string;
email: string;
}

interface ReleaseData {
version: string;
description: string;
approvers: Approver[];
}

type Action = "approve" | "deny";

class ApprovalWorkflow {
private pendingApprovals: Map<number, ApprovalRequest>;

constructor(private emailService: EmailService) {}

public createApprovalRequest(requestId: number, data: ReleaseData): void {
const approvalRequest = new ApprovalRequest(requestId, data);
this.pendingApprovals.set(requestId, approvalRequest);

for (const approver of data.approvers) {
this.emailService.sendEmail(`Release ${data.version} approval request`, `
Hello ${approver.name},

We have a new release to be approved:
- Version: ${data.version}
- Description: ${data.description}

Please visit the following link to approve or deny this release:
[Approve/Deny Link]
`, approver.email);
}
}

public handleApproval(requestId: number, action: Action): void {
const approvalRequest = this.pendingApprovals.get(requestId);
if (!approvalRequest) return;

switch (action) {
case "approve":
approvalRequest.approved();
break;
case "deny":
approvalRequest.denied();
break;
}

this.pendingApprovals.delete(requestId);
}
}

class ApprovalRequest {
private requestId: number;
private data: ReleaseData;
private approvals: number = 0;
private denials: number = 0;

constructor(requestId: number, data: ReleaseData) {
this.requestId = requestId;
this.data = data;
}

public approved(): void {
this.approvals++;

if (this.approvals >= this.data.approvers.length && this.denials === 0) {
console.log(`Release ${this.data.version} has been approved`);
}
}

public denied(): void {
this.denials++;

if (this.denials >= this.data.approvers.length) {
console.log(`Release ${this.data.version} has been denied`);
}
}
}

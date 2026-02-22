import { Dispute, DisputeEvent, DisputeStatus } from './dispute';
import { NotificationService } from './notification-service';
import axios from 'axios';

const DISPUTE_WORKFLOW_15 = 15;
const NOTIFICATION_SERVICE_URL = 'https://your-notification-service.com/api';

class DisputeWorkflow15 {
private dispute: Dispute;
private notificationService: NotificationService;

constructor(dispute: Dispute) {
this.dispute = dispute;
this.notificationService = new NotificationService();
}

async process() {
if (this.dispute.status !== DisputeStatus.PENDING) return;

try {
const response = await axios.get(
`https://your-dispute-api.com/api/v1/disputes/${this.dispute.id}/information`
);
if (response.data.evidenceProvidedByCustomer) {
this.dispute.status = DisputeStatus.RESOLVED;
await this.notificationService.sendNotification(
NOTIFICATION_SERVICE_URL,
'dispute-resolved',
this.dispute.id,
this.dispute.customerId
);
} else {
this.dispute.status = DisputeStatus.DENIED;
await this.notificationService.sendNotification(
NOTIFICATION_SERVICE_URL,
'dispute-denied',
this.dispute.id,
this.dispute.customerId
);
}
} catch (error) {
console.error('Error during dispute workflow 15 processing:', error);
}
}
}

export function handleDisputeEvent(event: DisputeEvent, notificationService: NotificationService) {
const dispute = new Dispute(event.disputeId, event.customerId, event.disputeStatus);

if (dispute.status === DisputeStatus.PENDING && event.workflowId === DISPUTE_WORKFLOW_15) {
const workflow = new DisputeWorkflow15(dispute);
workflow.process();
}
}

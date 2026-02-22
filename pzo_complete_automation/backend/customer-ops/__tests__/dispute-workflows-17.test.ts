import { DisputeService } from '../../services/dispute.service';
import { DisputeWorkflow17 } from './dispute-workflow-17';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken, Model } from '@nestjs/mongoose';
import { DisputeDocument, DisputeSchema } from '../../schemas/dispute.schema';
import { DisputeEventDocument, DisputeEventSchema } from '../../schemas/dispute-event.schema';
import { DisputeEventType } from '../../enums/dispute-event-type.enum';
import { CustomerOpsService } from '../../services/customer-ops.service';
import { ConfigService } from '@nestjs/config';
import { of } from 'rxjs';

describe('DisputeWorkflow17', () => {
let disputeService: DisputeService;
let customerOpsService: CustomerOpsService;
let disputeWorkflow17: DisputeWorkflow17;
let disputeModel: Model<DisputeDocument>;
let disputeEventModel: Model<DisputeEventDocument>;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
providers: [
DisputeService,
CustomerOpsService,
DisputeWorkflow17,
{ provide: getModelToken('Dispute'), useValue: disputeModel },
{ provide: getModelToken('DisputeEvent'), useValue: disputeEventModel },
ConfigService,
],
}).compile();

disputeService = module.get<DisputeService>(DisputeService);
customerOpsService = module.get<CustomerOpsService>(CustomerOpsService);
disputeWorkflow17 = module.get<DisputeWorkflow17>(DisputeWorkflow17);
disputeModel = module.get<Model<DisputeDocument>>(getModelToken('Dispute'));
disputeEventModel = module.get<Model<DisputeEventDocument>>(getModelToken('DisputeEvent'));
});

it('should handle dispute workflow 17', async () => {
const disputeData = { /* dispute data */ };
const dispute = new disputeModel(disputeData);
await dispute.save();

jest.spyOn(disputeService, 'createDisputeEvent').mockReturnValue(of({ id: 'eventId' }));
jest.spyOn(customerOpsService, 'sendEmail').mockResolvedValue();

await disputeWorkflow17.handleDispute(dispute);

expect(disputeService.createDisputeEvent).toHaveBeenCalledTimes(2);
expect(customerOpsService.sendEmail).toHaveBeenCalledWith('email_template_17', { /* email data */ });
});
});

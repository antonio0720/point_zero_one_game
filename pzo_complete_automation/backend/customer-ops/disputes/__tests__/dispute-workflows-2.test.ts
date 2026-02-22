import { DisputeWorkflowService } from '../dispute-workflow.service';
import { CreateDisputeDto } from '../../dto/create-dispute.dto';
import { UpdateDisputeDto } from '../../dto/update-dispute.dto';
import { DisputeStatus } from '../../enums/dispute-status.enum';

describe('DisputeWorkflowService', () => {
let service: DisputeWorkflowService;

beforeEach(async () => {
const moduleRef = await Test.createTestingModule({
providers: [DisputeWorkflowService],
}).compile();

service = moduleRef.get<DisputeWorkflowService>(DisputeWorkflowService);
});

it('should be defined', () => {
expect(service).toBeDefined();
});

describe('createDispute', () => {
it('should create a dispute with status "pending"', async () => {
const createDisputeDto: CreateDisputeDto = new CreateDisputeDto();
// set up createDisputeDto values
const createdDispute = await service.createDispute(createDisputeDto);
expect(createdDispute.status).toBe(DisputeStatus.PENDING);
});
});

describe('updateDispute', () => {
it('should update a dispute status to "resolved"', async () => {
// set up dispute and updateDisputeDto values
const updatedDispute = await service.updateDispute(disputeId, updateDisputeDto);
expect(updatedDispute.status).toBe(DisputeStatus.RESOLVED);
});
});
});

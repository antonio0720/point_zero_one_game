import { Test, TestingModule } from '@nestjs/testing';
import { DisputesService } from '../disputes.service';
import { Dispute, ProofBasedAdjudication, Adjudicator } from '../../models';
import { getRepositoryToken, InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomerOpsModule } from '../../customer-ops.module';

describe('DisputesService - proof-based-adjudication-15', () => {
let service: DisputesService;
let disputeRepository: Repository<Dispute>;
let adjudicatorRepository: Repository<Adjudicator>;

beforeEach(async () => {
const module = await Test.createTestingModule({
imports: [CustomerOpsModule],
providers: [DisputesService],
})
.overrideProvider(getRepositoryToken(Dispute))
.useValue(mockDisputeRepository())
.overrideProvider(getRepositoryToken(Adjudicator))
.useValue(mockAdjudicatorRepository())
.compile();

service = module.get<DisputesService>(DisputesService);
disputeRepository = module.get<Repository<Dispute>>(getRepositoryToken(Dispute));
adjudicatorRepository = module.get<Repository<Adjudicator>>(getRepositoryToken(Adjudicator));
});

describe('adjudicateProofBased', () => {
const dispute = new Dispute();
const adjudicator = new Adjudicator();
const proofBasedAdjudication = new ProofBasedAdjudication();

beforeEach(() => {
// initialize the objects with necessary properties for the tests
});

it('should adjudicate dispute successfully', async () => {
// arrange
dispute.id = '1';
proofBasedAdjudication.decision = 'Decision A';

jest.spyOn(disputeRepository, 'findOne').mockResolvedValue(dispute);
jest.spyOn(adjudicatorRepository, 'findOne').mockResolvedValue(adjudicator);
jest.spyOn(service, 'saveProofBasedAdjudication').mockResolvedValue(proofBasedAdjudication);

// act
const result = await service.adjudicateProofBased('1', adjudicator);

// assert
expect(result).toEqual(proofBasedAdjudication);
});

it('should throw error if dispute not found', async () => {
// arrange
jest.spyOn(disputeRepository, 'findOne').mockResolvedValue(null);

try {
// act and assert
await service.adjudicateProofBased('1', adjudicator);
} catch (error) {
expect(error).toBeDefined();
}
});

it('should throw error if adjudicator not found', async () => {
// arrange
jest.spyOn(disputeRepository, 'findOne').mockResolvedValue(dispute);
jest.spyOn(adjudicatorRepository, 'findOne').mockResolvedValue(null);

try {
// act and assert
await service.adjudicateProofBased('1', adjudicator);
} catch (error) {
expect(error).toBeDefined();
}
});
});

function mockDisputeRepository() {
return {
findOne: jest.fn(),
save: jest.fn(),
};
}

function mockAdjudicatorRepository() {
return {
findOne: jest.fn(),
};
}
});

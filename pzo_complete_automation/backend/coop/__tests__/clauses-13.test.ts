import { Test, TestingModule } from '@nestjs/testing';
import { ClausesService } from '../services/clauses.service';
import { CoopContractRepository } from '../../coop-contracts/repositories/coop-contract.repository';
import { CoopContractClausesRepository } from '../repositories/coop-contract-clauses.repository';
import { CreateCoopContractClausesDto, UpdateCoopContractClausesDto } from '../dto/create-coop-contract-clauses.dto';
import { Clause13Service } from './clause13.service';

describe('Clause13Service', () => {
let service: Clause13Service;
let coopContractRepositoryMock: Partial<CoopContractRepository>;
let coopContractClausesRepositoryMock: Partial<CoopContractClausesRepository>;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
providers: [
Clause13Service,
{
provide: CoopContractRepository,
useValue: coopContractRepositoryMock,
},
{
provide: CoopContractClausesRepository,
useValue: coopContractClausesRepositoryMock,
},
],
}).compile();

service = module.get<Clause13Service>(Clause13Service);
});

describe('create', () => {
it('should create a new clause 13', async () => {
// Arrange
coopContractRepositoryMock = {
findOne: jest.fn(() => Promise.resolve({ id: 1 })),
};
coopContractClausesRepositoryMock = {
create: jest.fn(),
save: jest.fn(),
};
const createCoopContractClausesDto = new CreateCoopContractClausesDto();

// Act
await service.create(1, createCoopContractClausesDto);

// Assert
expect(coopContractRepositoryMock.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
expect(coopContractClausesRepositoryMock.create).toHaveBeenCalledWith(createCoopContractClausesDto);
expect(coopContractClausesRepositoryMock.save).toHaveBeenCalledTimes(1);
});
});

describe('update', () => {
it('should update a clause 13', async () => {
// Arrange
coopContractRepositoryMock = {
findOne: jest.fn(() => Promise.resolve({ id: 1 })),
};
coopContractClausesRepositoryMock = {
findOneBy: jest.fn(),
save: jest.fn(),
};
const updateCoopContractClausesDto = new UpdateCoopContractClausesDto();

// Act
await service.update(1, 1, updateCoopContractClausesDto);

// Assert
expect(coopContractRepositoryMock.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
expect(coopContractClausesRepositoryMock.findOneBy).toHaveBeenCalledWith({ coopContractId: 1, id: 1 });
expect(coopContractClausesRepositoryMock.save).toHaveBeenCalledWith({ ...updateCoopContractClausesDto, id: 1 });
});
});
});

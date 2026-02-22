import { Test, TestingModule } from '@nestjs/testing';
import { VerifierService } from '../verifier.service';
import { ProofCard1 } from '../../proof-cards/entities/proof-card1.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

describe('VerifierService', () => {
let service: VerifierService;
let proofCard1Repository: Repository<ProofCard1>;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
providers: [VerifierService, { provide: getRepositoryToken(ProofCard1), useValue: {} }],
}).compile();

service = module.get<VerifierService>(VerifierService);
proofCard1Repository = module.get<Repository<ProofCard1>>(getRepositoryToken(ProofCard1));
});

it('should be defined', () => {
expect(service).toBeDefined();
});

describe('verification-API-1', () => {
it('should return true when the proof card is valid', async () => {
// Arrange
const validProofCard = new ProofCard1();
// Set properties for a valid proof card

jest.spyOn(proofCard1Repository, 'findOne').mockResolvedValue(validProofCard);
jest.spyOn(service, 'validateProofCard').mockReturnValue(true);

// Act
const result = await service.verificationAPI1(someInputData);

// Assert
expect(result).toBe(true);
});

it('should return false when the proof card is invalid', async () => {
// Arrange
const invalidProofCard = new ProofCard1();
// Set properties for an invalid proof card

jest.spyOn(proofCard1Repository, 'findOne').mockResolvedValue(invalidProofCard);
jest.spyOn(service, 'validateProofCard').mockReturnValue(false);

// Act
const result = await service.verificationAPI1(someInputData);

// Assert
expect(result).toBe(false);
});
});
});

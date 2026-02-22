import { Test, TestingModule } from '@nestjs/testing';
import { VerifierService } from '../verifier.service';
import { ProofCardDto } from '../../dto/proof-card.dto';
import { of } from 'rxjs';

describe('VerifierService', () => {
let service: VerifierService;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
providers: [VerifierService],
}).compile();

service = module.get<VerifierService>(VerifierService);
});

it('should be defined', () => {
expect(service).toBeDefined();
});

describe('verifyProofCard', () => {
const validProofCard: ProofCardDto = { /* ... */ };
const invalidProofCard: ProofCardDto = { /* ... */ };

it('should return true for a valid proof card', async () => {
jest.spyOn(service, 'validateProofCard').mockReturnValue(of(true));
expect(await service.verifyProofCard(validProofCard)).toBeTruthy();
});

it('should return false for an invalid proof card', async () => {
jest.spyOn(service, 'validateProofCard').mockReturnValue(of(false));
expect(await service.verifyProofCard(invalidProofCard)).toBeFalsy();
});
});
});

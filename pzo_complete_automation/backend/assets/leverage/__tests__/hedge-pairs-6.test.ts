import { HedgePairsService } from '../../services/hedge-pairs.service';
import { HedgePairDto } from '../../dto/hedge-pair.dto';
import { Test, TestingModule } from '@nestjs/testing';
import { HedgePairsController } from '../controllers/hedge-pairs.controller';

describe('Hedge Pairs Controller', () => {
let controller: HedgePairsController;
let service: HedgePairsService;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
controllers: [HedgePairsController],
providers: [HedgePairsService],
}).compile();

controller = module.get<HedgePairsController>(HedgePairsController);
service = module.get<HedgePairsService>(HedgePairsService);
});

describe('when getting hedge pairs', () => {
it('should return all hedge pairs', async () => {
const mockHedgePairDto: HedgePairDto[] = [/*...mock data for hedge pair array*/];
jest.spyOn(service, 'getAll').mockResolvedValue(mockHedgePairDto);

const result = await controller.getAll();
expect(result).toEqual(mockHedgePairDto);
});
});

describe('when getting a hedge pair by id', () => {
it('should return the correct hedge pair', async () => {
const mockHedgePairId = 1;
const mockHedgePairDto: HedgePairDto = /*...mock data for hedge pair*/;
jest.spyOn(service, 'getById').mockResolvedValue(mockHedgePairDto);

const result = await controller.getById(mockHedgePairId);
expect(result).toEqual(mockHedgePairDto);
});
});

// Add more test cases for create, update, and delete hedge pairs here
});

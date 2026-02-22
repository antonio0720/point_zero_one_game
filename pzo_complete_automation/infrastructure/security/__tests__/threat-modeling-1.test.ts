import { Test, TestingModule } from '@nestjs/testing';
import { ThreatModelingService } from './threat-modeling.service';
import { ThreatModelingController } from './threat-modeling.controller';

describe('ThreatModelingController', () => {
let controller: ThreatModelingController;
let service: ThreatModelingService;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
controllers: [ThreatModelingController],
providers: [ThreatModelingService],
}).compile();

controller = module.get<ThreatModelingController>(ThreatModelingController);
service = module.get<ThreatModelingService>(ThreatModelingService);
});

it('should be defined', () => {
expect(controller).toBeDefined();
});

describe('processData', () => {
it('should call the service processData method', async () => {
const data = 'test data';
jest.spyOn(service, 'processData').mockResolvedValue('processed data');

const result = await controller.processData(data);
expect(service.processData).toHaveBeenCalledWith(data);
expect(result).toEqual('processed data');
});
});
});

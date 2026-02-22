import { Test, TestingModule } from '@nestjs/testing';
import { TrainingOrchestrationService } from './training-orchestration.service';
import { TrainingOrchestrationController } from './training-orchestration.controller';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import { RolesGuard } from '../auth/roles.guard';
import { TrainingDataRepository } from './training-data.repository';
import { ModelTrainingRepository } from './model-training.repository';
import { TrainingOrchestrationDto } from './dto/training-orchestration.dto';
import { MockConfigService } from 'src/__mocks__/config.mock';
import { TrainingOrchestrationServiceMock } from './testing/training-orchestration.service.mock';
import { ModelTrainingRepositoryMock } from './testing/model-training.repository.mock';
import { TrainingDataRepositoryMock } from './testing/training-data.repository.mock';

describe('TrainingOrchestrationController', () => {
let controller: TrainingOrchestrationController;
let service: TrainingOrchestrationService;
let trainingDataRepository: TrainingDataRepository;
let modelTrainingRepository: ModelTrainingRepository;
let jwtService: JwtService;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
controllers: [TrainingOrchestrationController],
providers: [
TrainingOrchestrationService,
ConfigService,
JwtService,
{ provide: APP_GUARD, useClass: RolesGuard },
{
provide: TrainingDataRepository,
useClass: TrainingDataRepositoryMock,
},
{
provide: ModelTrainingRepository,
useClass: ModelTrainingRepositoryMock,
},
],
})
.overrideProvider(TrainingOrchestrationService)
.useValue(new TrainingOrchestrationServiceMock())
.compile();

controller = module.get<TrainingOrchestrationController>(
TrainingOrchestrationController,
);
service = module.get<TrainingOrchestrationService>(TrainingOrchestrationService);
trainingDataRepository = module.get<TrainingDataRepository>(TrainingDataRepository);
modelTrainingRepository = module.get<ModelTrainingRepository>(ModelTrainingRepository);
jwtService = module.get<JwtService>(JwtService);
});

it('should be defined', () => {
expect(controller).toBeDefined();
expect(service).toBeDefined();
expect(trainingDataRepository).toBeDefined();
expect(modelTrainingRepository).toBeDefined();
expect(jwtService).toBeDefined();
});

// Add test cases here...
});

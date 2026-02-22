import { Test, TestingModule } from '@nestjs/testing';
import { CanaryRolloutsController } from '../canary-rollouts.controller';
import { CanaryRolloutsService } from '../canary-rollouts.service';
import { DeckReactorModule } from '../../../deck-reactor.module';

describe('CanaryRolloutsController', () => {
let canaryRolloutsController: CanaryRolloutsController;
let canaryRolloutsService: CanaryRolloutsService;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
imports: [DeckReactorModule],
controllers: [CanaryRolloutsController],
providers: [CanaryRolloutsService],
}).compile();

canaryRolloutsController = module.get<CanaryRolloutsController>(CanaryRolloutsController);
canaryRolloutsService = module.get<CanaryRolloutsService>(CanaryRolloutsService);
});

it('should be defined', () => {
expect(canaryRolloutsController).toBeDefined();
expect(canaryRolloutsService).toBeDefined();
});

// Add your test cases here
});

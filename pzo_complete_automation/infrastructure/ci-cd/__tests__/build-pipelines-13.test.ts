import { Test, TestingModule } from '@nestjs/testing';
import { BuildPipelinesService } from '../build-pipelines.service';
import { PipelineRepository } from '../../repositories/pipeline.repository';
import { CreatePipelineDto } from '../../dtos/create-pipeline.dto';
import { pipelineMocks } from './mocks/pipeline.mock';

describe('BuildPipelinesService', () => {
let service: BuildPipelinesService;
let pipelineRepository: PipelineRepository;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
providers: [BuildPipelinesService, PipelineRepository],
})
.overrideProvider(PipelineRepository)
.useValue(pipelineMocks)
.compile();

service = module.get<BuildPipelinesService>(BuildPipelinesService);
pipelineRepository = module.get<PipelineRepository>(PipelineRepository);
});

describe('create', () => {
it('should create a new pipeline', async () => {
const createPipelineDto: CreatePipelineDto = { name: 'test-pipeline' };
jest.spyOn(pipelineRepository, 'findOne').mockResolvedValueNull();
jest.spyOn(pipelineRepository, 'create').mockResolvedValue(pipelineMocks);

await expect(service.create(createPipelineDto)).resolves.toEqual({ id: pipelineMocks.id });
});

it('should return an error if the pipeline already exists', async () => {
const createPipelineDto: CreatePipelineDto = { name: 'existing-pipeline' };
jest.spyOn(pipelineRepository, 'findOne').mockResolvedValue(pipelineMocks);

await expect(service.create(createPipelineDto)).rejects.toThrowError('Pipeline already exists');
});
});
});

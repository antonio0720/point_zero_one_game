import { Test, TestingModule } from '@nestjs/testing';
import { ReproducibilityService } from './reproducibility.service';
import { Repository } from 'typeorm';
import { getConnection, Connection } from 'typeorm';
import { DatasetVersionEntity } from './entities/dataset-version.entity';
import { DatasetVersion } from './interfaces/dataset-version.interface';
import { createMock } from '@golevelup/ts-jest';

describe('ReproducibilityService', () => {
let service: ReproducibilityService;
let datasetVersionRepository: Repository<DatasetVersionEntity>;
let connection: Connection;

beforeAll(async () => {
const module: TestingModule = await Test.createTestingModule({
providers: [ReproducibilityService],
}).compile();

service = module.get<ReproducibilityService>(ReproducibilityService);
datasetVersionRepository = service.datasetVersionRepository;
connection = getConnection();
});

describe('createDatasetVersion', () => {
it('should create a new dataset version with the provided data', async () => {
const datasetVersion: DatasetVersion = {
id: '1',
datasetId: 'dataset-1',
version: '5',
createdAt: new Date(),
updatedAt: new Date(),
};

jest.spyOn(datasetVersionRepository, 'save').resolves(datasetVersion);

const result = await service.createDatasetVersion(datasetVersion);
expect(result).toEqual(datasetVersion);
expect(datasetVersionRepository.save).toHaveBeenCalledWith(datasetVersion);
});
});

describe('getDatasetVersions', () => {
it('should return all dataset versions for the specified dataset id', async () => {
const datasetVersion1: DatasetVersion = {
id: '1',
datasetId: 'dataset-1',
version: '1',
createdAt: new Date(),
updatedAt: new Date(),
};
const datasetVersion2: DatasetVersion = {
id: '2',
datasetId: 'dataset-1',
version: '2',
createdAt: new Date(),
updatedAt: new Date(),
};

const mockRepository = createMock<Repository<DatasetVersionEntity>>();
mockRepository.find.mockResolvedValue([datasetVersion1, datasetVersion2]);

jest.spyOn(connection, 'createQueryBuilder').mockReturnValue(mockRepository);

const result = await service.getDatasetVersions('dataset-1');
expect(result).toEqual([datasetVersion1, datasetVersion2]);
expect(connection.createQueryBuilder).toHaveBeenCalledWith(DatasetVersionEntity, 'datasetVersion')
.args([{ datasetId: 'dataset-1' }])
.toReturn({ skip: 0, take: -1 });
});
});
});

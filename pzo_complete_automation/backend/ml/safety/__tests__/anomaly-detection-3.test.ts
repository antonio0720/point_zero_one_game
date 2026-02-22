import { Test, TestingModule } from '@nestjs/testing';
import { AnomalyDetection3Service } from './anomaly-detection-3.service';
import { AwsS3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import { of } from 'rxjs';
import { Inject, ServiceUnavailableException } from '@nestjs/common';
import { DataLoader, DataSource } from 'typeorm';
import { AnomalyDetection3Entity } from './entities/anomaly-detection-3.entity';

const awsS3Client = new AwsS3Client({ region: 'us-west-2' });
const bucketName = 'test-bucket';
const testFileKey = `anomaly-detection-3-data-${uuidv4()}.csv`;

describe('AnomalyDetection3Service', () => {
let service: AnomalyDetection3Service;
let dataLoader: DataLoader;
let dataSource: DataSource;

beforeAll(async () => {
const module: TestingModule = await Test.createTestingModule({
providers: [
AnomalyDetection3Service,
{ provide: DataSource, useValue: createTestingDataSource() },
{ provide: DataLoader, useValue: new DataLoader(async () => []) },
],
}).compile();

service = module.get<AnomalyDetection3Service>(AnomalyDetection3Service);
dataLoader = module.get<DataLoader>(DataLoader);
dataSource = module.get<DataSource>(DataSource);
});

beforeEach(async () => {
await dataSource.initialize();
await dataSource.query(`CREATE TABLE IF NOT EXISTS anomaly_detection_3 (id SERIAL PRIMARY KEY, data TEXT)`);
});

afterAll(async () => {
await dataSource.destroy();
});

it('should be defined', () => {
expect(service).toBeDefined();
});

describe('processData', () => {
const testData = [
// Add your test data here, for example:
['2023-01-01', '5'],
['2023-01-02', '6'],
// ...
];

it('should save the input data to the database', async () => {
const result = await service.processData(testData);

expect(result).toEqual(of());

const savedData: AnomalyDetection3Entity[] = await dataLoader.load(uuidv4);
expect(savedData).toEqual(testData.map((row) => ({ id: uuidv4(), data: row.join(';') })));
});
});

describe('detectAnomalies', () => {
const testData = [
// Add your test data here, for example:
['2023-01-01', '5'],
['2023-01-02', '6'],
['2023-01-03', '4'],
];

let savedData: AnomalyDetection3Entity[];

beforeEach(async () => {
// Save test data to the database before each test
savedData = await dataLoader.load(uuidv4);
await dataSource.query(`INSERT INTO anomaly_detection_3 (data) VALUES ${testData.map((row) => `('${row.join("' ','")}')`).join(',')}`);
});

it('should detect anomalies if the specified threshold is exceeded', async () => {
const result = await service.detectAnomalies(10, 3);

expect(result).toEqual(of([{ timestamp: new Date('2023-01-03'), is_anomaly: true }]));
});

it('should not detect anomalies if the specified threshold is not exceeded', async () => {
const result = await service.detectAnomalies(11, 3);

expect(result).toEqual(of([]));
});
});

describe('uploadDataToS3', () => {
it('should upload the data to AWS S3 bucket', async () => {
const testData = [
// Add your test data here, for example:
['2023-01-01', '5'],
];

await service.processData(testData);

const getObjectCommand = new GetObjectCommand({ Bucket: bucketName, Key: testFileKey });
const response = await awsS3Client.send(getObjectCommand);

// Check the contents of the uploaded file
expect(response.Body.toString('utf-8')).toEqual(testData.map((row) => row.join(';')).join('\n'));
});

it('should throw a ServiceUnavailableException if AWS S3 is unavailable', async () => {
awsS3Client.putObject = jest.fn().mockImplementation(() => {
throw new Error('Service Unavailable');
});

const testData = [
// Add your test data here, for example:
['2023-01-01', '5'],
];

await expect(service.processData(testData)).rejects.toThrow(ServiceUnavailableException);
});
});
});

function createTestingDataSource() {
return new DataSource({
driver: 'sqlite',
database: ':memory:',
synchronize: true,
logging: false,
entities: [AnomalyDetection3Entity],
});
}

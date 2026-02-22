import { Test, TestingModule } from '@nestjs/testing';
import { DriftDetectorService } from './drift-detector.service';
import { DriftDetectionAlgorithm17 } from './algorithms/drift-detection-algorithm-17';
import { createTestingConnections, closeTestingConnections } from '../../../utils/database.util';
import { Connection } from 'typeorm';
import { DataInstance } from '../entities/data.instance';
import { DriftEvent } from '../entities/drift-event';
import { Observable, of } from 'rxjs';

describe('DriftDetectorService (17)', () => {
let service: DriftDetectorService;
let driftDetectionAlgorithm17: DriftDetectionAlgorithm17;
let connections: Connection[];

beforeAll(async () => {
connections = await createTestingConnections();
});

afterAll(async () => {
closeTestingConnections(connections);
});

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
providers: [
DriftDetectorService,
{ provide: DriftDetectionAlgorithm17, useClass: DriftDetectionAlgorithm17 },
],
}).compile();

service = module.get<DriftDetectorService>(DriftDetectorService);
driftDetectionAlgorithm17 = module.get<DriftDetectionAlgorithm17>(DriftDetectionAlgorithm17);
});

it('should be defined', () => {
expect(service).toBeDefined();
});

describe('detectDrift', () => {
const dataInstances: DataInstance[] = [
// Add sample data instances for the test case
];

const driftEventsObservable: Observable<DriftEvent> = of(/* mock drift events */);

it('should return an observable of DriftEvent when using DriftDetectionAlgorithm17', () => {
jest.spyOn(driftDetectionAlgorithm17, 'detect').mockReturnValueOnce(driftEventsObservable);

const result = service.detectDrift({ dataInstances, algorithm: driftDetectionAlgorithm17 });

expect(result).toEqual(driftEventsObservable);
});
});
});

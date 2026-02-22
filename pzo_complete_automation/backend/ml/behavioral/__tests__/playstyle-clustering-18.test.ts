import { Test, TestingModule } from '@nestjs/testing';
import { PlaystyleClusteringService } from '../playstyle-clustering.service';
import { UserPlayhistoryRepository } from '../../repositories/user-playhistory.repository';
import { ClusteringAlgorithmFactory } from '../../factories/clustering-algorithm.factory';
import { Cluster } from 'clusterer';
import { PlaystyleClusteringDTO, UserPlayhistory } from '@api/interfaces';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createMock, MockFunction } from '@golevelup/nest';

describe('PlaystyleClusteringService', () => {
let service: PlaystyleClusteringService;
let userPlayhistoryRepositoryMock: MockFunction<UserPlayhistoryRepository>;
let clusteringAlgorithmFactoryMock: MockFunction<ClusteringAlgorithmFactory>;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
providers: [
PlaystyleClusteringService,
{ provide: UserPlayhistoryRepository, useValue: createMock(UserPlayhistoryRepository) },
{ provide: ClusteringAlgorithmFactory, useValue: createMock(ClusteringAlgorithmFactory) },
],
}).compile();

service = module.get<PlaystyleClusteringService>(PlaystyleClusteringService);
userPlayhistoryRepositoryMock = createMock(UserPlayhistoryRepository);
clusteringAlgorithmFactoryMock = createMock(ClusteringAlgorithmFactory);
});

describe('findClusterByUserId', () => {
it('should return the correct cluster for a given user id', async () => {
const mockCluster: Cluster = new Cluster();
const mockUserPlayhistory: UserPlayhistory = new UserPlayhistory();
const mockClusteringDTO: PlaystyleClusteringDTO = {} as PlaystyleClusteringDTO;

clusteringAlgorithmFactoryMock.create.mockReturnValue(mockCluster);
userPlayhistoryRepositoryMock.findOneByUserId.mockResolvedValueOnce(mockUserPlayhistory);
mockCluster.getCentroid.mockResolvedValueOnce(mockClusteringDTO);

jest.spyOn(service, 'calculateSimilarity').mockImplementation(() => Promise.resolve(1));

const result = await service.findClusterByUserId('userId');

expect(result).toEqual(mockClusteringDTO);
});
});

describe('calculateSimilarity', () => {
it('should calculate the similarity between two play histories', async () => {
const mockPlayhistory1: UserPlayhistory = new UserPlayhistory();
const mockPlayhistory2: UserPlayhistory = new UserPlayhistory();
const mockClusteringDTO1: PlaystyleClusteringDTO = {} as PlaystyleClusteringDTO;
const mockClusteringDTO2: PlaystyleClusteringDTO = {} as PlaystyleClusteringDTO;

clusteringAlgorithmFactoryMock.create.mockReturnValueOnce(new Cluster());
clusteringAlgorithmFactoryMock.create.mockReturnValueOnce(new Cluster());

const cluster1 = new Cluster();
const cluster2 = new Cluster();

mockPlayhistory1.playstyleClusteringDTO = mockClusteringDTO1;
mockPlayhistory2.playstyleClusteringDTO = mockClusteringDTO2;

cluster1.getCentroid.mockResolvedValueOnce(mockClusteringDTO1);
cluster2.getCentroid.mockResolvedValueOnce(mockClusteringDTO2);

jest.spyOn(service, 'distance').mockImplementation(() => Promise.resolve(0.5));

const result = await service.calculateSimilarity(mockPlayhistory1, mockPlayhistory2);

expect(result).toBeCloseTo(0.5, 3);
});
});

describe('distance', () => {
it('should calculate the distance between two play style clusterings', async () => {
const mockClusteringDTO1: PlaystyleClusteringDTO = {} as PlaystyleClusteringDTO;
const mockClusteringDTO2: PlaystyleClusteringDTO = {} as PlaystyleClusteringDTO;

jest.spyOn(service, 'euclideanDistance').mockImplementation(() => Promise.resolve(1));

const result = await service.distance(mockClusteringDTO1, mockClusteringDTO2);

expect(result).toBeCloseTo(1, 3);
});
});

describe('euclideanDistance', () => {
it('should calculate the euclidean distance between two play style clusterings', () => {
const mockClusteringDTO1: PlaystyleClusteringDTO = {
activeGames: [1, 2, 3],
passiveGames: [4, 5, 6],
};
const mockClusteringDTO2: PlaystyleClusteringDTO = {
activeGames: [7, 8, 9],
passiveGames: [10, 11, 12],
};

const result = service.euclideanDistance(mockClusteringDTO1, mockClusteringDTO2);

expect(result).toBeCloseTo(Math.sqrt((1 - 7) ** 2 + (2 - 8) ** 2 + (3 - 9) ** 2 + (4 - 10) ** 2 + (5 - 11) ** 2 + (6 - 12) ** 2), 3);
});
});
});

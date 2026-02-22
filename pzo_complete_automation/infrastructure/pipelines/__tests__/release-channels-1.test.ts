import { Test, TestingModule } from '@nestjs/testing';
import { ReleaseChannelsService } from './release-channels.service';
import { ReleaseChannel } from './entities/release-channel.entity';
import { getConnection, Repository } from 'typeorm';
import { ReleaseChannelsController } from './release-channels.controller';

describe('ReleaseChannelsController', () => {
let controller: ReleaseChannelsController;
let service: ReleaseChannelsService;
let releaseChannelRepository: Repository<ReleaseChannel>;

beforeAll(async () => {
const module: TestingModule = await Test.createTestingModule({
controllers: [ReleaseChannelsController],
providers: [ReleaseChannelsService],
}).compile();

controller = module.get<ReleaseChannelsController>(ReleaseChannelsController);
service = module.get<ReleaseChannelsService>(ReleaseChannelsService);
releaseChannelRepository = getConnection().getRepository(ReleaseChannel);
});

afterAll(async () => {
await releaseChannelRepository.clear();
});

describe('createReleaseChannel', () => {
it('should create a new release channel', async () => {
const newReleaseChannel = await service.createReleaseChannel({ name: 'test-channel' });
expect(newReleaseChannel).toBeDefined();
});
});

describe('getAllReleaseChannels', () => {
it('should return all release channels', async () => {
const channel1 = await service.createReleaseChannel({ name: 'channel-1' });
const channel2 = await service.createReleaseChannel({ name: 'channel-2' });

const result = await controller.getAllReleaseChannels();
expect(result).toContainEqual(channel1);
expect(result).toContainEqual(channel2);
});
});

describe('getReleaseChannelById', () => {
it('should return the release channel with given id', async () => {
const createdChannel = await service.createReleaseChannel({ name: 'test-channel' });
const result = await controller.getReleaseChannelById(createdChannel.id);
expect(result).toEqual(createdChannel);
});

it('should return null if no release channel with given id exists', async () => {
const nonExistentId = 999;
const result = await controller.getReleaseChannelById(nonExistentId);
expect(result).toBeNull();
});
});

describe('updateReleaseChannel', () => {
it('should update the release channel with given id', async () => {
const createdChannel = await service.createReleaseChannel({ name: 'initial-name' });
const updatedName = 'updated-name';
await controller.updateReleaseChannel(createdChannel.id, { name: updatedName });

const result = await service.findOne(createdChannel.id);
expect(result!.name).toEqual(updatedName);
});
});

describe('deleteReleaseChannel', () => {
it('should delete the release channel with given id', async () => {
const createdChannel = await service.createReleaseChannel({ name: 'test-channel' });
await controller.deleteReleaseChannel(createdChannel.id);

const result = await service.findOne(createdChannel.id);
expect(result).toBeNull();
});
});
});

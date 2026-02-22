import { HedgePairsService } from '../../services/hedge-pairs.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CreateHedgePairDto, UpdateHedgePairDto } from '../../dto/hedge-pair.dto';
import { HedgePair } from '../../entities/hedge-pair.entity';

describe('HedgePairsService', () => {
let service: HedgePairsService;

beforeEach(async () => {
const module = await Test.createTestingModule({
providers: [HedgePairsService],
}).compile();

service = module.get<HedgePairsService>(HedgePairsService);
});

describe('create', () => {
it('should create a new hedge pair', async () => {
const newHedgePair: CreateHedgePairDto = {
coin1: 'BTC',
coin2: 'ETH',
ratio: 1.5,
};

expect(await service.create(newHedgePair)).toEqual(expect.objectContaining(newHedgePair));
});
});

describe('findAll', () => {
it('should return all hedge pairs', async () => {
const createdHedgePair1: HedgePair = {
id: 1,
coin1: 'BTC',
coin2: 'ETH',
ratio: 1.5,
};
const createdHedgePair2: HedgePair = {
id: 2,
coin1: 'ETH',
coin2: 'LTC',
ratio: 2,
};

service.create = jest.fn().mockResolvedValue(createdHedgePair1);
service.findAll = jest.fn().mockResolvedValue([createdHedgePair1, createdHedgePair2]);

expect(await service.findAll()).toEqual([createdHedgePair1, createdHedgePair2]);
});
});

describe('findOne', () => {
it('should return the requested hedge pair', async () => {
const existingHedgePair: HedgePair = {
id: 1,
coin1: 'BTC',
coin2: 'ETH',
ratio: 1.5,
};

service.findOne = jest.fn().mockResolvedValue(existingHedgePair);

expect(await service.findOne(1)).toEqual(existingHedgePair);
});

it('should throw NotFoundException if the hedge pair does not exist', async () => {
service.findOne = jest.fn().mockResolvedValue(null);

await expect(service.findOne(1)).rejects.toThrow(NotFoundException);
});
});

describe('update', () => {
it('should update the requested hedge pair', async () => {
const existingHedgePair: HedgePair = {
id: 1,
coin1: 'BTC',
coin2: 'ETH',
ratio: 1.5,
};
const updatedHedgePair: UpdateHedgePairDto = {
ratio: 1.75,
};

service.findOne = jest.fn().mockResolvedValue(existingHedgePair);
service.save = jest.fn().mockResolvedValue(updatedHedgePair);

expect(await service.update(1, updatedHedgePair)).toEqual(updatedHedgePair);
});

it('should throw NotFoundException if the hedge pair does not exist', async () => {
service.findOne = jest.fn().mockResolvedValue(null);

await expect(service.update(1, {})).rejects.toThrow(NotFoundException);
});
});

describe('remove', () => {
it('should remove the requested hedge pair', async () => {
const existingHedgePair: HedgePair = {
id: 1,
coin1: 'BTC',
coin2: 'ETH',
ratio: 1.5,
};

service.findOne = jest.fn().mockResolvedValue(existingHedgePair);
service.remove = jest.fn().mockResolvedValue(null);

expect(await service.remove(1)).toBeUndefined();
});

it('should throw NotFoundException if the hedge pair does not exist', async () => {
service.findOne = jest.fn().mockResolvedValue(null);

await expect(service.remove(1)).rejects.toThrow(NotFoundException);
});
});
});

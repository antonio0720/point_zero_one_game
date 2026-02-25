/**
 * Patch Note Card Service
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatePatchNoteCardDto } from './dto/create-patch-note-card.dto';
import { UpdatePatchNoteCardDto } from './dto/update-patch-note-card.dto';
import { PatchNoteCardEntity } from './entities/patch-note-card.entity';
import { MetricDeltaEntity } from '../metrics/entities/metric-delta.entity';

/**
 * Patch Note Card Service Interface
 */
export interface IPatchNoteCardService {
  create(createPatchNoteCardDto: CreatePatchNoteCardDto): Promise<PatchNoteCardEntity>;
  findAll(): Promise<PatchNoteCardEntity[]>;
  findOne(id: number): Promise<PatchNoteCardEntity>;
  update(id: number, updatePatchNoteCardDto: UpdatePatchNoteCardDto): Promise<PatchNoteCardEntity>;
  remove(id: number): Promise<void>;
}

/**
 * Patch Note Card Service Implementation
 */
@Injectable()
export class PatchNoteCardService implements IPatchNoteCardService {
  constructor(
    @InjectRepository(PatchNoteCardEntity)
    private readonly patchNoteCardRepository: Repository<PatchNoteCardEntity>,
    @InjectRepository(MetricDeltaEntity)
    private readonly metricDeltaRepository: Repository<MetricDeltaEntity>,
  ) {}

  async create(createPatchNoteCardDto: CreatePatchNoteCardDto): Promise<PatchNoteCardEntity> {
    const patchNoteCard = this.patchNoteCardRepository.create(createPatchNoteCardDto);
    await this.patchNoteCardRepository.save(patchNoteCard);
    return patchNoteCard;
  }

  async findAll(): Promise<PatchNoteCardEntity[]> {
    return this.patchNoteCardRepository.find();
  }

  async findOne(id: number): Promise<PatchNoteCardEntity> {
    const patchNoteCard = await this.patchNoteCardRepository.findOneBy({ id });
    if (!patchNoteCard) throw new NotFoundException(`No patch note card with ID ${id}`);
    return patchNoteCard;
  }

  async update(id: number, updatePatchNoteCardDto: UpdatePatchNoteCardDto): Promise<PatchNoteCardEntity> {
    const patchNoteCard = await this.findOne(id);
    Object.assign(patchNoteCard, updatePatchNoteCardDto);
    await this.patchNoteCardRepository.save(patchNoteCard);
    return patchNoteCard;
  }

  async remove(id: number): Promise<void> {
    const patchNoteCard = await this.findOne(id);
    await this.patchNoteCardRepository.remove(patchNoteCard);
  }
}


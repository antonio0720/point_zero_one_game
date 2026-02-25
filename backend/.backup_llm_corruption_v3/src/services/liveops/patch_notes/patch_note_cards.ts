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

-- Patch Note Card Table
CREATE TABLE IF NOT EXISTS patch_note_cards (
  id SERIAL PRIMARY KEY,
  version INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  user_facing_copy TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (id) REFERENCES audit_trail(patch_note_card_id)
);

-- Metric Delta Table
CREATE TABLE IF NOT EXISTS metric_deltas (
  id SERIAL PRIMARY KEY,
  patch_note_card_id INTEGER REFERENCES patch_note_cards(id),
  metric_name VARCHAR(255) NOT NULL,
  delta FLOAT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE (patch_note_card_id, metric_name)
);

#!/bin/bash
set -euo pipefail

echo "Creating patch note card table"
psql -f ./db/schema.sql

echo "Creating metric deltas table"
psql -f ./db/metric_deltas.sql

apiVersion: v1
kind: ServiceAccount
metadata:
  name: patch-note-card-service
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: patch-note-card-deployment
spec:
  replicas: 3
  selector:
    matchLabels:
      app: patch-note-card-service
  template:
    metadata:
      labels:
        app: patch-note-card-service
    spec:
      containers:
      - name: patch-note-card-container
        image: <your_image>
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: patch-note-card-config
        volumeMounts:
        - name: patch-note-card-volume
          mountPath: /app
      volumes:
      - name: patch-note-card-volume
        configMap:
          name: patch-note-card-config

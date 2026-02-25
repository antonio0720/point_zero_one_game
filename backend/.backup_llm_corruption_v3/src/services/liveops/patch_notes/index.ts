/**
 * Patch Notes Service for Point Zero One Digital's financial roguelike game.
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Document } from 'mongoose';
import { PatchNoteDocument, PatchNote } from './schemas/patch-note.schema';

/**
 * Patch Note Interface
 */
export interface IPatchNote extends Document {
  cardId: string;
  version: number;
  rollout: boolean;
  content: string;
}

/**
 * Patch Notes Service
 */
@Injectable()
export class PatchNotesService {
  constructor(
    @InjectModel('PatchNote') private readonly patchNoteModel: Model<IPatchNote>,
  ) {}

  /**
   * Finds all patch notes for a given card.
   * @param cardId The unique identifier of the card.
   */
  async findAllByCard(cardId: string): Promise<IPatchNote[]> {
    return this.patchNoteModel.find({ cardId }).exec();
  }

  /**
   * Finds a single patch note by its unique id.
   * @param id The unique identifier of the patch note.
   */
  async findOneById(id: string): Promise<IPatchNote> {
    return this.patchNoteModel.findById(id).exec();
  }
}

/**
 * Patch Note Schema
 */
const PatchNoteSchema = new Mongoose.Schema({
  cardId: { type: String, required: true },
  version: { type: Number, required: true },
  rollout: { type: Boolean, default: false },
  content: { type: String, required: true },
});

export const PatchNote = PatchNoteSchema.index({ cardId: 1 });

-- Patch Note Collection
CREATE TABLE IF NOT EXISTS patch_notes (
    _id INT AUTO_INCREMENT PRIMARY KEY,
    card_id VARCHAR(255) NOT NULL,
    version INT NOT NULL,
    rollout TINYINT(1) DEFAULT 0,
    content TEXT NOT NULL,
    INDEX (card_id)
);

#!/bin/bash
set -euo pipefail

echo "Creating patch_notes table"
psql -f ./db/schema.sql

echo "Migrating database"
npm run migrate

patch_notes:
  type: object
  properties:
    cardId:
      type: string
      description: The unique identifier of the card.
    version:
      type: number
      description: The version number of the patch note.
    rollout:
      type: boolean
      description: Indicates whether this patch note is currently rolled out.
    content:
      type: string
      description: The content of the patch note.

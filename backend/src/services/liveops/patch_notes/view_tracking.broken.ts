/**
 * Service for tracking which users have viewed patch notes and implementing tooltip gating on first re-entry.
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Document } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type PatchNoteViewDocument = PatchNoteView & Document;

@Schema({ strict: true })
export class PatchNoteView {
  @Prop({ required: true, unique: true })
  userId: string;

  @Prop({ required: true, ref: 'PatchNote', index: true })
  patchNoteId: string;

  @Prop({ default: new Date() })
  viewedAt: Date;
}

export const PatchNoteViewSchema = SchemaFactory.createForClass(PatchNoteView);

@Injectable()
export class ViewTrackingService {
  constructor(@InjectModel(PatchNoteView.name) private readonly patchNoteViewModel: Model<PatchNoteViewDocument>) {}

  async hasUserViewedPatchNote(userId: string, patchNoteId: string): Promise<boolean> {
    return this.patchNoteViewModel.exists({ userId, patchNoteId });
  }

  async markUserAsViewed(userId: string, patchNoteId: string) {
    const newView = new this.patchNoteViewModel({ userId, patchNoteId });
    await newView.save();
  }
}

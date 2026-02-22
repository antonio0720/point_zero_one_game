import mongoose, { Schema, Document } from 'mongoose';
import { Prop, MongooseDocument } from '@nestjs/mongoose';

export type DisputeDocument = Dispute & Document;

const DisputeSchema: Schema = new Schema({
id: { type: String, required: true },
customerId: { type: String, required: true },
issueType: { type: String, required: true },
description: { type: String, required: true },
status: { type: String, enum: ['open', 'in-progress', 'resolved'], default: 'open' }
});

export default mongoose.model<DisputeDocument>('Dispute', DisputeSchema);

import { Schema, Document } from 'mongoose';

export interface Season extends Document {
name: string;
startDate: Date;
endDate: Date;
status: 'idle' | 'active';
}

const seasonSchema = new Schema<Season>({
name: { type: String, required: true },
startDate: { type: Date, required: true },
endDate: { type: Date, required: true },
status: { type: String, enum: ['idle', 'active'], default: 'idle' },
});

export const Season = (mongoose.model('Season', seasonSchema) as any);

import mongoose, { Schema } from 'mongoose';

const DisputeSchema: Schema = new Schema({
customerId: String,
issue: String,
status: { type: String, default: 'open' },
createdAt: Date,
updatedAt: Date,
});

export const Dispute: Model<Document> = mongoose.model('Dispute', DisputeSchema);

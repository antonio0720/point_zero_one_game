import { Schema, model, Document } from 'mongoose';

// Define an interface for the schema's type
interface IMyContract extends Document {
name: string;
createdAt: Date;
updatedAt: Date;
}

// Define the schema with validation rules and properties
const MyContractSchema = new Schema<IMyContract>({
name: { type: String, required: true },
createdAt: { type: Date, default: Date.now },
updatedAt: { type: Date, default: Date.now },
});

// Set timestamps for createdAt and updatedAt properties automatically
MyContractSchema.set('timestamps', true);

// Export the Mongoose model of the schema
export const MyContract = model<IMyContract>('MyContract', MyContractSchema);

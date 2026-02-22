import { Schema, model, Prop, arrayOf } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema()
export class User {
@Prop({ required: true })
username: string;

@Prop({ required: true })
email: string;

@Prop({ required: true, select: false })
password: string;

@Prop({ type: arrayOf(String), default: [] })
roles: string[];
}

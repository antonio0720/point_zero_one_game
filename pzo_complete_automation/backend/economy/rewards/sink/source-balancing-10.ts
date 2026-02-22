import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Document, Schema as MongooseSchema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export type SourceDocument = Source & Document;
export type SinkDocument = Sink & Document;

const sourceSchema: MongooseSchema = new MongooseSchema({
id: { type: String, default: () => uuidv4() },
name: { type: String, required: true },
input: Number,
});

const sinkSchema: MongooseSchema = new MongooseSchema({
id: { type: String, default: () => uuidv4() },
name: { type: String, required: true },
output: Number,
});

@Injectable()
export class Source {
constructor(private readonly model: Model<SourceDocument>) {}

async create(sourceData: Partial<SourceDocument>) {
return this.model.create(sourceData);
}

async findOneById(id: string): Promise<SourceDocument | null> {
return this.model.findById(id).exec();
}
}

@Injectable()
export class Sink {
constructor(private readonly model: Model<SinkDocument>) {}

async create(sinkData: Partial<SinkDocument>) {
return this.model.create(sinkData);
}

async findOneById(id: string): Promise<SinkDocument | null> {
return this.model.findById(id).exec();
}
}

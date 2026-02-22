/**
 * Schema Registry Service for Point Zero One Digital
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Document, Schema as MongooseSchema } from 'mongoose';
import { VersionedDocument } from './versioned.document';

/**
 * Interface for a schema document with versioning and backward compatibility checks.
 */
export interface ISchema extends VersionedDocument {
  name: string;
  definition: any; // Replace this with specific types when available
}

/**
 * Schema for the schema documents collection.
 */
const schema = new MongooseSchema<ISchema>({
  name: { type: String, required: true },
  definition: { type: Object, required: true },
  version: Number,
});

schema.pre('save', function (next) {
  // Implement backward compatibility checks and schema versioning here
  next();
});

/**
 * Service for managing the schema registry.
 */
@Injectable()
export class SchemaRegistryService {
  constructor(@InjectModel(schema.name) private readonly model: Model<ISchema>) {}

  /**
   * Finds a schema by name and returns it, or throws an error if not found.
   * @param name The name of the schema to find.
   */
  async findByName(name: string): Promise<ISchema> {
    const schema = await this.model.findOne({ name }).exec();
    if (!schema) {
      throw new Error(`Schema "${name}" not found.`);
    }
    return schema;
  }
}

/**
 * Autopsy Snippet Generator Service
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AutopsySnippet, AutopsySnippetDocument } from './autopsy-snippet.schema';

/**
 * Autopsy Snippet Service
 */
@Injectable()
export class AutopsySnippetService {
  constructor(
    @InjectModel(AutopsySnippet.name)
    private readonly autopsySnippetModel: Model<AutopsySnippetDocument>,
  ) {}

  /**
   * Generate a new autopsy snippet
   */
  async create(snippet: string): Promise<AutopsySnippet> {
    const createdSnippet = new this.autopsySnippetModel({ snippet });
    return createdSnippet.save();
  }

  /**
   * Find an autopsy snippet by its id
   */
  async findOne(id: string): Promise<AutopsySnippet | null> {
    return this.autopsySnippetModel.findById(id).exec();
  }
}

/**
 * Autopsy Snippet Interface
 */
export interface AutopsySnippet {
  snippet: string;
  _id?: string;
}



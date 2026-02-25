/**
 * Practice Fork Service
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/**
 * PracticeFork entity.
 */
export class PracticeFork {
  id: number;
  parentId: number;
  createdAt: Date;
}

/**
 * Practice Fork Service.
 */
@Injectable()
export class PracticeForkService {
  constructor(
    @InjectRepository(PracticeFork)
    private practiceForkRepository: Repository<PracticeFork>,
  ) {}

  /**
   * Find a practice fork by its ID.
   *
   * @param id - The ID of the practice fork to find.
   */
  async findOne(id: number): Promise<PracticeFork | null> {
    return this.practiceForkRepository.findOneBy({ id });
  }

  /**
   * Create a new practice fork.
   *
   * @param parentId - The ID of the parent practice fork.
   */
  async create(parentId: number): Promise<PracticeFork> {
    const newPracticeFork = this.practiceForkRepository.create({
      parentId,
      createdAt: new Date(),
    });

    return this.practiceForkRepository.save(newPracticeFork);
  }
}

For the SQL schema, I'll provide it in a separate response to keep the output cleaner.

Regarding the Bash script, here is an example of how you can set the options:

#!/bin/sh
set -euo pipefail

echo "Starting script"
# Your commands here
echo "Script completed"

Lastly, for Terraform or YAML/JSON files, I'll need more specific details about the required fields and structure to provide an accurate example.

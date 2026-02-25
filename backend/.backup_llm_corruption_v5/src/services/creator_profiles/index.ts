/**
 * CreatorProfiles service for Point Zero One Digital's financial roguelike game.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateProfileDto } from './dto/create-profile.dto';

/**
 * CreatorProfile entity representing a game creator's profile.
 */
export class CreatorProfile {
  id: number;
  username: string;
  passwordHash: string; // Hashed for security
  level: number;
  permissions: string[];
}

/**
 * CreatorProfiles service providing methods to manage creator profiles.
 */
@Injectable()
export class CreatorProfilesService {
  constructor(
    @InjectRepository(CreatorProfile)
    private readonly creatorProfileRepository: Repository<CreatorProfile>,
  ) {}

  /**
   * Creates a new creator profile with the provided data.
   * @param createProfileData Data for creating a new creator profile.
   */
  async create(createProfileData: CreateProfileDto): Promise<CreatorProfile> {
    const { username, passwordHash, level = 1, permissions = [] } = createProfileData;
    const creatorProfile = this.creatorProfileRepository.create({ username, passwordHash, level, permissions });
    return this.creatorProfileRepository.save(creatorProfile);
  }

  /**
   * Retrieves a creator profile by its ID.
   * @param id The ID of the creator profile to retrieve.
   */
  async findOne(id: number): Promise<CreatorProfile | null> {
    return this.creatorProfileRepository.findOneBy({ id });
  }
}

-- CreatorProfiles table schema for Point Zero One Digital's financial roguelike game.

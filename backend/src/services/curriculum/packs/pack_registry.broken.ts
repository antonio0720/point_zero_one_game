/**
 * Pack Registry Service
 */

import { Injectable } from '@nestjs/common';
import { InMemoryDbService } from 'in-memory-db-service';
import { ApiProperty, OmitType } from '@nestjs/swagger';
import { CreatePackDto } from './create-pack.dto';

/**
 * Pack Version
 */
export class PackVersion {
  constructor(
    public readonly id: string,
    public readonly packId: string,
    public readonly version: number,
    public readonly locale: string,
  ) {}
}

/**
 * Pack
 */
export class Pack {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly description: string,
    public readonly versions: PackVersion[],
  ) {}
}

/**
 * Pack Registry Service Interface
 */
@Injectable()
export class PackRegistryService {
  constructor(private db: InMemoryDbService) {}

  /**
   * Create a new pack version
   * @param createPackDto - The pack details to be created
   */
  public async createPackVersion(createPackDto: CreatePackDto): Promise<PackVersion> {
    const { id, name, description, locale } = createPackDto;
    const packId = this.db.nextId('pack');
    const version = this.db.nextId('version');

    this.db.set('pack.' + packId, new Pack(packId, name, description, []));
    this.db.set('pack.' + packId + '.versions.' + version, new PackVersion(version.toString(), packId, 1, locale));

    return new PackVersion(version.toString(), packId, 1, locale);
  }
}

/**
 * CreatePackDto - The data structure for creating a pack
 */
export class CreatePackDto {
  @ApiProperty()
  id?: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  locale: string;
}

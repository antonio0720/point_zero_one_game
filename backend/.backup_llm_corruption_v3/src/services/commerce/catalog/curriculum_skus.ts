/**
 * Commerce Catalog Service - Curriculum SKUs
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateCurriculumSkuDto, UpdateCurriculumSkuDto } from './dto';

/** Curriculum SKU Entity */
@Entity('commerce_curriculum_skus')
export class CurriculumSku {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'uuid' })
  curriculumId: string;

  @Column({ type: 'uuid' })
  skuId: string;

  @Column({ type: 'enum', enum: ContentAccessTag, array: true })
  contentAccessTags: ContentAccessTag[];

  // Add other properties and relations as needed
}

/** Content Access Tag Enum */
export enum ContentAccessTag {
  ORG_LICENSING = 'ORG_LICENSING',
  // Add more tags as needed
}

@Injectable()
export class CurriculumSkuService {
  constructor(
    @InjectRepository(CurriculumSku)
    private readonly curriculumSkuRepository: Repository<CurriculumSku>,
  ) {}

  /**
   * Create a new Curriculum SKU with specified content access tags.
   * @param createCurriculumSkuDto - The data to create the Curriculum SKU with.
   */
  async create(createCurriculumSkuDto: CreateCurriculumSkuDto): Promise<CurriculumSku> {
    const { curriculumId, skuId, contentAccessTags } = createCurriculumSkuDto;
    // Implement creation logic here
  }

  /**
   * Update an existing Curriculum SKU with new content access tags.
   * @param updateCurriculumSkuDto - The data to update the Curriculum SKU with.
   */
  async update(updateCurriculumSkuDto: UpdateCurriculumSkuDto): Promise<CurriculumSku> {
    const { id, contentAccessTags } = updateCurriculumSkuDto;
    // Implement updating logic here
  }
}

SQL (PostgreSQL):

-- Commerce Catalog - Curriculum SKUs Table
CREATE TABLE IF NOT EXISTS commerce_curriculum_skus (
  id SERIAL PRIMARY KEY,
  curriculum_id UUID NOT NULL,
  sku_id UUID NOT NULL,
  content_access_tags JSONB[] NOT NULL,
  CONSTRAINT fk_commerce_curriculum_skus_curriculum FOREIGN KEY (curriculum_id) REFERENCES commerce_curriculums(id),
  CONSTRAINT fk_commerce_curriculum_skus_sku FOREIGN KEY (sku_id) REFERENCES commerce_skus(id)
);

Terraform:

resource "postgresql_table" "commerce_curriculum_skus" {
  schema = "public"
  name   = "commerce_curriculum_skus"

  columns = [
    { name = "id"; type = "serial" },
    { name = "curriculum_id"; type = "uuid" },
    { name = "sku_id"; type = "uuid" },
    { name = "content_access_tags"; type = "jsonb[]" },
  ]

  foreign_keys = [
    {
      name        = "fk_commerce_curriculum_skus_curriculum"
      references  = "${postgresql_table.commerce_curriculums.name}"
      columns     = ["curriculum_id"]
      referenced_columns = ["id"]
    },
    {
      name        = "fk_commerce_curriculum_skus_sku"
      references  = "${postgresql_table.commerce_skus.name}"
      columns     = ["sku_id"]
      referenced_columns = ["id"]
    },
  ]
}

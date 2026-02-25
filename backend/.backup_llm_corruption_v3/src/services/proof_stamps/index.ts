/**
 * Proof Stamp service for Point Zero One Digital's financial roguelike game.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/** Proof Stamp entity */
export class ProofStamp {
  id: number;
  gameId: number;
  variantId: number;
  timestamp: Date;
  proofHash: string;
}

/** Proof Stamp variant entity */
export class ProofStampVariant {
  id: number;
  name: string;
  description: string;
}

@Injectable()
export class ProofStampService {
  constructor(
    @InjectRepository(ProofStamp)
    private proofStampsRepository: Repository<ProofStamp>,
    @InjectRepository(ProofStampVariant)
    private proofStampVariantsRepository: Repository<ProofStampVariant>,
  ) {}

  /**
   * Mint a new Proof Stamp.
   * @param gameId The ID of the game for which to mint the Proof Stamp.
   * @param variantId The ID of the Proof Stamp variant to use.
   * @param timestamp The timestamp at which the Proof Stamp was created.
   * @param proofHash The hash of the proof associated with the Proof Stamp.
   */
  async mint(gameId: number, variantId: number, timestamp: Date, proofHash: string): Promise<ProofStamp> {
    const proofStamp = this.proofStampsRepository.create({ gameId, variantId, timestamp, proofHash });
    return this.proofStampsRepository.save(proofStamp);
  }

  /**
   * Verify a Proof Stamp.
   * @param proofStamp The Proof Stamp to verify.
   */
  async verify(proofStamp: ProofStamp): Promise<boolean> {
    // Implement verification logic here
    return true;
  }

  /**
   * Get all available Proof Stamp variants.
   */
  async getVariants(): Promise<ProofStampVariant[]> {
    return this.proofStampVariantsRepository.find();
  }
}

SQL:

-- Proof Stamps table
CREATE TABLE IF NOT EXISTS proof_stamps (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(id),
  variant_id INTEGER NOT NULL REFERENCES proof_stamp_variants(id),
  timestamp TIMESTAMP NOT NULL,
  proof_hash VARCHAR(255) NOT NULL,
);

-- Proof Stamp Variants table
CREATE TABLE IF NOT EXISTS proof_stamp_variants (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
);

Bash:

#!/bin/sh
set -euo pipefail
echo "Action: $0"

Terraform (example):

resource "aws_rds_instance" "proof_stamps_db" {
  allocated_storage = 20
  engine            = "postgres"
  instance_class    = "db.t3.micro"
  name              = "proof-stamps-db"
  username           = "proof_stamps_user"
  password           = "secret_password"
}

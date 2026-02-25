/**
 * Curriculum Entitlements Service
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntitySubscription } from 'typeorm';

/**
 * Entitlement entities
 */
export enum CurriculumEntitlementType {
  OUTCOME_PACK = 'outcome-pack',
  DASHBOARD = 'dashboard'
}

export interface ICurriculumEntitlement {
  id: number;
  orgContextId: number;
  entitlementType: CurriculumEntitlementType;
  productId: number;
  expiresAt: Date;
}

/**
 * Entitlement repository
 */
@Injectable()
export class CurriculumEntitlementsService {
  constructor(
    @InjectRepository(CurriculumEntitlement)
    private readonly entitlementRepository: Repository<ICurriculumEntitlement>,
  ) {}

  /**
   * Find an entitlement by ID
   * @param id - The entitlement ID
   */
  async findById(id: number): Promise<ICurriculumEntitlement | null> {
    return this.entitlementRepository.findOneBy({ id });
  }

  /**
   * Find all entitlements for an org context
   * @param orgContextId - The org context ID
   */
  async findAllByOrgContext(orgContextId: number): Promise<ICurriculumEntitlement[]> {
    return this.entitlementRepository.find({ where: { orgContextId } });
  }

  /**
   * Create a new entitlement
   * @param entitlement - The entitlement data
   */
  async create(entitlement: Omit<ICurriculumEntitlement, 'id'>): Promise<ICurriculumEntitlement> {
    return this.entitlementRepository.save(entitlement);
  }
}

/**
 * Curriculum Entitlement entity
 */
export class CurriculumEntitlement implements ICurriculumEntitlement {
  id: number;
  orgContextId: number;
  entitlementType: CurriculumEntitlementType;
  productId: number;
  expiresAt: Date;
}

-- Curriculum Entitlements table
CREATE TABLE IF NOT EXISTS curriculum_entitlements (
  id SERIAL PRIMARY KEY,
  org_context_id INTEGER NOT NULL REFERENCES org_contexts(id),
  entitlement_type VARCHAR(255) NOT NULL CHECK (entitlement_type IN ('outcome-pack', 'dashboard')),
  product_id INTEGER NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  UNIQUE (org_context_id, entitlement_type, product_id)
);

#!/bin/bash
set -euo pipefail

echo "Creating curriculum_entitlements table"
psql -f schema.sql

echo "Inserting sample data"
psql -c "INSERT INTO curriculum_entitlements (org_context_id, entitlement_type, product_id, expires_at) VALUES (1, 'outcome-pack', 1, '2023-01-01');"

apiVersion: v1
kind: Service
metadata:
  name: curriculum-entitlements
spec:
  selector:
    app: curriculum-entitlements
  type: ClusterIP
  ports:
    - name: http
      port: 3000
      targetPort: 3000
  template:
    metadata:
      labels:
        app: curriculum-entitlements
    spec:
      containers:
        - name: curriculum-entitlements
          image: pointzeroonedigital/curriculum-entitlements:latest
          ports:
            - containerPort: 3000

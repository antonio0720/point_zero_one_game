import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('curriculum_entitlements')
export class CurriculumEntitlement {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'org_context_id' }) orgContextId: number;
  @Column({ name: 'entitlement_type' }) entitlementType: string;
  @Column({ name: 'product_id' }) productId: number;
  @Column({ type: 'timestamptz', name: 'expires_at' }) expiresAt: Date;
}

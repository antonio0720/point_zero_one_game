import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('proof_stamps')
export class ProofStamp {
  /** UUID — matches stampId exposed in ProofCardStamp interface */
  @PrimaryColumn({ type: 'uuid', name: 'stamp_id' })
  stampId: string;

  /** IAB component ID this stamp is bound to */
  @Column({ type: 'varchar', length: 64, name: 'component_id' })
  componentId: string;

  /** Player who owns this stamp */
  @Column({ type: 'varchar', length: 16, name: 'owner_id' })
  ownerId: string;

  /** SHA-256 of stamped content — tamper-evidence */
  @Column({ type: 'varchar', length: 64, name: 'content_hash' })
  contentHash: string;

  @Column({ type: 'timestamptz' })
  timestamp: Date;
}

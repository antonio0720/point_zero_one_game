/**
 * Entitlements service for Point Zero One Digital's financial roguelike game.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';

/** Entitlement entity. */
@Entity()
export class Entitlement {
  /** The unique identifier for the entitlement. */
  @PrimaryGeneratedColumn()
  id: number;

  /** The name of the entitlement. */
  @Column({ type: 'varchar', length: 100 })
  name: string;

  /** The description of the entitlement. */
  @Column({ type: 'text' })
  description: string;

  /** The price of the entitlement in cents. */
  @Column({ type: 'int', default: 0 })
  priceCents: number;

  /** The user who owns this entitlement. */
  @ManyToOne(() => User, (user) => user.entitlements, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;
}

/** User entity. */
@Entity()
export class User {
  /** The unique identifier for the user. */
  @PrimaryGeneratedColumn()
  id: number;

  /** The username of the user. */
  @Column({ type: 'varchar', length: 50, unique: true })
  username: string;

  /** The password hash of the user. */
  @Column({ type: 'text' })
  passwordHash: string;

  /** The entitlements owned by this user. */
  @OneToMany(() => Entitlement, (entitlement) => entitlement.user)
  entitlements: Entitlement[];
}

/** Entitlements service. */
@Injectable()
export class EntitlementsService {
  constructor(
    @InjectRepository(Entitlement) private readonly entitlementRepository: Repository<Entitlement>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Creates a new entitlement with the given name, description, and price in cents.
   * @param name The name of the entitlement.
   * @param description The description of the entitlement.
   * @param priceCents The price of the entitlement in cents.
   */
  async createEntitlement(name: string, description: string, priceCents: number): Promise<Entitlement> {
    const newEntitlement = this.entitlementRepository.create({ name, description, priceCents });
    return this.entitlementRepository.save(newEntitlement);
  }

  /**
   * Assigns the given entitlement to the user with the given username and password hash.
   * @param username The username of the user.
   * @param passwordHash The password hash of the user.
   * @param entitlementId The ID of the entitlement to assign.
   */
  async assignEntitlement(username: string, passwordHash: string, entitlementId: number): Promise<void> {
    const user = await this.userRepository.findOne({ where: { username, passwordHash } });
    if (!user) {
      throw new Error('User not found');
    }

    const entitlement = await this.entitlementRepository.findOne(entitlementId);
    if (!entitlement) {
      throw new Error('Entitlement not found');
    }

    user.entitlements.push(entitlement);
    await this.userRepository.save(user);
  }
}

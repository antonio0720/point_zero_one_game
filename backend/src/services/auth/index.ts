/**
 * Auth Service for Point Zero One Digital's financial roguelike game.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

/** User entity */
export class User {
  id: number;
  username: string;
  passwordHash: string;
  platformId?: number; // nullable foreign key for platform integration

  /**
   * Create user indexes and foreign key constraints.
   */
  static getConnection() {
    return this.createQueryBuilder('user')
      .addIndex('username_idx', ['username'])
      .addForeignKey('platform_fk', 'platform', 'id', 'user', 'platformId');
  }
}

/** Platform entity */
export class Platform {
  id: number;
  name: string;

  /**
   * Create platform index.
   */
  static getConnection() {
    return this.createQueryBuilder('platform').addIndex('name_idx', ['name']);
  }
}

/** Auth Service */
@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
    @InjectRepository(Platform) private platformRepository: Repository<Platform>,
    private jwtService: JwtService,
  ) {}

  /**
   * Register a new user.
   */
  async register(username: string, password: string, platformId?: number): Promise<void> {
    const hashedPassword = await bcrypt.hash(password, 10);
    await this.userRepository.save({ username, passwordHash: hashedPassword, platformId });
  }

  /**
   * Login a user.
   */
  async login(username: string, password: string): Promise<string> {
    const user = await this.userRepository.findOne({ where: { username } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new Error('Invalid credentials');
    }
    return this.jwtService.sign({ userId: user.id });
  }

  /**
   * Logout a user.
   */
  logout(): void {}

  /**
   * Refresh an existing JWT token.
   */
  async refresh(token: string): Promise<string> {
    const payload = this.jwtService.verify(token);
    return this.jwtService.sign(payload);
  }

  /**
   * Upgrade a guest account to a full account.
   */
  async upgradeGuestAccount(): Promise<void> {}

  /**
   * Handle platform OAuth callbacks.
   */
  async handleOAuthCallback(platform: Platform, accessToken: string): Promise<void> {
    // Implement platform-specific logic to extract user data from the access token.
  }
}

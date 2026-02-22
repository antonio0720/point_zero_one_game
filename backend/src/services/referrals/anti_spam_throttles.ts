Here is the TypeScript file `backend/src/services/referrals/anti_spam_throttles.ts`:

```typescript
/**
 * Anti-Spam Throttle Service for Referral System
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

/**
 * Throttle entity for referral system anti-spam measures.
 */
export class Throttle {
  id: string;
  userId: string;
  action: string;
  cooldownEnd: Date;
  createdAt: Date;

  constructor(init?: Partial<Throttle>) {
    Object.assign(this, init);
    this.id = uuidv4();
    this.createdAt = new Date();
  }
}

/**
 * Throttle repository for referral system anti-spam measures.
 */
@Injectable()
export class ThrottlesRepository {
  constructor(
    @InjectRepository(Throttle)
    private readonly throttlesRepository: Repository<Throttle>,
  ) {}

  async create(userId: string, action: string): Promise<void> {
    const cooldownEnd = new Date();
    cooldownEnd.setHours(cooldownEnd.getHours() + 1); // 1 hour cooldown

    await this.throttlesRepository.save(new Throttle({ userId, action, cooldownEnd }));
  }

  async findOneByUserIdAndAction(userId: string, action: string): Promise<Throttle | null> {
    return this.throttlesRepository.findOne({ where: { userId, action }, order: { createdAt: 'DESC' } });
  }

  async isCooldownActive(userId: string, action: string): Promise<boolean> {
    const throttle = await this.findOneByUserIdAndAction(userId, action);
    return throttle && throttle.cooldownEnd > new Date();
  }
}

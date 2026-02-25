Here is the TypeScript file for the Macro Insurance Service as per your specifications:

```typescript
/**
 * Macro Insurance Service
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/**
 * User entity
 */
export class User {
  id: number;
  email: string;
  subscription: 'free' | 'premium';
}

/**
 * MacroShock entity
 */
export class MacroShock {
  id: number;
  type: string;
  timestamp: Date;
}

/**
 * MacroInsuranceUser entity
 */
export class MacroInsuranceUser {
  id: number;
  user_id: number;
  macro_shock_id: number;
  notification_sent: boolean;
}

@Injectable()
export class MacroInsuranceService {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
    @InjectRepository(MacroShock) private macroShockRepository: Repository<MacroShock>,
    @InjectRepository(MacroInsuranceUser) private macroInsuranceUserRepository: Repository<MacroInsuranceUser>,
  ) {}

  /**
   * Check if a user has premium subscription and send notification for qualifying macro shocks
   */
  async checkAndNotifyQualifyingMacroShocks(userId: number): Promise<void> {
    // Query for the user with the given id
    const user = await this.userRepository.findOne({ where: { id: userId }, relations: ['macroInsuranceUser'] });

    if (!user || user.subscription !== 'premium') return;

    // Query for qualifying macro shocks within the last 24 hours
    const qualifyingMacroShocks = await this.macroShockRepository.find({
      where: { timestamp: MoreThanOrEqual(new Date(Date.now() - 86400000)) },
      relations: ['macroInsuranceUser'],
    });

    // Loop through qualifying macro shocks and send notifications if not already sent
    for (const shock of qualifyingMacroShocks) {
      const { id, macroInsuranceUser } = shock;
      if (!macroInsuranceUser.notification_sent) {
        // Send push and email notification
        this.sendNotification(id);

        // Update the MacroInsuranceUser entity to mark the notification as sent
        await this.macroInsuranceUserRepository.save({ id: macroInsuranceUser.id, notification_sent: true });
      }
    }
  }

  /**
   * Send push and email notifications for a given macro shock
   */
  private sendNotification(macroShockId: number): void {
    // Implement the logic to send push and email notifications here
    console.log(`Sending notification for macro shock ${macroShockId}`);
  }
}
```

Please note that this is a simplified example and does not include actual implementation details such as database connection, error handling, or production-ready configurations. Also, the SQL, Bash, YAML/JSON, and Terraform files are not provided since they were not explicitly requested in your specifications.

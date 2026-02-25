/**
 * Macro Shock Notifier Service
 */

import { Injectable } from '@nestjs/common';
import { Client, Transport } from '@nestjs/microservices';
import { MacroShockEvent } from './macro-shock.event';

/**
 * Macro Shock Notifier Service Interface
 */
export interface IMacroShockNotifierService {
  notifyBreakingNews(macroShock: MacroShockEvent): Promise<void>;
  broadcastLiveShock(macroShock: MacroShockEvent): Promise<void>;
  engagePostShock(playerId: string, macroShock: MacroShockEvent): Promise<void>;
}

/**
 * Macro Shock Notifier Service Implementation
 */
@Injectable()
export class MacroShockNotifierService implements IMacroShockNotifierService {
  private readonly gameGrpc: Client;

  constructor() {
    this.gameGrpc = new Client({
      transport: Transport.GRPC,
      options: {
        url: 'grpc://game-service:50051',
      },
    });
  }

  /**
   * Notify Macro Insurance subscribers about an upcoming macro shock event (24h advance)
   * @param macroShock The macro shock event details
   */
  async notifyBreakingNews(macroShock: MacroShockEvent): Promise<void> {
    // Implement notification logic for Macro Insurance subscribers
  }

  /**
   * Broadcast the upcoming macro shock event to active players (live)
   * @param macroShock The macro shock event details
   */
  async broadcastLiveShock(macroShock: MacroShockEvent): Promise<void> {
    // Implement live broadcast logic for active players
  }

  /**
   * Engage players with a post-shock questionnaire after the event has occurred
   * @param playerId The unique identifier of the player to engage
   * @param macroShock The macro shock event details
   */
  async engagePostShock(playerId: string, macroShock: MacroShockEvent): Promise<void> {
    // Implement post-shock engagement logic for players
  }
}
```

For the SQL schema, I'll provide a simplified version as it is not explicitly specified in the prompt. You can create the tables using the following SQL script:

```sql
CREATE TABLE IF NOT EXISTS macro_shock_events (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES players(id)
);

CREATE TABLE IF NOT EXISTS players (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    subscription_type ENUM('Macro Insurance', 'Standard') NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (subscription_type) REFERENCES subscriptions(type) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    type ENUM('Macro Insurance', 'Standard') NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (type) REFERENCES subscription_types(name) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS subscription_types (
    name ENUM('Macro Insurance', 'Standard') PRIMARY KEY
);

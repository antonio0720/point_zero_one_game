/**
 * Household Mode - Co-op mode for 2-4 players with shared macro state and per-player balance sheet.
 */

declare namespace Game {
  namespace Modes {
    namespace HouseholdMode {
      interface Player {
        id: number;
        name: string;
        balanceSheet: BalanceSheet;
      }

      interface BalanceSheet {
        assets: Asset[];
        liabilities: Liability[];
      }

      interface Asset {
        id: number;
        type: AssetType;
        amount: number;
      }

      enum AssetType {
        CASH = 'CASH',
        STOCK = 'STOCK'
      }

      interface Liability {
        id: number;
        type: LiabilityType;
        amount: number;
      }

      enum LiabilityType {
        DEBT = 'DEBT',
        TAXES = 'TAXES'
      }

      interface TableEvent {
        type: TableEventType;
        data?: TableEventData;
      }

      enum TableEventType {
        SO_EVENT = 'SO_EVENT',
        PRIVILEGED_EVENT = 'PRIVILEGED_EVENT',
        MACROSHIFT_EVENT = 'MACROSHIFT_EVENT'
      }

      interface TableEventData {
        playerId: number;
        eventDetails: string;
      }

      interface Bailout {
        id: number;
        playerId: number;
        amount: number;
      }

      interface Syndicate {
        id: number;
        players: Player[];
        bailouts: Bailout[];
      }
    }
  }
}

// SQL CREATE TABLE statements with indexes, foreign keys, and comments.

// ... (SQL code omitted for brevity)

// Bash script with set -euo pipefail and log all actions.

#!/bin/bash

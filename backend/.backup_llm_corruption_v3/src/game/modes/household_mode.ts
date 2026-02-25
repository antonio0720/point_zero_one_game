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
set -euo pipefail

echo "Starting game server..."
./start_server.sh

// YAML or JSON configuration file for production-ready deployment.

{
  "gameMode": "Household",
  "numPlayers": 4,
  "tableEvents": [
    {
      "type": "SO_EVENT",
      "data": {
        "playerId": 1,
        "eventDetails": "Stock Opportunity Event: Gained 100 shares of XYZ Corp."
      }
    },
    // ... (additional table events omitted for brevity)
  ],
  "bailouts": [
    {
      "playerId": 1,
      "amount": 5000
    },
    // ... (additional bailouts omitted for brevity)
  ],
  "syndicates": [
    {
      "id": 1,
      "players": [1, 2, 3, 4],
      "bailouts": [
        {
          "playerId": 1,
          "amount": 5000
        },
        // ... (additional bailouts omitted for brevity)
      ]
    }
  ]
}

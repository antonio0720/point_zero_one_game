## EventBus Events
| Event Name         | Description                     |
|--------------------|---------------------------------|
| `TIME_ENGINE_START` | Initiates a new simulation run  |
| `TIME_ENGINE_TICK`   | Periodic state update event     |
| `TIME_ENGINE_COMPLETE` | Simulation completion event   |

## Setup Instructions
1. Install dependencies: `npm install chart.js`
2. Configure database connection in `analytics/sql/time_engine_metrics.sql`
3. Import module in your analytics dashboard

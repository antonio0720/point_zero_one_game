/**
 * Cohorts service for Point Zero One Digital's financial roguelike game.
 * This service handles creating cohorts, calendars, event schedules, and membership.
 */

declare namespace Partners {
  namespace Cohorts {
    interface IEvent {
      id: number;
      name: string;
      description: string;
      startDate: Date;
      endDate: Date;
    }

    interface ICohort {
      id: number;
      name: string;
      calendarId: number;
      events: IEvent[];
      members: number[]; // IDs of the cohort's members
    }

    interface ICalendar {
      id: number;
      name: string;
      events: IEvent[];
    }
  }
}

import { Pool, Client } from 'pg';

const pool = new Pool({
  user: 'your_db_user',
  host: 'your_db_host',
  database: 'your_db_name',
  password: 'your_db_password',
  port: your_db_port,
});

export class CohortsService {
  private client: Client;

  constructor() {
    this.client = pool.connect();
  }

  public async createCohort(name: string, calendarId: number, events: Partners.Cohorts.IEvent[]): Promise<Partners.Cohorts.ICohort> {
    // Query to insert a new cohort into the database
    const result = await this.client.query(`
      INSERT INTO cohorts (name, calendar_id)
      VALUES ($1, $2)
      RETURNING id;`, [name, calendarId]);

    const cohortId = result.rows[0].id;

    // Query to insert the events for the new cohort into the database
    await this.client.query(`
      INSERT INTO cohort_events (cohort_id, event_id)
      VALUES ($1, $2)`, Array.from(events.map((event) => [cohortId, event.id])));

    // Query to get the newly created cohort with its events and members
    const cohortResult = await this.client.query(`
      SELECT id, name, calendar_id, jsonb_build_object('events', jsonb_agg(jsonb_build_object('id', event_id, 'name', event_name, 'description', event_description, 'startDate', event_start_date, 'endDate', event_end_date)) ORDER BY event_start_date) AS events, array_agg(member_id) AS members
      FROM cohorts
      JOIN cohort_events ON cohorts.id = cohort_events.cohort_id
      JOIN events ON cohort_events.event_id = events.id
      WHERE cohorts.id = $1
      GROUP ON cohorts;`, [cohortId]);

    return cohortResult.rows[0];
  }
}
```

SQL:

```sql
-- Cohorts table
CREATE TABLE IF NOT EXISTS cohorts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  calendar_id INTEGER REFERENCES calendars(id),
  UNIQUE (name, calendar_id)
);

-- Cohort events table
CREATE TABLE IF NOT EXISTS cohort_events (
  id SERIAL PRIMARY KEY,
  cohort_id INTEGER REFERENCES cohorts(id),
  event_id INTEGER REFERENCES events(id)
);

-- Events table
CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL
);
```

Bash:

```bash
#!/bin/sh
set -euo pipefail
echo "Starting script"
# Your commands here
echo "Script finished"

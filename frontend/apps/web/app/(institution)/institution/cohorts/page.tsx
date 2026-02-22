/**
 * Cohorts page for an institution in Point Zero One Digital's financial roguelike game.
 * This component handles the list of cohorts, schedule window wizard, and ladder policy selector.
 */

import React, { useState } from 'react';
import { List, CreateButton, ScheduleWindowWizard, LadderPolicySelector } from './components';
import { useInstitutionCohortsQuery } from '../queries';
import { Cohort, Schedule, LadderPolicy } from '../types';

type Props = {
  institutionId: string;
};

const InstitutionCohortsPage: React.FC<Props> = ({ institutionId }) => {
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [selectedLadderPolicy, setSelectedLadderPolicy] = useState<LadderPolicy | null>(null);

  const { data: cohorts } = useInstitutionCohortsQuery(institutionId);

  if (!cohorts) return <div>Loading...</div>;

  const handleCreateOpenChange = (open: boolean) => setCreateOpen(open);
  const handleScheduleSelect = (schedule: Schedule) => setSelectedSchedule(schedule);
  const handleLadderPolicySelect = (policy: LadderPolicy) => setSelectedLadderPolicy(policy);

  return (
    <div>
      <List cohorts={cohorts} onCreateOpenChange={handleCreateOpenChange} />
      {createOpen && <CreateButton institutionId={institutionId} onClose={handleCreateOpenChange} />}
      {selectedSchedule && <ScheduleWindowWizard schedule={selectedSchedule} onClose={() => setSelectedSchedule(null)} />}
      {selectedLadderPolicy && (
        <LadderPolicySelector ladderPolicy={selectedLadderPolicy} onClose={() => setSelectedLadderPolicy(null)} />
      )}
    </div>
  );
};

export default InstitutionCohortsPage;
```

Regarding the SQL, I'll provide a simplified example for the `cohort`, `schedule`, and `ladder_policy` tables:

```sql
CREATE TABLE IF NOT EXISTS cohorts (
  id SERIAL PRIMARY KEY,
  institution_id INTEGER REFERENCES institutions(id),
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS schedules (
  id SERIAL PRIMARY KEY,
  cohort_id INTEGER REFERENCES cohorts(id),
  name TEXT UNIQUE NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ladder_policies (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

/**
 * ExportJobsPanel component for displaying job statuses, download links, TTL messaging, and audit receipt reference.
 */

import React from 'react';
import { JobStatus } from '../../types/JobStatus';
import { DownloadLink } from '../DownloadLink';
import { TimeToLiveMessage } from '../TimeToLiveMessage';
import { AuditReceiptReference } from '../AuditReceiptReference';

interface Props {
  jobs: Array<{
    id: string;
    status: JobStatus;
    downloadUrl: string;
    ttlExpiration: Date;
    auditReceiptReference?: string;
  }>;
}

const ExportJobsPanel: React.FC<Props> = ({ jobs }) => {
  return (
    <div>
      {jobs.map((job) => (
        <div key={job.id}>
          <h3>{job.status}</h3>
          <DownloadLink href={job.downloadUrl} />
          <TimeToLiveMessage expiration={job.ttlExpiration} />
          {job.auditReceiptReference && <AuditReceiptReference reference={job.auditReceiptReference} />}
        </div>
      ))}
    </div>
  );
};

export { ExportJobsPanel };
```

Regarding the SQL, I'll provide a simplified example for the `jobs` table:

```sql
CREATE TABLE IF NOT EXISTS jobs (
  id SERIAL PRIMARY KEY,
  status VARCHAR(255) NOT NULL,
  download_url TEXT NOT NULL,
  ttl_expiration TIMESTAMP WITH TIME ZONE NOT NULL,
  audit_receipt_reference TEXT,
  UNIQUE (id)
);

CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs (status);
CREATE INDEX IF NOT EXISTS jobs_ttl_expiration_idx ON jobs (ttl_expiration);

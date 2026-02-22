Here is the TypeScript code for the `ExportJob` contract as per your specifications:

```typescript
/**
 * ExportJob Contract
 */

export interface ExportJob {
  id: number;
  gameId: number;
  userId: number;
  format: 'pdf' | 'csv';
  state: 'pending' | 'processing' | 'completed' | 'failed';
  signedUrl?: string;
  retentionDays?: number;
}

export interface ExportJobRepository {
  create(job: Omit<ExportJob, 'id'>): Promise<ExportJob>;
  getById(id: number): Promise<ExportJob | null>;
  updateState(id: number, state: ExportJob['state']): Promise<void>;
  delete(id: number): Promise<void>;
}

export interface SignedUrlGenerator {
  generate(jobId: number): string;
}

export interface RetentionPolicy {
  retain(jobId: number, days: number): Promise<void>;
  purge(jobId: number): Promise<void>;
}

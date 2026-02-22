```typescript
import { Model } from 'mongoose';
import moment from 'moment-timezone';

type DocumentType = any;
interface DataRetentionConfig {
retentionDays: number;
}

export class AutomatedDeletionService<T extends DocumentType> {
private model: Model<T>;
private retentionConfig: DataRetentionConfig;

constructor(model: Model<T>, retentionConfig: DataRetentionConfig) {
this.model = model;
this.retentionConfig = retentionConfig;
}

async run() {
const now = moment().tz('America/Los_Angeles');
await this.model.deleteMany({ createdAt: { $lt: now.subtract(this.retentionConfig.retentionDays, 'days').toDate() } });
}
}
```

To use the service, you would create an instance with your Mongoose model and data retention configuration (number of days) like this:

```typescript
import mongoose from 'mongoose';
import { AutomatedDeletionService } from './automated-deletion-4';

const UserSchema = new mongoose.Schema({ /* ... */ });
const UserModel = mongoose.model('User', UserSchema);

const retentionConfig: DataRetentionConfig = {
retentionDays: 30, // example: retain user data for 30 days
};

const automatedDeletionService = new AutomatedDeletionService<any>(UserModel, retentionConfig);
automatedDeletionService.run().catch((error) => console.error(error));
```

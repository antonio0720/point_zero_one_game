```typescript
import axios from 'axios';
import { Settlement } from './models/Settlement';

async function createSettlement(settlementData: Settlement): Promise<Settlement> {
const response = await axios.post('/api/settlements', settlementData);
return response.data;
}
```

This code imports the `axios` library to make HTTP requests, and defines a function called `createSettlement` that takes a `settlementData` object of type `Settlement`. The function makes a POST request to the `/api/settlements` endpoint with the provided data, receives the response, and returns the settlement data from the response.

Assuming you have a `Settlement` model defined in a file called `models/Settlement.ts`, it might look something like this:

```typescript
export interface Settlement {
id?: number;
partyA?: string;
partyB?: string;
amount?: number;
}
```

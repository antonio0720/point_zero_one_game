```typescript
import { ISettlement } from './interfaces/ISettlement';

export async function createSettlement(settlementData: ISettlement, settlementRepository: any): Promise<ISettlement> {
const createdSettlement = await settlementRepository.create(settlementData);
return createdSettlement;
}
```

In this example, the `ISettlement` interface represents a type for the settlement data, and the `settlementRepository` is an injected dependency that provides database operations related to settlements. The function `createSettlement` takes in settlementData and settlementRepository as parameters and returns the created settlement record after it has been persisted in the database.

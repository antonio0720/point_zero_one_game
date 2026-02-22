import { ClientGrpc } from '@nestjs/microservices';
import { EntitlementResponse } from './dto';
import { EntitlementServiceGrpc } from './entitlement.pb';

@Injectable()
export class EntitlementsClient {
constructor(private readonly client: ClientGrpc) {}

private entitlementService = new EntitlementServiceGrpc(this.client);

async checkEntitlement(customerId: string): Promise<EntitlementResponse> {
const customerEntitlement = await this.entitlementService.check({ customerId });
return customerEntitlement.toObject();
}
}

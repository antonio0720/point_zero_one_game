import { Injectable } from '@nestjs/common';
import { Policy, User, Resource } from './interfaces';

interface PolicyFunction<TUser extends User, TResource extends Resource> {
(user: TUser, resource: TResource): boolean;
}

@Injectable()
export class PolicyEngine {
private policies: Map<string, PolicyFunction<User, Resource>> = new Map();

public registerPolicy(policyId: string, policyFunction: PolicyFunction<User, Resource>) {
this.policies.set(policyId, policyFunction);
}

public hasAccess(userId: string, resourceId: string, policyId?: string): boolean {
const user = { id: userId } as User;
const resource = { id: resourceId } as Resource;

if (policyId) {
const policyFunction = this.policies.get(policyId);
return policyFunction ? policyFunction(user, resource) : false;
}

// Default policy implementation. Customize this to suit your needs.
return user.role === 'admin';
}
}

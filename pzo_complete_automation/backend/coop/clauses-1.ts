interface CoopContract {
id: string;
cooperatorId: string;
propertyAddress: string;
startDate: Date;
endDate?: Date;
clauses: Clause[];
}

enum ClauseType {
Lease = 'Lease',
MaintenanceResponsibilities = 'Maintenance Responsibilities',
RentPayments = 'Rent Payments',
Subletting = 'Subletting',
PetPolicy = 'Pet Policy'
}

interface Clause {
id: string;
type: ClauseType;
description: string;
additionalDetails?: string;
}

const leaseClause: Clause = {
id: 'lease-1',
type: ClauseType.Lease,
description: 'The cooperator will occupy the property as their primary residence for the duration of the contract.',
};

const maintenanceResponsibilitiesClause: Clause = {
id: 'maintenance-1',
type: ClauseType.MaintenanceResponsibilities,
description: 'The landlord is responsible for all exterior and major appliance maintenance.',
};

// Add more clauses as needed...

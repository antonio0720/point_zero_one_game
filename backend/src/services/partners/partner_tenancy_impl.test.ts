import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PartnerTenancyImpl } from '../partner_tenancy_impl';
import { Partner, Tenant, Role, Permission } from '../../models';
import { createTestingConnections, closeTestingConnections } from '../../utils/test-utils';
import { getConnection } from 'typeorm';

describe('PartnerTenancyImpl', () => {
  let partnerTenancy: PartnerTenancyImpl;
  let partner1: Partner;
  let tenant1: Tenant;
  let tenant2: Tenant;
  let roleAdmin: Role;
  let roleUser: Role;
  let permissionRead: Permission;
  let permissionWrite: Permission;

  beforeEach(async () => {
    await createTestingConnections();
    partnerTenancy = new PartnerTenancyImpl();

    // Create test data
    const connection = getConnection();
    await connection.createQueryBuilder('role').delete().execute();
    await connection.createQueryBuilder('permission').delete().execute();
    await connection.createQueryBuilder('tenant').delete().execute();
    await connection.createQueryBuilder('partner').delete().execute();

    roleAdmin = await connection.manager.save(Role, { name: 'admin' });
    roleUser = await connection.manager.save(Role, { name: 'user' });
    permissionRead = await connection.manager.save(Permission, { name: 'read' });
    permissionWrite = await connection.manager.save(Permission, { name: 'write' });

    tenant1 = await connection.manager.save(Tenant, { name: 'tenant1', roleId: roleAdmin.id });
    tenant2 = await connection.manager.save(Tenant, { name: 'tenant2', roleId: roleUser.id });

    partner1 = await connection.manager.save(Partner, {
      name: 'partner1',
      tenants: [tenant1],
      roles: [roleAdmin],
      permissions: [permissionRead, permissionWrite],
    });
  });

  afterEach(async () => {
    await closeTestingConnections();
  });

  it('should assign correct roles and permissions to partner', async () => {
    const partner = await partnerTenancy.getPartnerById(partner1.id);
    expect(partner).not.toBeNull();
    expect(partner?.roles).toHaveLength(1);
    expect(partner?.permissions).toHaveLength(2);
    expect(partner?.tenants).toHaveLength(1);
  });

  it('should return null if partner not found', async () => {
    const nonExistentPartnerId = 9999;
    const partner = await partnerTenancy.getPartnerById(nonExistentPartnerId);
    expect(partner).toBeNull();
  });

  it('should route requests to correct tenant based on partner and resource', async () => {
    // Happy path: request to a resource owned by tenant1
    const tenant1Resource = await partnerTenancy.getTenantById(tenant1.id);
    expect(tenant1Resource).not.toBeNull();
    expect(tenant1Resource?.partners).toHaveLength(1);
    expect(tenant1Resource?.partners[0].id).toEqual(partner1.id);

    // Edge case: request to a resource not owned by any tenant
    const nonOwnedResource = await partnerTenancy.getTenantById(9999);
    expect(nonOwnedResource).toBeNull();

    // Boundary condition: request to a resource owned by tenant2 (different role)
    const tenant2Resource = await partnerTenancy.getTenantById(tenant2.id);
    expect(tenant2Resource).not.toBeNull();
    expect(tenant2Resource?.partners).toHaveLength(0);
  });

  it('should log audit entries for all actions', async () => {
    // Happy path: create partner
    await partnerTenancy.createPartner({ name: 'newPartner' });

    const auditLogs = await getConnection()
      .createQueryBuilder('audit_log')
      .where('action like :action', { action: '%createPartner%' })
      .getMany();
    expect(auditLogs).toHaveLength(1);

    // Edge case: update partner (should not exist yet)
    await expect(partnerTenancy.updatePartner(9999, { name: 'updatedPartner' })).rejects.toThrow();

    // Boundary condition: delete partner (should not exist yet)
    await expect(partnerTenancy.deletePartner(9999)).rejects.toThrow();
  });
});

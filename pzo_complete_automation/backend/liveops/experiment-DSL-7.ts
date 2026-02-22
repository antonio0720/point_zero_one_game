import { ExperimentClient } from '@azure/arm-livevideostream';
import { ResourceManagementClient, ArmResource, DeploymentMode, SubscriptionCredentials } from '@azure/arm-resources';
import { ManagedApplicationCreateOrUpdateParameters } from '@azure/arm-managedapps';
import * as dotenv from 'dotenv';

dotenv.config();

const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
const tenantId = process.env.AZURE_TENANT_ID;
const clientId = process.env.AZURE_CLIENT_ID;
const clientSecret = process.env.AZURE_CLIENT_SECRET;

const credentials: SubscriptionCredentials = new ClientSecretCredential(tenantId, clientId, clientSecret);
const resourceManagementClient = new ResourceManagementClient(credentials, subscriptionId);
const experimentClient = new ExperimentClient(credentials, subscriptionId);

async function createExperiment() {
const resourceGroupParams: ArmResource.ResourceGroupParameters = {
location: 'eastus',
properties: {}
};

const resourceGroupResult = await resourceManagementClient.resourceGroups.createOrUpdate(
'rg-experiment-dsl-7',
resourceGroupParams
);

console.log(`Resource group created with name: ${resourceGroupResult.name}`);

const managedApplicationCreateOrUpdateParameters: ManagedApplicationCreateOrUpdateParameters = {
location: 'eastus',
properties: {
properties: {
applicationType: 'LiveVideoAnalytics',
artifactsLocation: {
id: resourceGroupResult.location + '/providers/Microsoft.Resources/resourceGroups/' + resourceGroupResult.name + '/providers/Microsoft.Devices/artifacts/lva-app'
},
sku: {
name: 'STANDARD_F0',
tier: 'Basic'
},
virtualNetworkConfig: {
id: resourceGroupResult.id,
subnetId: 'subnet-1'
}
},
deploymentMode: DeploymentMode.Incremental
}
};

const managedApplicationResult = await experimentClient.managedApplications.createOrUpdate(
'managedApp-experiment-dsl-7',
resourceGroupResult.id,
managedApplicationCreateOrUpdateParameters
);

console.log(`Managed Application created with name: ${managedApplicationResult.name}`);
}

createExperiment().catch((err) => {
console.error(err);
});

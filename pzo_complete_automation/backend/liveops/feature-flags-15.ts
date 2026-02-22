import { DocumentNode, gql } from 'graphql-tag';
import { makeVar, graphqlOperation } from 'aws-amplify';
import AWSAppSyncClient from 'aws-amplify/dist/api/aws-appsync';

const API = new AWSAppSyncClient({ url: 'YOUR_API_URL' });

// Define your feature flags as GraphQL schema
const FEATURE_FLAGS_SCHEMA = gql`
type Query {
getFeatureFlag(name: String!): FeatureFlag
}

type Mutation {
setFeatureFlag(name: String!, value: Boolean!): Boolean
}

type FeatureFlag {
name: String!
value: Boolean!
}
`;

// Define your feature flag variables
const featureFlags = makeVar({});

const getFeatureFlagQuery = graphqlOperation(gql`
query GetFeatureFlag($name: String!) {
getFeatureFlag(name: $name) { name value }
}
`);

const setFeatureFlagMutation = graphqlOperation(gql`
mutation SetFeatureFlag($name: String!, $value: Boolean!) {
setFeatureFlag(name: $name, value: $value)
}
`);

export const getFeatureFlag = async (name: string): Promise<boolean> => {
const data = await API.query({
query: getFeatureFlagQuery,
variables: { name },
});

if (!data.errors && data.data.getFeatureFlag) {
featureFlags[name] = data.data.getFeatureFlag.value;
return data.data.getFeatureFlag.value;
}

throw new Error(`Error fetching feature flag "${name}"`);
};

export const setFeatureFlag = async (name: string, value: boolean): Promise<void> => {
await API.mutate({
mutation: setFeatureFlagMutation,
variables: { name, value },
});

featureFlags[name] = value;
};

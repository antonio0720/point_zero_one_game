import { DocumentNode, gql } from 'graphql';
import { ApolloServer, gql as apolloGQL } from 'apollo-server-express';

type FeatureFlag = {
key: string;
value: boolean;
};

const typeDefs = gql`
type Query {
getFeatureFlag(key: String!): Boolean!
}

type Mutation {
setFeatureFlag(key: String!, value: Boolean!): Boolean!
}
`;

const resolvers = {
Query: {
getFeatureFlag: (_, { key }) => {
const featureFlags = getFeatureFlags(); // Fetch feature flags from storage
return featureFlags.find((flag) => flag.key === key)?.value || false;
},
},
Mutation: {
setFeatureFlag: (_, { key, value }) => {
const featureFlags = getFeatureFlags(); // Fetch and update feature flags in storage
const index = featureFlags.findIndex((flag) => flag.key === key);

if (index !== -1) {
featureFlags[index].value = value;
} else {
featureFlags.push({ key, value });
}

return true;
},
},
};

function getFeatureFlags(): FeatureFlag[] {
// Implement your own storage here, such as reading from a database or config management system.
const featureFlags: FeatureFlag[] = [
{ key: 'example_feature_flag', value: true },
// Add more flags as needed
];
return featureFlags;
}

const server = new ApolloServer({ typeDefs, resolvers });
export default server;

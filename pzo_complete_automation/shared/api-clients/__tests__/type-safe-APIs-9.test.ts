import { Test, TestingModule } from '@nestjs/testing';
import { Client as OpenAPIV3Client, DocumentNode } from 'graphql';
import { createSchemaFactory, execute, GraphQLSchema } from 'graphql-tools';
import { TypeSafeAPIGenerator, gql } from './type-safe-api.generator';

describe('TypeSafeAPI Generator', () => {
let schema: GraphQLSchema;
let client: OpenAPIV3Client;
let typeSafeAPI: any;

beforeEach(async () => {
const moduleRef = await Test.createTestingModule({}).compile();

schema = createSchemaFactory({ typeDefs: /* your GraphQL schema */ }).createSchema();
client = new OpenAPIV3Client({ url: 'http://localhost:3000/graphql' });
typeSafeAPI = TypeSafeAPIGenerator.generate(schema, client);
});

it('should generate correctly typed API clients', () => {
// Test case for generating and using a query
const query = gql`
query GetUser($id: ID!) {
user(id: $id) {
id
name
}
}
`;

const result = execute({ schema, source: query, variableValues: { id: '1' } });
expect(result).toEqual({
data: {
user: {
id: expect.any(String),
name: expect.any(String)
}
}
});
});

// Add more test cases for mutations, subscriptions, and other types of operations as needed
});

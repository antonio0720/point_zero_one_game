import { Client } from '../../src/client';
import { ApiDefinition } from '../../src/api-definition';
import { expectTypeOf, haveProperty } from 'expect-type';

describe('Client foundations - type-safe APIs', () => {
const apiDefinition: ApiDefinition = {
baseUrl: 'https://example.com/api',
resources: {
users: {
getUserById: {
method: 'GET',
path: '/users/{id}',
responseType: 'json'
}
}
}
};

const client = new Client(apiDefinition);

it('should have a getUserById function', () => {
expectTypeOf(client.getUserById)
.toEqualType<(id: number) => Promise<{ id: number; name: string }>>();
});

it('should return correct type for getUserById response', () => {
const user = client.getUserById(1);

expectTypeOf(user).toEqualType<Promise<{ id: number; name: string }>>();
});

it('should have expected properties on getUserById response', () => {
const user = client.getUserById(1);

expect(user).toHaveProperty('id');
expect(user).toHaveProperty('name');
});
});

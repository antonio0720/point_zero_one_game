import { createClient, GqlContextMenu, GqlError, GqlFetchFunction, GqlQueryResolver } from 'graphql-request';
import { gql } from 'graphql-tag';
import { API_URL } from './config';

type Maybe<T> = T | null;
type InputMaybe<T> = Maybe<T>;
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };

export type CreatorShell2QueryVariables = Exact<{
id?: InputMaybe<string>;
}>;

export type CreatorShell2Query = {
__typename?: string;
creatorShell2?: Maybe<{
__typename?: string;
id: string;
name: string;
description: string;
createdAt: string;
updatedAt: string;
items?: Maybe<Array<Maybe<{
__typename?: string;
id: string;
name: string;
description: string;
value: string;
createdAt: string;
updatedAt: string;
}>>>;
}>;
};

export type CreatorShell2MutationVariables = Exact<{
input: {
id?: InputMaybe<string>;
name?: InputMaybe<string>;
description?: InputMaybe<string>;
};
}>;

export type CreatorShell2Mutation = (
{ __typename?: string } & {
creatorShell2?: Maybe<{
__typename?: string;
id: string;
name: string;
description: string;
createdAt: string;
updatedAt: string;
items?: Maybe<Array<Maybe<{
__typename?: string;
id: string;
name: string;
description: string;
value: string;
createdAt: string;
updatedAt: string;
}>>>;
}> & { __typename?: 'MutationRoot' };
}
);

const defaultFetch: GqlFetchFunction = (url, variables = {}, headers) =>
fetch(url, {
method: 'POST',
headers: {
...headers,
'Content-Type': 'application/json',
},
body: JSON.stringify({ query: url, variables }),
}).then((response) => response.json());

const client = createClient<GqlQueryResolver<any>, GqlContextMenu>({
url: API_URL,
fetch: defaultFetch,
});

export const CreatorShell2Document = gql`
query CreatorShell2($id: String) {
creatorShell2(id: $id) {
id
name
description
createdAt
updatedAt
items {
id
name
description
value
createdAt
updatedAt
}
}
}
`;

export const CreatorShell2MutationDocument = gql`
mutation CreatorShell2Mutation($input: CreatorShell2Input!) {
creatorShell2(input: $input) {
id
name
description
createdAt
updatedAt
items {
id
name
description
value
createdAt
updatedAt
}
}
}
`;

export type CreatorShell2QueryResult = ReturnType<typeof CreatorShell2Document.query>;
export type CreatorShell2MutationResult = ReturnType<typeof CreatorShell2MutationDocument.mutate>;

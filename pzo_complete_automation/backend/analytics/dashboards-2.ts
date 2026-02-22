1. Install necessary dependencies:

```bash
npm install --save apollo-angular @apollo/client graphql mockserviceworker
```

2. Configure Apollo in your Angular module:

app.module.ts:

```typescript
import { ApolloModule } from 'apollo-angular';
import { HttpLink } from 'apollo-link-http';
import { InMemoryCache, IntrospectionFragmentMatcher } from 'apollo-cache-inmemory';
import { createHttpLink } from 'apollo-link-http';
import { onError } from 'apollo-link-error';
import { ApolloLink } from 'apollo-link';
import introspectionQuery from 'graphql/tag/introspection-query';
import fragmentMatcher from './fragment-matcher';

const httpLink = createHttpLink({
uri: '/graphql',
});

const link = ApolloLink.from([
onError(({ graphQLErrors, networkError }) => {
if (graphQLErrors)
graphQLErrors.map(({ message, locations, path }) =>
console.log(
`[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`
)
);
if (networkError) console.log(`[Network error]: ${networkError}`);
}),
httpLink,
]);

const cache = new InMemoryCache({
typePolicies: {
Query: {
fields: {
// Add your custom type policies here for caching
},
},
},
});

export const createApollo = () => ({
link,
cache,
});

const fragmentMatcher = new IntrospectionFragmentMatcher({
introspectionQuery,
});

@NgModule({
imports: [
ApolloModule.forRoot({
link,
cache,
introspect: true,
fragmentMatcher,
defaultOptions: { watchQuery: { fetchPolicy: 'no-cache' } },
}),
],
})
export class GraphQLModule {}
```

3. Create a GraphQL schema and mocks for the data sources:

schemas/schema.graphql:

```graphql
type Query {
getDashboardData: DashboardData!
}

type DashboardData {
// Define your dashboard data types here
}
```

mock-data-sources/dashboard-data-source.ts:

```typescript
import { InMemoryCache } from 'apollo-cache-inmemory';
import { makeVar } from '@apollo/client';

let cache = new InMemoryCache();
export const dashboardData = makeVar({});

const resolvers = {
Query: {
getDashboardData: () => dashboardData(),
},
};

cache.writeData({ data: { dashboardData } });

export default {
schema: {
query: resolvers,
},
resolvers,
};
```

4. Mock the GraphQL server with Mock Service Worker:

mockServiceWorker.js:

```javascript
import { mockDataSources } from './mock-data-sources';
import { ApolloServer, gql } from 'apollo-server';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { IntrospectionHandler } from 'graphql/utilities/introspection';
import { print } from 'graphql/language/printer';
import { introspectionQuery } from 'graphql/tag/introspection-query';

const typeDefs = gql`
${print(introspectionQuery)}
${mockDataSources.schema.queries[0].definitions.join('\n')}
type Mutation {
// Add any mutations you need here
}
`;

const schema = makeExecutableSchema({
typeDefs,
resolvers: [...mockDataSources.resolvers.queries[0].possibleTypes],
});

const introspectionHandler = new IntrospectionHandler(schema);
const introspectionTypeDefs = introspectionHandler.parse(`
schema {
query: Query
mutation: Mutation
}
`);

const server = new ApolloServer({
typeDefs: [introspectionTypeDefs, typeDefs],
});

self.__APOLLO_SERVICE__ = server.globby('**/*.graphql');
server.start();
```

5. Create a dashboard component to display data:

dashboards-2.component.ts:

```typescript
import { Component } from '@angular/core';
import gql from 'graphql-tag';
import { Apollo, gql as GraphQLTag } from 'apollo-angular';

export const GET_DASHBOARD_DATA = gql`
query GetDashboardData {
getDashboardData {
// Define your dashboard data queries here
}
}
`;

@Component({
selector: 'app-dashboards-2',
templateUrl: './dashboards-2.component.html',
})
export class Dashboards2Component {
dashboardData$;

constructor(private apollo: Apollo) {}

ionViewWillEnter() {
this.apollo
.watchQuery<any>({ query: GET_DASHBOARD_DATA })
.valueChanges.subscribe((result) => {
this.dashboardData$ = result.data.getDashboardData;
});
}
}
```

6. Define the HTML template for your dashboard component:

dashboards-2.component.html:

```html
<ion-card *ngIf="dashboardData$">
<ion-card-header>
<ion-card-title>Dashboards 2</ion-card-title>
</ion-card-header>

<!-- Display your dashboard data here -->
</ion-card>
```

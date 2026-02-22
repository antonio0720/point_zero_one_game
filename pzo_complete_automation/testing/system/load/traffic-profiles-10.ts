```typescript
export const trafficProfiles = [
{
users: 10,
seconds: 60,
},
// More profiles here...
];
```

You should also have a running express application in `app.ts`. This example assumes the root endpoint (`/`) of your application is being tested with each profile. Adjust the code as needed to fit your specific application and testing requirements.

To run the tests, you can use the following command:

```sh
mocha --compilers ts:ts-mocha test/**/*.spec.ts
```

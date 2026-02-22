```bash
npm install --save-dev jest ts-jest @types/jest typescript
```

Then, update the `jestConfig.json` file to include the necessary configurations for TypeScript support:

```json
{
"preset": "ts-jest",
"testEnvironment": "node"
}
```

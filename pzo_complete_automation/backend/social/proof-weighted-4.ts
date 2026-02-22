```bash
npm i redis
```

Don't forget to connect to your Redis server in your main application file. Here's an example:

```typescript
redisClient.on('error', (err) => {
console.log(`Error connecting to Redis: ${err}`);
});

redisClient.connect();
```

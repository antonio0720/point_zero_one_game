```sh
wrk -t 10 -c 50 -d 30s 'http://your-endpoint.com/api/path'
```

Chaos engineering with failures can be achieved by introducing delays, network hiccups, and other unexpected conditions into the simulation using libraries like `chaossimulator`. This library allows you to simulate various chaos scenarios, such as:

- Network latency and packet loss
- Server errors (5xx status codes)
- Client disconnects
- Custom response time variations

For more information on how to use `chaossimulator`, please refer to the official documentation: https://github.com/GoogleCloudPlatform/chaos-simulator

Failure Injection Testing (FIT) - Scenario 8
=============================================

This document outlines the eighth scenario for Failure Injection Testing (FIT), a method used to evaluate system resilience under various failure conditions.

Scenario Overview
------------------

In this scenario, we will introduce the following failures:

1. Network packet loss
2. Random host failures
3. Latency spikes
4. Connection timeouts

### Network Packet Loss

Packet loss is simulated by dropping a percentage of incoming packets. This can be used to test how applications handle network disruptions.

#### Configuration

- Utilize a network emulator such as [Docker network plugin](https://github.com/docker/docker-ce-stretch-dind) or [Taurus](https://taurusproject.io/) to manipulate network traffic.
- Configure the emulator to drop a specific percentage of packets between the client and server. For example, setting 1% packet loss would mean that one out of every hundred packets sent would not reach its destination.

### Random Host Failures

Random host failures simulate hardware or software issues on various nodes within the system. This can help identify weak points in the system architecture.

#### Configuration

- Use a tool like [Apache JMeter's distributed test mode](https://jmeter.apache.org/usermanual/beyond_the_basics_multiple_load_generators.html) to simulate numerous clients that can randomly fail during the load test.
- Configure JMeter to terminate a client after a specific failure rate is reached, simulating host failures.

### Latency Spikes

Latency spikes can be used to assess the system's ability to handle increased response times caused by various factors such as network congestion or slow database queries.

#### Configuration

- Configure your network emulator to introduce random latency spikes during the load test.
- Set varying degrees of latency increases to simulate different network conditions.

### Connection Timeouts

Connection timeouts help identify issues with the application's ability to handle intermittent connections or reconnect after temporary failures.

#### Configuration

- Configure your load testing tool (e.g., JMeter, Gatling) to simulate connection timeouts by setting longer timeout intervals than usual.
- Monitor how the system handles these timeouts and ensure that it recovers gracefully.

Running the Test
-----------------

1. Set up your environment according to the scenario's configuration requirements.
2. Run the load test, simulating the desired failure conditions.
3. Analyze the results to identify any issues or areas for improvement in the system's resilience.
4. Implement changes and re-run the test to verify improvements in the system's performance under stress and chaos conditions.

# Session 6: WebSocket Server Phase 4

## Overview
In this session, we will configure and test the WebSocket server to enable real-time communication between clients and the server.

## Prerequisites
* The PZO_Master_Build_Guide has been completed up to Session 5.
* The WebSocket server configuration file (`pzo-websocket-server.conf`) is available in the `conf` directory.

## Commands

### Step 1: Configure WebSocket Server

```bash
sudo cp conf/pzo-websocket-server.conf /etc/pzo/pzo-websocket-server.conf
```

### Step 2: Restart WebSocket Server Service

```bash
sudo systemctl restart pzo-websocket-server.service
```

### Step 3: Verify WebSocket Server Configuration

```bash
sudo pzo-websocket-server -c /etc/pzo/pzo-websocket-server.conf --version
```

## Done Criteria
The WebSocket server is configured and running, as verified by the output of the `pzo-websocket-server` command.

## Smoke Tests

### Step 1: Test WebSocket Connection

* Use a WebSocket client (e.g., `wscat`) to connect to the WebSocket server:
```bash
wscat -c ws://localhost:8080/pzo/websocket
```
* Verify that the connection is established and data can be sent and received.

### Step 2: Test Real-Time Communication

* Use a WebSocket client (e.g., `wscat`) to send a message to the WebSocket server:
```bash
echo "Hello, world!" | wscat -c ws://localhost:8080/pzo/websocket
```
* Verify that the message is received by the WebSocket server and echoed back to the client.

## Next Steps
The WebSocket server is now configured and tested. Proceed to Session 7 to configure and test the PZO Client.

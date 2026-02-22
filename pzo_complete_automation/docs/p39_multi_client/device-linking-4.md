Multi-client Sync + Handoff
===========================

Overview
--------

Multi-client sync allows multiple devices to stay in sync with the same project or document, while multi-client handoff enables seamless transition of work between devices and users. This guide provides an overview of how to implement both features in your application using Device Linking 4.

Prerequisites
-------------

Before diving into multi-client sync and handoff, ensure you have:

1. Integrated Device Linking 4 into your app as described in the [Device Linking 4 documentation](https://docs.microsoft.com/en-us/azure/devices/remote-render/device-linking-4).
2. Enabled Multi-client sync and Handoff capabilities by setting the following flags in `AzureRemoteRenderClientOptions`:
```csharp
var options = new AzureRemoteRenderClientOptions()
.SetMultiClientHandoffEnabled(true)
.SetMultiClientSyncEnabled(true);
```

Setting up Multi-client Sync
-----------------------------

To set up multi-client sync, you need to establish a shared session between the devices that will be collaborating. This can be done using the `AzureRemoteRenderSession` API.

### Create a new shared session

To create a new shared session, initiate a connection to the Azure Remote Rendering service and pass the required flags:

```csharp
var client = new AzureRemoteRenderingClient(options);
var session = await client.CreateSessionAsync("shared-session-id", "My Shared Session");
```

### Join an existing shared session

To join an existing shared session, first retrieve the session details and then initiate a connection to the Azure Remote Rendering service with the appropriate flags:

```csharp
var sessionDetails = await client.GetSessionDetailsAsync("shared-session-id");
await client.JoinSessionAsync(sessionDetails);
```

### Syncing user actions across devices

With a shared session established, you can now synchronize user actions between the participating devices. To do this, capture events in your application that should be synchronized and send them to the Azure Remote Rendering service using the `AzureRemoteRenderingClient` API:

```csharp
// Capture a mouse click event in your app
void OnMouseClick(...) {
var action = new UserInputAction() {
Type = "mouse_click",
X = ...,
Y = ...
};

await client.SendUserInputAsync(action);
}
```

### Receiving and processing synchronized user actions

On each device participating in the shared session, you can listen for incoming user input events using the `AzureRemoteRenderingClient` API:

```csharp
client.OnUserInputReceived += OnUserInputReceived;

void OnUserInputReceived(UserInputAction action) {
// Process the received user input event on this device
}
```

Setting up Multi-client Handoff
-------------------------------

To set up multi-client handoff, you need to establish a connection between the devices that will be involved in the handoff process. This can be done using the `AzureRemoteRenderClient` API.

### Initiating a handoff request

To initiate a handoff request from one device (source), send a request to the target device containing the relevant project and user input data:

```csharp
var handoffRequest = new HandoffRequest() {
SessionId = "shared-session-id",
UserInput = GetUserInput(), // Serialized user input data
ProjectData = GetProjectData(), // Serialized project data
};

await client.SendHandoffRequestAsync(handoffRequest);
```

### Receiving and processing a handoff request

On the target device, listen for incoming handoff requests using the `AzureRemoteRenderingClient` API:

```csharp
client.OnHandoffRequestReceived += OnHandoffRequestReceived;

void OnHandoffRequestReceived(HandoffRequest handoffRequest) {
// Deserialize and process the handoff request on this device
}
```

Conclusion
----------

By implementing multi-client sync and handoff in your application using Device Linking 4, you can enable real-time collaboration between multiple users and devices. This allows for more efficient and effective workflows in a variety of industries, such as architecture, engineering, and design.

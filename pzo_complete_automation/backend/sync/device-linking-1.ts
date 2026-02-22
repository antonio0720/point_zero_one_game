import { Client, ClusterClient } from 'colyseus';
import { Room } from 'colyseus/room';

interface DeviceLink {
userId: string;
deviceId: string;
}

class LinkingRoom extends Room {
devices: Set<DeviceLink> = new Set();

onJoin(client: Client) {
const deviceId = client.sessionId;
this.devices.add({ userId: client.state.userId, deviceId });

// Notify other connected devices about the new connection
for (const [, otherClient] of this.state.clients) {
if (otherClient !== client) {
otherClient.send('new-device', { userId: client.state.userId, deviceId });
}
}
}

onLeave(client: Client, consented: boolean) {
if (consented) {
const deviceToRemove = this.devices.find(({ deviceId }) => deviceId === client.sessionId);
if (deviceToRemove) {
this.devices.delete(deviceToRemove);

// Notify other connected devices about the disconnection
for (const [, otherClient] of this.state.clients) {
if (otherClient !== client) {
otherClient.send('device-left', deviceToRemove);
}
}
}
}
}
}

// Initialize the room and start it on port 2569
const linkingRoom = new LinkingRoom();
linkingRoom.createOrJoin('deviceLinking1');

export const colyseusCluster = new ClusterClient({
port: 2569,
});
colyseusCluster.joinOrCreate('deviceLinking1', LinkingRoom);

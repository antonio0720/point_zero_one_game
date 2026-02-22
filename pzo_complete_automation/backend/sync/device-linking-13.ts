import { DeviceLinkingClient } from '@google-cloud/device-linking';

const client = new DeviceLinkingClient({
keyFilename: 'path/to/your-private-key.json', // Replace with your private key file path
projectId: 'your-project-id' // Replace with your Google Cloud project ID
});

interface Link {
linkId: string;
appId: string;
}

// Generate a new device link for the given app ID
async function generateLink(appId: string): Promise<Link> {
const response = await client.createDevice({ appId });
return { linkId: response.link, appId };
}

// Associate an existing device with a previously generated link
async function associateDevice(link: Link, token: string) {
await client.associateDeviceWithLink({ link, registrationToken: token });
}

// Unlink a device from a link
async function unlinkDevice(linkId: string, appId: string) {
await client.unlinkDeviceFromApp({ linkId, appId });
}

// Handoff: Transfer ownership of the linked device from one client to another
async function handoffLink(sourceClientId: string, targetClientId: string, link: Link) {
const { appId } = link;
await unlinkDeviceFromApp(link.linkId, appId);
await associateDevice(link, sourceClientId);
await associateDevice(link, targetClientId);
}

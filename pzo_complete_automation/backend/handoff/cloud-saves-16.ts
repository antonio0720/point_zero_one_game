import { CloudSaves, Handoff } from '@dcl/sdk';

// Initialize Cloud Saves and Handoff clients
const cloudSaves = new CloudSaves({ apiKey: 'YOUR_API_KEY' });
const handoffClient = new Handoff(cloudSaves);

async function handleHandoffEvent(event: any) {
const { sessionId, state } = event;
await handoffClient.acceptSession(sessionId, state);
}

// Subscribe to handoff events
handoffClient.on('event', handleHandoffEvent);

async function saveState() {
const state = { playerPosition: 100, score: 500 };
await cloudSaves.save('playerState', state);
}

function loadState(callback: (state: any) => void) {
cloudSaves.get('playerState').then((data) => callback(JSON.parse(data)));
}

// Example usage of saveState and loadState functions
saveState();
loadState((state) => console.log(`Player position: ${state.playerPosition}, Score: ${state.score}`));

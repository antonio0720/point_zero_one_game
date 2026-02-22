import * as React from 'react';
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styles from './OBSIntegration11.module.css';

// Assuming you have OBS specific libraries installed and available
import obsClient from 'obs-websocket-js';

const OBS_ADDRESS = 'localhost:4444'; // Replace with your actual OBS address

interface State {
obsClient?: obsClient.Browser;
streamKey?: string;
}

export default function OBSIntegration11() {
const [state, setState] = React.useState<State>({});
const dispatch = useDispatch();
const streamKey = useSelector((state: any) => state.streamKey);

useEffect(() => {
if (!state.obsClient) {
const obs = new obsClient(OBS_ADDRESS);

obs.connect({ logLevel: 1 }).then((client) => {
setState((prevState) => ({ ...prevState, obsClient: client }));

client.on('sceneChanged', () => {
if (streamKey) {
client.sendCustomMessage('/streamer/publish', JSON.stringify({ streamKey }));
}
});
});
}
}, [state.obsClient, streamKey]);

useEffect(() => {
if (state.obsClient) {
state.obsClient.sendCustomMessage('/streamer/getStreamKey', '').then((data) => {
const streamKey = JSON.parse(data.data).streamkey;
dispatch({ type: 'SET_STREAM_KEY', payload: streamKey });
setState((prevState) => ({ ...prevState, streamKey }));
});
}
}, [state.obsClient]);

return null;
}

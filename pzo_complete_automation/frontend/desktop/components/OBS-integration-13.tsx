import * as React from 'react';
import obs from 'react-obs';

interface Props {
serverUrl: string;
streamKey: string;
}

class OBSIntegration extends React.Component<Props> {
private obs = obs();

componentDidMount() {
this.startStream();
}

componentWillUnmount() {
this.stopStream();
}

startStream() {
this.obs.connect({ url: this.props.serverUrl, streamKey: this.props.streamKey })
.then(() => console.log('Successfully started streaming.'))
.catch((error) => console.error(`Error starting stream: ${error}`));
}

stopStream() {
this.obs.disconnect().then(() => console.log('Successfully stopped streaming.'))
.catch((error) => console.error(`Error stopping stream: ${error}`));
}

render() {
return null;
}
}

export default OBSIntegration;

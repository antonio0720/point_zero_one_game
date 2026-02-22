import * as React from 'react';
import styles from './OBSIntegration8.module.css';

interface Props {
onStartStreaming: () => void;
onStopStreaming: () => void;
}

const OBSIntegration8: React.FC<Props> = ({ onStartStreaming, onStopStreaming }) => {
const startStreaming = () => {
onStartStreaming();
};

const stopStreaming = () => {
onStopStreamming();
};

return (
<div className={styles.obsIntegration}>
<button onClick={startStreaming} className={styles.startButton}>
Start Streaming
</button>
<button onClick={stopStreaming} className={styles.stopButton}>
Stop Streaming
</button>
</div>
);
};

export default OBSIntegration8;

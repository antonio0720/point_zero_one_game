import React from 'react';
import { Button } from '@material-ui/core';

type Props = {
startTraining: () => void;
};

const PracticeSandbox2: React.FC<Props> = ({ startTraining }) => (
<div style={{ padding: '2rem' }}>
<h2>Practice Sandbox 2</h2>
<p>
</p>
<Button variant="contained" color="primary" onClick={startTraining}>
Start Practice
</Button>
</div>
);

export default PracticeSandbox2;

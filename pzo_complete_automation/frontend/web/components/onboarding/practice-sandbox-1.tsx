import React from 'react';
import styles from './PracticeSandbox1.module.css';

interface Props { }

const PracticeSandbox1: React.FC<Props> = () => {
return (
<div className={styles.container}>
<h2>Welcome to the Practice Sandbox 1</h2>
<p>This is a place for you to practice and learn new skills.</p>

{/* Add your interactive components here */}

<footer>
<button onClick={() => console.log('Next step')}>Next Step</button>
</footer>
</div>
);
};

export default PracticeSandbox1;

import * as React from 'react';
import styles from './publishing-workflow-1.module.css';

interface Props {
title: string;
stepNumber: number;
currentStep: number;
onNextClick: () => void;
}

const PublishingWorkflow1: React.FC<Props> = ({ title, stepNumber, currentStep, onNextClick }) => (
<div className={styles.publishingWorkflow}>
<h2>{title}</h2>
<p>Step {stepNumber}:</p>
{currentStep >= stepNumber ? (
<button className={styles.nextButton} onClick={onNextClick}>
Next
</button>
) : null}
</div>
);

export default PublishingWorkflow1;

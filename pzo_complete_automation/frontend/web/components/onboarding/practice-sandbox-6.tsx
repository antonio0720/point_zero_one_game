import React from 'react';
import styles from './PracticeSandbox6.module.scss';

interface PracticeSandbox6Props {
onComplete: () => void;
}

const PracticeSandbox6: React.FC<PracticeSandbox6Props> = ({ onComplete }) => {
const [currentStep, setCurrentStep] = React.useState(1);

const steps = [
{
id: 1,
title: 'Step 1',
content: (
<>
<p>Welcome to the Practice Sandbox 6! This is a training exercise designed to help you get comfortable with our platform.</p>
<ul>
<li>Find and click the "Next" button below to proceed to the next step.</li>
<li>Each step will provide you with a task or question to answer within the platform's interface.</li>
<li>Once you have completed all steps, a "Complete Training" button will appear. Click it to finish the training and receive a completion notification.</li>
</ul>
</>
),
},
{
id: 2,
title: 'Step 2',
content: (
<>
<p>In this step, we will practice adding a new widget to a dashboard.</p>
<ul>
<li>Navigate to the "Dashboards" section and select a dashboard you'd like to edit.</li>
<li>Click on the "Add Widget" button at the top of the dashboard.</li>
<li>Choose any widget from the list provided. For this exercise, we recommend using the "Table" or "Chart" widget.</li>
</ul>
</>
),
},
{
id: 3,
title: 'Step 3',
content: (
<>
<p>In this step, we will practice configuring a widget.</p>
<ul>
<li>After adding the widget to your dashboard, click on it to open its configuration options.</li>
<li>You can modify various settings such as the data source, visualization type, and display properties. Experiment with these options to familiarize yourself with the process.</li>
</ul>
</>
),
},
{
id: 4,
title: 'Step 4',
content: (
<>
<p>In this step, we will practice saving and publishing a dashboard.</p>
<ul>
<li>After configuring your widget, click on the "Save" button to save your changes.</li>
<li>If you'd like to share the dashboard with others, click on the "Publish" button.</li>
<li>You can also give your dashboard a name and description for easier organization in the "Dashboards" section.</li>
</ul>
</>
),
},
];

const NextButton = () => (
<button className={styles.nextButton} onClick={() => setCurrentStep((prev) => prev + 1)}>Next</button>
);

const CompleteTrainingButton = () => (
<button className={styles.completeTrainingButton} onClick={onComplete}>Complete Training</button>
);

return (
<div className={styles.container}>
{currentStep > steps.length ? <CompleteTrainingButton /> : null}
<div className={styles.stepContainer}>
<h2 className={styles.title}>{steps[currentStep - 1]?.title}</h2>
{steps[currentStep - 1]?.content}
</div>
{currentStep < steps.length ? <NextButton /> : null}
</div>
);
};

export default PracticeSandbox6;

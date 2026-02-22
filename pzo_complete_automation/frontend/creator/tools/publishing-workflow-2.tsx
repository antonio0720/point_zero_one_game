import * as React from 'react';
import { Publisher } from './Publisher';
import { PublishQueue } from './PublishQueue';
import { usePublishingContext, UsePublishingContextProps } from './context/PublishingContext';
import styles from './publishing-workflow-2.module.css';

const PublishingWorkflow2: React.FC = () => {
const publishingContext = usePublishingContext();

return (
<div className={styles.container}>
<Publisher />
<PublishQueue />
{publishingContext.isPublishing ? (
<div className={styles.spinnerContainer}>
<div className={styles.spinner}></div>
</div>
) : null}
</div>
);
};

export default PublishingWorkflow2;

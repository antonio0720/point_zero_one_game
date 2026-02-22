import React from 'react';
import { usePublishingWorkflow } from '@/hooks';

export const PublishingWorkflow = () => {
const { workflowState, publish, cancel } = usePublishingWorkflow();

return (
<div>
<h2>{workflowState.status}</h2>
{!workflowState.isLoading && (
<>
<button onClick={publish}>Publish</button>
<button onClick={cancel}>Cancel</button>
</>
)}
</div>
);
};

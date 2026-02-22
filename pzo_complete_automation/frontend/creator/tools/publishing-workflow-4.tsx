import React from 'react';
import { usePublishingWorkflowContext } from '@docusaurus/theme-common';
import { Button, Modal, Text, useModal } from '@docusaurus/theme-shared';

function PublishingWorkflow4(): JSX.Element {
const { isDirty, isPublished, hasErrors } = usePublishingWorkflowContext();
const [open, close] = useModal(true);

const handlePublish = () => {
if (isDirty && !hasErrors) {
// Call the API to publish content
// ...
close();
} else {
alert('Content is not ready for publishing. Please save and resolve all errors.');
}
};

return (
<>
{open && (
<Modal title="Publish Changes" onClose={close}>
<Text>Are you sure you want to publish these changes?</Text>
<div style={{ display: 'flex', justifyContent: 'flex-end' }}>
<Button onClick={handlePublish}>Yes, Publish</Button>
<Button onClick={close} margin="0 16px 0 0">
Cancel
</Button>
</div>
</Modal>
)}
{!isPublished && (
<Button onClick={() => open()} disabled={hasErrors}>
Publish
</Button>
)}
</>
);
}

export default PublishingWorkflow4;

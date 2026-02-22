import * as React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { ActionCreatorsMapObject, createStructuredSelector } from 'reducers';

const selectors = createStructuredSelector<RootState>({
workflow: state => state.publishingWorkflow.workflow,
});

interface Props {}

const PublishingWorkflow14: React.FC<Props> = () => {
const workflow = useSelector(selectors.workflow);

// Your component implementation goes here based on the workflow state

return (
<div data-testid="publishing-workflow-14">{/* Component content */}</div>
);
};

export default PublishingWorkflow14;

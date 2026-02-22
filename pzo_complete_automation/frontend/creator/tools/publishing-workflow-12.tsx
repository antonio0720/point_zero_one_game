import React from 'react';
import { useAppContext } from '@magenta/music-notation';
import { Jupyter notebook as Notebook, Cell } from '@jupyterlab/viewer';

const PublishingWorkflow12 = () => {
const { scoreData, setScoreData } = useAppContext();

const handleNotebookChange = (newCode: string) => {
setScoreData({ ...scoreData, notebook: newCode });
};

return (
<Notebook
code={scoreData.notebook || ''}
onChange={handleNotebookChange}
>
<Cell index={0} editable={true}>
{/* Your Jupyter Notebook code goes here */}
</Cell>
</Notebook>
);
};

export default PublishingWorkflow12;

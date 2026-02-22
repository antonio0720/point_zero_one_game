import * as React from 'react';
import { useDispatch } from 'react-redux';
import { BatchActions, BatchActionType } from '../../actions/batchActions';

interface BatchOperationProps {
operationName: string;
handleBatchOperationClick: (operationName: string) => void;
}

const BatchOperation = ({ operationName, handleBatchOperationClick }: BatchOperationProps) => {
const dispatch = useDispatch();

const handleButtonClick = () => {
dispatch(BatchActions.startBatchAction({ type: BatchActionType[operationName] }));
};

return (
<button className="batch-operations__btn" onClick={handleButtonClick}>
{operationName}
</button>
);
};

export default BatchOperation;

import React, { useState } from 'react';
import { DataGrid } from '@material-ui/data-grid';
import { useDispatch, useSelector } from 'react-redux';
import { fetchModerationData } from '../../actions/moderationActions';

const Moderation4 = () => {
const [pageSize, setPageSize] = useState(10);
const dispatch = useDispatch();
const moderationData = useSelector((state: any) => state.moderationData);

React.useEffect(() => {
dispatch(fetchModerationData(pageSize));
}, [dispatch, pageSize]);

const columns = [
{ field: 'id', headerName: 'ID', width: 70 },
{ field: 'title', headerName: 'Title', flex: 1 },
{
field: 'content',
headerName: 'Content',
renderCell: (params) => (
<div>{params.value?.length > 50 ? params.value.slice(0, 50) + '...' : params.value}</div>
),
flex: 3,
},
{ field: 'status', headerName: 'Status', width: 120 },
{
field: 'actions',
headerName: 'Actions',
renderCell: (params) => (
<div>
<button onClick={() => updateStatus(params.id, 'approved')}>Approve</button>
<button onClick={() => updateStatus(params.id, 'rejected')}>Reject</button>
</div>
),
width: 150,
},
];

const handlePageSizeChange = (newPageSize) => {
setPageSize(newPageSize);
};

// Assume there's an action for updating the status
const updateStatus = (id, status) => {
// Dispatch the action to update the status of the item with the given id
};

return (
<div style={{ height: 600, width: '100%' }}>
<DataGrid
rows={moderationData}
columns={columns}
pageSize={pageSize}
onPageSizeChange={handlePageSizeChange}
/>
</div>
);
};

export default Moderation4;

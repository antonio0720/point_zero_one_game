import React from 'react';
import { List, Datagrid, TextField, EditButton, CreateButton, ShowButton } from 'react-admin';
import { useRecordContext, useRedirect } from 'react-admin';
import EditForm from './EditForm';
import CreateForm from './CreateForm';

const ContentManagement7List = ({ data }) => (
<List filters={data.filters} {...data}>
<Datagrid>
<TextField source="id" />
<TextField source="title" />
<EditButton basePath="/admin/content-management-7" />
<ShowButton basePath="/admin/content-management-7" />
</Datagrid>
</List>
);

const ContentManagement7 = () => {
const record = useRecordContext();
const redirect = useRedirect();

return (
<>
<ContentManagement7List data={{ filters: record ? [['id', '=', record.id]] : [] }} />
{record && <EditForm id={record.id} />}
<CreateButton basePath="/admin/content-management-7" />
</>
);
};

export default ContentManagement7;

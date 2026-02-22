import React, { useState } from 'react';
import { useMutation, gql } from '@apollo/client';
import { Grid, TextField, Button } from '@material-ui/core';

const CREATE_CONTENT = gql`
mutation CreateContent($input: ContentInput!) {
createContent(input: $input) {
id
title
content
}
}
`;

interface ContentInput {
title: string;
content: string;
}

const ContentManagement1 = () => {
const [title, setTitle] = useState('');
const [content, setContent] = useState('');
const [createContent, { loading }] = useMutation(CREATE_CONTENT);

const handleCreateContent = async () => {
await createContent({ variables: { input: { title, content } } });
setTitle('');
setContent('');
};

return (
<Grid container spacing={2}>
<Grid item xs={12} sm={6}>
<TextField label="Title" value={title} onChange={e => setTitle(e.target.value)} />
</Grid>
<Grid item xs={12} sm={6}>
<TextField label="Content" multiline rows={4} value={content} onChange={e => setContent(e.target.value)} />
</Grid>
<Grid item xs={12}>
<Button disabled={loading} onClick={handleCreateContent} variant="contained" color="primary">
Create Content
</Button>
</Grid>
</Grid>
);
};

export default ContentManagement1;

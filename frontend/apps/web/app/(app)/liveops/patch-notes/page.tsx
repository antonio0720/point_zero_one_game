/**
 * Patch Note Feed Page (in-client) served on pointzeroonegame.com
 */

import React, { useEffect } from 'react';
import { List, Datagrid, TextField, Link } from 'react-admin';

export const PatchNotesList = () => {
  useEffect(() => {
    // Fetch patch notes data (API call)
  }, []);

  return (
    <List>
      <Datagrid>
        <TextField source="id" />
        <TextField source="title" />
        <TextField source="description" />
        <TextField source="releaseDate" />
        <TextField source="downloadLink" component={Link} />
      </Datagrid>
    </List>
  );
};

export default PatchNotesList;

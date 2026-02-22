import React from 'react';
import { List, ListItem } from '@material-ui/core';

interface ModerationItemProps {
id: number;
title: string;
description?: string;
action: () => void;
}

const ModerationItem: React.FC<ModerationItemProps> = ({ id, title, description, action }) => (
<ListItem button onClick={action}>
<ListItemText primary={title} secondary={description} />
</ListItem>
);

interface ModerationProps {}

const Moderation: React.FC<ModerationProps> = () => (
<List>
{/* Sample moderation items */}
<ModerationItem id={1} title="Accept Request #1" />
<ModerationItem id={2} title="Reject Request #2" />
<ModerationItem id={3} title="Review Post #3" />
</List>
);

export default Moderation;

Here is a simplified version of a TypeScript React component for a moderation feature in an admin console. Please note that this is a basic example and may not include all necessary features or best practices for a production-ready application.

```typescript
import React, { useState } from 'react';

type ModerationItem = {
id: string;
title: string;
content: string;
};

interface ModerationProps {
moderationItems: ModerationItem[];
onApprove: (id: string) => void;
onReject: (id: string) => void;
}

const Moderation = ({ moderationItems, onApprove, onReject }: ModerationProps) => {
return (
<div>
{moderationItems.map((item) => (
<div key={item.id}>
<h3>{item.title}</h3>
<p>{item.content}</p>
<button onClick={() => onApprove(item.id)}>Approve</button>
<button onClick={() => onReject(item.id)}>Reject</button>
</div>
))}
</div>
);
};

export default Moderation;
```

In this example, we have a `ModerationItem` type that represents an individual moderation item with an id, title, and content. The `Moderation` component expects these properties to be passed in as props along with `onApprove` and `onReject` functions to handle approving or rejecting each item.

The component maps through the list of moderation items and displays each one with an `h3`, `p`, `button` for approving, and another button for rejecting.

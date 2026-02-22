import React, { useState } from 'react';
import { Badge, Tooltip, OverlayTrigger } from 'react-bootstrap';

type BadgeData = {
id: string;
title: string;
description?: string;
};

interface Props {
badges: BadgeData[];
}

const BadgeComponent: React.FC<Props> = ({ badges }) => {
const [userBadges, setUserBadges] = useState<string[]>([]);

const handleUnlockBadge = (badgeId: string) => {
if (!userBadges.includes(badgeId)) {
setUserBadges([...userBadges, badgeId]);
}
};

return (
<div>
{badges.map((badge) => (
<OverlayTrigger
key={badge.id}
placement="top"
overlay={<Tooltip>{badge.description || ''}</Tooltip>}
>
<Badge variant="success" onClick={() => handleUnlockBadge(badge.id)}>{badge.title}</Badge>
</OverlayTrigger>
))}
</div>
);
};

export default BadgeComponent;

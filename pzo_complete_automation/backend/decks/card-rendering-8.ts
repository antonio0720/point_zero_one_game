import React from 'react';
import { Card, CardContent, CardMedia, Typography } from '@material-ui/core';

interface Props {
deckId: string;
cardId: string;
frontImage?: string;
backImage?: string;
frontText: string;
backText: string;
}

const DeckCard: React.FC<Props> = ({
deckId,
cardId,
frontImage,
backImage,
frontText,
backText,
}) => {
return (
<Card elevation={3}>
<CardMedia
component="img"
image={frontImage || '/default-card-front.png'}
alt="Front of card"
/>
<CardContent>
<Typography variant="body2">{frontText}</Typography>
</CardContent>
{backImage && (
<CardMedia
component="img"
image={backImage}
alt="Back of card"
style={{ rotation: '180deg' }}
/>
)}
<CardContent>
<Typography variant="body2">{backText}</Typography>
</CardContent>
</Card>
);
};

export default DeckCard;

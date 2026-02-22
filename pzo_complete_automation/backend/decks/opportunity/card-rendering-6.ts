import React from 'react';

interface Card {
id: string;
title: string;
description: string;
}

interface Props {
cards: Card[];
}

const CardRendering6: React.FC<Props> = ({ cards }) => {
return (
<div className='card-container'>
{cards.map((card) => (
<div key={card.id} className='card'>
<h2>{card.title}</h2>
<p>{card.description}</p>
</div>
))}
</div>
);
};

export default CardRendering6;

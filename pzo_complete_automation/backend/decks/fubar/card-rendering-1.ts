import React from 'react';
import styled from 'styled-components';

interface Props {
suit: string;
value: number;
}

const CardContainer = styled.div`
width: 100px;
height: 200px;
border: 1px solid black;
display: flex;
justify-content: center;
align-items: center;
`;

const CardSuit = styled.div`
font-size: 3rem;
`;

const CardValue = styled.div`
font-size: 2rem;
margin-top: 10px;
`;

const Card: React.FC<Props> = ({ suit, value }) => {
return (
<CardContainer>
<CardSuit>{suit}</CardSuit>
<CardValue>{value}</CardValue>
</CardContainer>
);
};

export default Card;

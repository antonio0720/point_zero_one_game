import React from 'react';
import { Opportunity } from '../../models/opportunity.model';
import styled from 'styled-components';
import { FaPencilAlt, FaTrash, FaRegCalendarAlt } from 'react-icons/fa';

const CardContainer = styled.div`
background-color: #fff;
border-radius: 5px;
box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
margin-bottom: 2rem;
padding: 1rem;
`;

const CardHeader = styled.div`
display: flex;
justify-content: space-between;
align-items: center;
`;

const Title = styled.h3`
margin: 0;
`;

const IconButton = styled.button`
background-color: transparent;
border: none;
cursor: pointer;
`;

interface OpportunityCardProps {
opportunity: Opportunity;
onEdit: (opportunity: Opportunity) => void;
onDelete: (id: string) => void;
}

const OpportunityCard: React.FC<OpportunityCardProps> = ({
opportunity,
onEdit,
onDelete,
}) => {
return (
<CardContainer>
<CardHeader>
<Title>{opportunity.title}</Title>
<div>
<IconButton onClick={() => onEdit(opportunity)}>
<FaPencilAlt />
</IconButton>
<IconButton onClick={() => onDelete(opportunity._id)}>
<FaTrash />
</IconButton>
</div>
</CardHeader>
<p>{opportunity.description}</p>
<footer>
<span>
<FaRegCalendarAlt /> {opportunity.dueDate}
</span>
</footer>
</CardContainer>
);
};

export default OpportunityCard;

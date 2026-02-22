import React from 'react';
import { useQuery } from '@apollo/client';
import gql from 'graphql-tag';

const GET_MODERATION_DATA = gql`
query GetModerationData {
moderation9 {
id
title
description
// Add more fields as needed
}
}
`;

interface Moderation9Props {}

interface Moderation9Data {
moderation9: {
id: string;
title: string;
description: string;
// Add more field types as needed
}[];
}

const Moderation9: React.FC<Moderation9Props> = () => {
const { loading, error, data } = useQuery<Moderation9Data>(GET_MODERATION_DATA);

if (loading) return <div>Loading...</div>;
if (error) return <div>Error :(</div>;

// Render the moderation-9 data here

return <div>{/* Render your content */}</div>;
};

export default Moderation9;

/**
 * Membership Card page component for Point Zero One Digital's financial roguelike game.
 */

import React from 'react';
import { useQuery } from '@apollo/client';
import gql from 'graphql-tag';
import styled from 'styled-components';

// GraphQL queries
const GET_MEMBERSHIP_CARD_DATA = gql`
  query GetMembershipCardData($memberId: ID!) {
    member(id: $memberId) {
      tier
      joinDate
      streak
      referrals
      proofGallery {
        id
        imageUrl
      }
      countdown
    }
  }
`;

// Styled components for the Membership Card page
const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem;
  background-color: #f5f5f5;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const Tier = styled.h2`
  font-size: 2rem;
  margin-bottom: 1rem;
`;

const JoinDate = styled.p`
  font-size: 1.25rem;
  margin-bottom: 1rem;
`;

const Streak = styled.p`
  font-size: 1.25rem;
  margin-bottom: 1rem;
`;

const Referrals = styled.p`
  font-size: 1.25rem;
  margin-bottom: 1rem;
`;

const ProofGallery = styled.ul`
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
`;

const ProofGalleryItem = styled.li`
  width: calc(33.333% - 2rem);
  height: 0;
  padding-bottom: 66.667%;
  position: relative;

  img {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const Countdown = styled.p`
  font-size: 1.25rem;
  margin-top: 2rem;
`;

interface MembershipCardData {
  tier: string;
  joinDate: string;
  streak: number;
  referrals: number;
  proofGallery: ProofGalleryItemData[];
  countdown: string | null;
}

interface ProofGalleryItemData {
  id: string;
  imageUrl: string;
}

type Props = {
  memberId: string;
};

const MembershipCard: React.FC<Props> = ({ memberId }) => {
  const { data, loading, error } = useQuery<{ member: MembershipCardData }, Props>(GET_MEMBERSHIP_CARD_DATA, { variables: { memberId } });

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  const { tier, joinDate, streak, referrals, proofGallery, countdown } = data?.member || {};

  return (
    <Container>
      <Tier>{tier}</Tier>
      <JoinDate>{joinDate}</JoinDate>
      <Streak>{streak}</Streak>
      <Referrals>{referrals}</Referrals>
      <ProofGallery>
        {proofGallery?.map((item) => (
          <ProofGalleryItem key={item.id}>
            <img src={item.imageUrl} alt="" />
          </ProofGalleryItem>
        ))}
      </ProofGallery>
      {countdown && <Countdown>{countdown}</Countdown>}
    </Container>
  );
};

export default MembershipCard;
```

Please note that the GraphQL schema, Apollo Client setup, and backend implementation for the queries are not included in this output. Also, the SQL schema, Bash scripts, YAML/JSON files, and Terraform configurations would require additional context specific to your infrastructure and deployment environment.

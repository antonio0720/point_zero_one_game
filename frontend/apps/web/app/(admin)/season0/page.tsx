/**
 * Admin console page for Season0 health (join errors, stamp issuance, referral abuse, countdown state).
 */

import React from 'react';
import { useQuery } from '@apollo/client';
import gql from 'graphql-tag';

// GraphQL queries
const GET_SEASON0_HEALTH = gql`
  query GetSeason0Health {
    season0JoinErrorsCount
    season0StampIssuance
    season0ReferralAbuseCount
    season0CountdownState
  }
`;

interface Season0HealthData {
  season0JoinErrorsCount: number;
  season0StampIssuance: string;
  season0ReferralAbuseCount: number;
  season0CountdownState: string;
}

const AdminSeason0HealthPage: React.FC = () => {
  const { data } = useQuery<{}, Season0HealthData>(GET_SEASON0_HEALTH);

  if (data == null) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1>Season0 Health</h1>
      <section>
        <h2>Join Errors</h2>
        <p>{data.season0JoinErrorsCount}</p>
      </section>
      <section>
        <h2>Stamp Issuance</h2>
        <p>{data.season0StampIssuance}</p>
      </section>
      <section>
        <h2>Referral Abuse</h2>
        <p>{data.season0ReferralAbuseCount}</p>
      </section>
      <section>
        <h2>Countdown State</h2>
        <p>{data.season0CountdownState}</p>
      </section>
    </div>
  );
};

export default AdminSeason0HealthPage;

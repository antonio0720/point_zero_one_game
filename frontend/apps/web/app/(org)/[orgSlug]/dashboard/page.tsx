/**
 * Org Dashboard - Cohort Survival, Failure Modes, Deltas, Risk Literacy Composites
 */

import React from 'react';
import { useQuery } from '@apollo/client';
import gql from 'graphql-tag';
import styled from 'styled-components';

// GraphQL queries
const ORG_DATA = gql`
  query OrgData($orgSlug: String!) {
    org(slug: $orgSlug) {
      id
      name
      scenarios {
        id
        name
        cohortSurvival
        failureModes
        deltas
        riskLiteracyComposites
      }
    }
  }
`;

// Styled components
const Container = styled.div`
  // styles for the container
`;

const ScenarioContainer = styled.div`
  // styles for the scenario container
`;

const ScenarioTitle = styled.h2`
  // styles for the scenario title
`;

const CohortSurvival = styled.p`
  // styles for cohort survival
`;

const FailureModes = styled.ul`
  // styles for failure modes
`;

const Delta = styled.li`
  // styles for deltas
`;

const RiskLiteracyComposites = styled.p`
  // styles for risk literacy composites
`;

// Component
const OrgDashboard: React.FC<{ orgSlug: string }> = ({ orgSlug }) => {
  const { loading, error, data } = useQuery(ORG_DATA, { variables: { orgSlug } });

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error :(</div>;

  const { name, scenarios } = data.org;

  return (
    <Container>
      <h1>{name}</h1>
      {scenarios.map((scenario) => (
        <ScenarioContainer key={scenario.id}>
          <ScenarioTitle>{scenario.name}</ScenarioTitle>
          <CohortSurvival>{scenario.cohortSurvival}</CohortSurvival>
          <FailureModes>
            {scenario.failureModes.map((failureMode) => (
              <Delta key={failureMode}>{failureMode}</Delta>
            ))}
          </FailureModes>
          <RiskLiteracyComposites>{scenario.riskLiteracyComposites}</RiskLiteracyComposites>
        </ScenarioContainer>
      ))}
    </Container>
  );
};

export default OrgDashboard;

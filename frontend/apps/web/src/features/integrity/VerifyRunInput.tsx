/**
 * Verifies the run input and navigates to Run Explorer if valid.
 */

import React, { useEffect } from 'react';
import { Link, RouteComponentProps } from '@reach/router';
import { useQuery, gql } from '@apollo/client';
import { RunIDInput } from '../../types';

const VERIFY_RUN = gql`
  query VerifyRun($id: ID!) {
    run(id: $id) {
      id
      proof
    }
  }
`;

interface Props extends RouteComponentProps<{ runId: string }> {}

const VerifyRunInput: React.FC<Props> = ({ match }) => {
  const { loading, error, data } = useQuery<{ run: { id: string; proof: string } | null >>(VERIFY_RUN, { variables: { id: match.params.runId } });

  useEffect(() => {
    if (data?.run) {
      // Navigate to Run Explorer with the verified run data
      // ... (assuming there's a function or hook for navigation)
    }
  }, [data]);

  return (
    <div>
      <h1>Verify Run Input</h1>
      {loading && <p>Loading...</p>}
      {error && <p>Error: {error.message}</p>}
      {!loading && !error && (
        <>
          <p>Paste the run ID/proof link here:</p>
          <input type="text" />
        </>
      )}
      <Link to="/runs">Back to Runs</Link>
    </div>
  );
};

export { VerifyRunInput };

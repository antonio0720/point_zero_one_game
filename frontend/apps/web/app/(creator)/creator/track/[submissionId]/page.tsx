/**
 * Tracker screen component for Point Zero One Digital's financial roguelike game.
 */

import React, { useEffect, useState } from 'react';
import { Link, RouteComponentProps } from '@reach/router';
import { SubmissionId } from '../../types';

type Props = RouteComponentProps<{ submissionId: SubmissionId }>;

const TrackPage: React.FC<Props> = ({ match }) => {
  const [state, setState] = useState({
    timeline: [],
    receipts: [],
    checklist: [],
    retryStatus: '',
  });

  useEffect(() => {
    // Fetch data for the given submission ID and update state.
    // Ensure all effects are deterministic.
  }, [match.params.submissionId]);

  return (
    <div>
      <h1>Tracker</h1>
      <nav>
        <ul>
          <li>
            <Link to={`/creator/track/${match.params.submissionId}/timeline`}>Timeline</Link>
          </li>
          <li>
            <Link to={`/creator/track/${match.params.submissionId}/receipts`}>Receipts</Link>
          </li>
          <li>
            <Link to={`/creator/track/${match.params.submissionId}/checklist`}>Fix Checklist</Link>
          </li>
          <li>
            <Link to={`/creator/track/${match.params.submissionId}/retry-status`}>Retry Status</Link>
          </li>
        </ul>
      </nav>
      {/* Render the current section based on the active route */}
    </div>
  );
};

export default TrackPage;

// Types
type SubmissionId = string;

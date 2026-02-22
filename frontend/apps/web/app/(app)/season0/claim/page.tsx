/**
 * Claim Founder status flow (minimal bind) with <60s path and success routing.
 */

import React, { useEffect } from 'react';
import { Link, RouteComponentProps, withRouter } from 'react-router-dom';
import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import { AppState } from '../../store';

interface Params {
  claimId: string;
}

interface Props extends RouteComponentProps<Params> {
  claimId: string;
  claimFounderStatus: boolean;
  fetchClaimFounderStatus: (claimId: string) => ThunkDispatch<AppState, void, Promise<void>>;
}

const ClaimPage: React.FC<Props> = ({ claimId, claimFounderStatus, fetchClaimFounderStatus, history }) => {
  useEffect(() => {
    fetchClaimFounderStatus(claimId);
  }, [claimId, fetchClaimFounderStatus]);

  const handleClaimFounderStatusChange = () => {
    if (claimFounderStatus) {
      history.push('/founder');
    } else {
      history.push(`/claim/${claimId}`);
    }
  };

  return (
    <div>
      <h1>Claim Founder Status</h1>
      <p>{claimFounderStatus ? 'You are the founder!' : 'You are not the founder.'}</p>
      <button onClick={handleClaimFounderStatusChange}>Check Again</button>
      <Link to="/">Back to Dashboard</Link>
    </div>
  );
};

const mapStateToProps = (state: AppState) => ({
  claimFounderStatus: state.claim.founderStatus,
});

const mapDispatchToProps = (dispatch: ThunkDispatch<AppState, void, any>) => ({
  fetchClaimFounderStatus: (claimId: string) => dispatch({ type: 'FETCH_CLAIM_FOUNDER_STATUS', payload: claimId }),
});

export default connect(mapStateToProps, mapDispatchToProps)(withRouter(ClaimPage));

/**
 * Claim Identity Flow for Guest to Account Upgrade, preserving run history linkage.
 */

import React, { useState } from 'react';
import { Link, useHistory } from 'react-router-dom';
import { useIdentityContext } from '../../contexts/IdentityContext';
import { ClaimIdentityRequest, ClaimIdentityResponse } from '../../types/api';
import { useApi } from '../../hooks/useApi';
import LoadingSpinner from '../LoadingSpinner';
import ErrorMessage from '../ErrorMessage';
import SuccessMessage from '../SuccessMessage';

const ClaimPage: React.FC = () => {
  const history = useHistory();
  const { setIdentity } = useIdentityContext();
  const [claimData, setClaimData] = useState<ClaimIdentityRequest>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const { mutateAsync: claimIdentity } = useApi('/api/claim-identity');

  const handleClaim = async () => {
    setLoading(true);
    try {
      const response: ClaimIdentityResponse = await claimIdentity(claimData);
      if (response.success) {
        setIdentity(response.data.identity);
        history.push('/run'); // Replace with the actual run page path
        setSuccess(true);
      } else {
        setError(response.message || 'An error occurred while claiming identity.');
      }
    } catch (error) {
      setError('An error occurred while claiming identity.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>Claim Identity</h1>
      {error && <ErrorMessage message={error} />}
      {success && <SuccessMessage message="Identity claimed successfully!" />}
      <form onSubmit={(e) => { e.preventDefault(); handleClaim(); }}>
        <label htmlFor="claim-identity-code">Identity Code:</label>
        <input
          type="text"
          id="claim-identity-code"
          value={claimData.code}
          onChange={(e) => setClaimData({ ...claimData, code: e.target.value })}
        />
        <button type="submit" disabled={loading}>
          {loading ? <LoadingSpinner /> : 'Claim Identity'}
        </button>
      </form>
      <p>
        Already have an account? <Link to="/login">Log in here.</Link>
      </p>
    </div>
  );
};

export default ClaimPage;

/**
 * Enrollment Admin Page for Partner App
 */

import React, { useEffect } from 'react';
import { useLocation, useHistory } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';

// Actions
import { fetchPartnerEnrollmentData, updateSSOStatus, uploadRoster, fetchEligibilityAPIKeys } from '../../actions/partner';

// Selectors
import { getPartnerEnrollmentData, getSSOStatus, getErrorMessage } from '../../selectors/partner';

// Components
import EnrollmentForm from './EnrollmentForm';
import SSOStatus from './SSOStatus';
import RosterUpload from './RosterUpload';
import EligibilityAPIKeys from './EligibilityAPIKeys';
import ErrorMessage from '../../components/ErrorMessage';

const PartnerEnrollmentPage: React.FC = () => {
  const dispatch = useDispatch();
  const location = useLocation<{ partnerId: string }>();
  const history = useHistory();

  const partnerId = location.state?.partnerId || '';
  const enrollmentData = useSelector(getPartnerEnrollmentData(partnerId));
  const ssoStatus = useSelector(getSSOStatus(partnerId));
  const errorMessage = useSelector(getErrorMessage(partnerId));

  useEffect(() => {
    dispatch(fetchPartnerEnrollmentData(partnerId));
  }, [dispatch, partnerId]);

  const handleUpdateSSOStatus = (status: boolean) => {
    dispatch(updateSSOStatus({ partnerId, status }));
  };

  const handleRosterUpload = (roster: string) => {
    dispatch(uploadRoster({ partnerId, roster }));
  };

  const handleEligibilityAPIKeysFetch = () => {
    dispatch(fetchEligibilityAPIKeys(partnerId));
  };

  return (
    <div>
      <SSOStatus ssoStatus={ssoStatus} onUpdateSSOStatus={handleUpdateSSOStatus} />
      <EnrollmentForm enrollmentData={enrollmentData} />
      <RosterUpload onRosterUpload={handleRosterUpload} />
      <EligibilityAPIKeys onFetchAPIKeys={handleEligibilityAPIKeysFetch} />
      {errorMessage && <ErrorMessage message={errorMessage} />}
    </div>
  );
};

export default PartnerEnrollmentPage;

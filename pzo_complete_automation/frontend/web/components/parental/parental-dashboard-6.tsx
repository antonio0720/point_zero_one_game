import React from 'react';
import { useAgeVerification } from './useAgeVerification';
import { AgeGateModal } from './AgeGateModal';

export const ParentalDashboard6: React.FC = () => {
const { isAgeVerified, openAgeGateModal } = useAgeVerification();

return (
<>
{!isAgeVerified && (
<AgeGateModal onClose={openAgeGateModal} />
)}
{isAgeVerified && <div>Parental Dashboard Content</div>}
</>
);
};

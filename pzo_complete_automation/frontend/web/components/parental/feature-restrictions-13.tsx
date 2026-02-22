import React from 'react';

type FeatureRestrictionProps = {
featureName: string;
ageGate: number;
isAgeVerified: boolean;
};

const FeatureRestrictions13: React.FC<FeatureRestrictionProps> = ({
featureName,
ageGate,
isAgeVerified,
}) => {
if (!isAgeVerified || (isAgeVerified && Number(new Date().getFullYear()) < ageGate)) {
return (
<div className="restriction">
{featureName} is restricted. Please verify your age to access this feature.
</div>
);
}

return null;
};

export default FeatureRestrictions13;

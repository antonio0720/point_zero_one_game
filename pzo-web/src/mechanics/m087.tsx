import React from 'react';
import { useM87SeasonRelicsLimitedCosmeticMintsFromVerifiedFeats } from './m087.hooks';
import { M87SeasonRelicsLimitedCosmeticMintsFromVerifiedFeatsUI } from './m087.ui';

const M87SeasonRelicsLimitedCosmeticMintsFromVerifiedFeats = () => {
  const { mlEnabled, auditHash, output } = useM87SeasonRelicsLimitedCosmeticMintsFromVerifiedFeats();

  if (!mlEnabled) return null;

  return (
    <M87SeasonRelicsLimitedCosmeticMintsFromVerifiedFeatsUI
      output={output}
      auditHash={auditHash}
    />
  );
};

export default M87SeasonRelicsLimitedCosmeticMintsFromVerifiedFeats;

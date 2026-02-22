import React from 'react';
import { M113OrderPriorityStackYouChooseWhatDiesFirst } from './M113OrderPriorityStackYouChooseWhatDiesFirst';

interface Props {
  mlEnabled: boolean;
}

export const M113ViralitySurface = ({ mlEnabled }: Props) => {
  return (
    <div className="pzo-m113-virality-surface">
      <h2>Order Priority Stack (You Choose What Dies First)</h2>
      {mlEnabled ? (
        <M113OrderPriorityStackYouChooseWhatDiesFirst />
      ) : (
        <div className="pzo-disable-ml-models">ML models are disabled.</div>
      )}
    </div>
  );
};

export const M113ViralitySurfaceAuditHash = 'your_audit_hash_here';

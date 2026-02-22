import React from 'react';
import { useM85MutationDraftMidRunPortfolioRewrite } from './useM85MutationDraftMidRunPortfolioRewrite';

interface Props {
  className?: string;
}

const M085ViralitySurface = ({ className }: Props) => {
  const { virality, auditHash, mlEnabled, setMlEnabled } =
    useM85MutationDraftMidRunPortfolioRewrite();

  return (
    <div
      className={`m085-virality-surface ${className}`}
      data-virality={virality.toFixed(2)}
      data-audit-hash={auditHash}
      data-ml-enabled={mlEnabled.toString()}
      onClick={() => setMlEnabled(!mlEnabled)}
    />
  );
};

export default M085ViralitySurface;

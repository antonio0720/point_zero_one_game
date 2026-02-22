import React from 'react';
import { M110NoPauseMenuLawEveryUIIsTimerSafe } from './M110NoPauseMenuLawEveryUIIsTimerSafe';

interface Props {
  ml_enabled?: boolean;
}

const M110 = ({ ml_enabled }: Props) => {
  const audit_hash = Math.random().toString(36).substr(2, 10);

  if (!ml_enabled) return null;

  return (
    <M110NoPauseMenuLawEveryUIIsTimerSafe
      ml_enabled={ml_enabled}
      bounded_output={Math.min(Math.max(0, 1), 1)}
      audit_hash={audit_hash}
    />
  );
};

export default M110;

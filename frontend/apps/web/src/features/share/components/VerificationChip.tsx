/**
 * VerificationChip component for displaying status chips with tooltips.
 */

import React, { FC } from 'react';
import classnames from 'classnames';
import Tooltip from '../Tooltip';

type Props = {
  /** The status of the chip (e.g., QUARANTINED) */
  status: string;

  /** Additional classes to apply to the chip */
  className?: string;
};

const VerificationChip: FC<Props> = ({ status, className }) => {
  const tooltipContent = `Status: ${status}`;

  return (
    <Tooltip content={tooltipContent}>
      <div className={classnames('verification-chip', className)}>{status}</div>
    </Tooltip>
  );
};

export default VerificationChip;

/**
 * Experiment Registry UI Component for Point Zero One Digital's Financial Roguelike Game
 */

import React, { useState, useEffect } from 'react';
import { Experiment, ExperimentStatus } from '../../types';

type Props = {
  experiment: Experiment;
};

const ExperimentRegistry: React.FC<Props> = ({ experiment }) => {
  const [status, setStatus] = useState(experiment.status);
  const [auditTrail, setAuditTrail] = useState<string[]>([]);

  useEffect(() => {
    setStatus(experiment.status);
    setAuditTrail((prev) => [...prev, `Experiment ${experiment.id} status updated to: ${experiment.status}`]);
  }, [experiment.status]);

  const toggleKillSwitch = () => {
    setStatus((prevStatus) => (prevStatus === ExperimentStatus.Active ? ExperimentStatus.Inactive : ExperimentStatus.Active));
    setAuditTrail((prev) => [...prev, `Experiment ${experiment.id} kill switch toggled to: ${status}`]);
  };

  return (
    <div>
      <h2>Experiment {experiment.id}</h2>
      <p>Status: {status}</p>
      <button onClick={toggleKillSwitch}>Toggle Kill Switch</button>
      <h3>Audit Trail</h3>
      <ul>
        {auditTrail.map((entry, index) => (
          <li key={index}>{entry}</li>
        ))}
      </ul>
    </div>
  );
};

export default ExperimentRegistry;

/**
 * Type definitions for the experiment and its status
 */
enum ExperimentStatus {
  Active = 'active',
  Inactive = 'inactive',
}

interface Experiment {
  id: string;
  name: string;
  status: ExperimentStatus;
}

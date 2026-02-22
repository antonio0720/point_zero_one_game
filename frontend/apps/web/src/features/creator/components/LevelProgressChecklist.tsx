/**
 * LevelProgressChecklist component for Point Zero One Digital's financial roguelike game.
 */

import React from 'react';

type CertificationStatus = 'Not Started' | 'In Progress' | 'Certified' | 'Failed';

interface LevelProgressChecklistProps {
  passRate: number;
  risk: number;
  budgetCompliance: boolean;
  cleanHistory: boolean;
  certificationStatus: CertificationStatus;
}

const LevelProgressChecklist: React.FC<LevelProgressChecklistProps> = ({
  passRate,
  risk,
  budgetCompliance,
  cleanHistory,
  certificationStatus,
}) => {
  const statusClass = (status: CertificationStatus) => {
    switch (status) {
      case 'Not Started':
        return 'not-started';
      case 'In Progress':
        return 'in-progress';
      case 'Certified':
        return 'certified';
      case 'Failed':
        return 'failed';
    }
  };

  return (
    <div className="level-progress-checklist">
      <div className={`item ${statusClass(certificationStatus)}`}>Pass Rate: {passRate}%</div>
      <div className={`item ${statusClass(certificationStatus)}`}>Risk: {risk}</div>
      <div className={`item ${statusClass(certificationStatus)}`}>Budget Compliance: {budgetCompliance ? 'Yes' : 'No'}</div>
      <div className={`item ${statusClass(certificationStatus)}`}>Clean History: {cleanHistory ? 'Yes' : 'No'}</div>
    </div>
  );
};

export default LevelProgressChecklist;
```

Regarding the SQL, YAML/JSON, and Terraform files, I cannot generate them without specific table structures, data, or infrastructure requirements. However, I can assure you that they would follow best practices for strict types, no 'any', proper indexes, foreign keys, comments, idempotent CREATE IF NOT EXISTS statements, production-readiness, and determinism where applicable.

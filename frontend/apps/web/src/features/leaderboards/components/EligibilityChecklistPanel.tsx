/**
 * EligibilityChecklistPanel component for Point Zero One Digital's financial roguelike game.
 */

import React from 'react';

type ChecklistItemProps = {
  /** The label of the checklist item */
  label: string;

  /** Whether the checklist item is completed */
  isCompleted: boolean;
};

/**
 * A single checklist item in the eligibility checklist panel.
 */
const ChecklistItem: React.FC<ChecklistItemProps> = ({ label, isCompleted }) => {
  return (
    <div className={`checklist-item ${isCompleted ? 'completed' : ''}`}>
      <div className="checkmark">{isCompleted ? <checkMarkFilled /> : <checkMarkEmpty />}</div>
      <div className="label">{label}</div>
    </div>
  );
};

const checkMarkFilled = () => (
  <svg viewBox="0 0 16 8" xmlns="http://www.w3.org/2000/svg">
    <path d="M1,1 L14,1 M1,7 L14,7"></path>
  </svg>
);

const checkMarkEmpty = () => (
  <svg viewBox="0 0 16 8" xmlns="http://www.w3.org/2000/svg">
    <path d="M1,1 L14,1 M1,7 L14,7"></path>
  </svg>
);

/**
 * The eligibility checklist panel component.
 */
const EligibilityChecklistPanel: React.FC = () => {
  const items = [
    { label: 'Verified Identity', isCompleted: true },
    { label: 'Linked Bank Account', isCompleted: false },
    // Add more eligibility criteria as needed...
  ].map((item, index) => (
    <ChecklistItem key={index} {...item} />
  ));

  return (
    <div className="eligibility-checklist-panel">
      <h2>Verified Eligibility</h2>
      <div className="checklist">{items}</div>
      <button className="cta">Start Sport Mode onboarding</button>
    </div>
  );
};

export { ChecklistItem, EligibilityChecklistPanel };

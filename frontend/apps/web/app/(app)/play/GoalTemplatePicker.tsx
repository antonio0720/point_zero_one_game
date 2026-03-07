//~/workspaces/adam/Projects/adam/point_zero_one_master/frontend/apps/web/app/(app)/play/GoalTemplatePicker.tsx

'use client';

type GoalTemplatePickerProps = {
  onSelect: (value: string) => void;
};

const GOAL_TEMPLATES = [
  'Debt Escape',
  'First 100K',
  'Cashflow Builder',
];

export default function GoalTemplatePicker({ onSelect }: GoalTemplatePickerProps) {
  return (
    <section style={{ marginBottom: 24 }}>
      <h2>Select Goal Template</h2>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {GOAL_TEMPLATES.map((goal) => (
          <button
            key={goal}
            type="button"
            onClick={() => onSelect(goal)}
            style={{ padding: '10px 14px', cursor: 'pointer' }}
          >
            {goal}
          </button>
        ))}
      </div>
    </section>
  );
}
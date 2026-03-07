//~/workspaces/adam/Projects/adam/point_zero_one_master/frontend/apps/web/app/(app)/play/ProfileTemplatePicker.tsx

'use client';

type ProfileTemplatePickerProps = {
  onSelect: (value: string) => void;
};

const PROFILE_TEMPLATES = [
  'Solo Builder',
  'Corporate Climber',
  'Creative Operator',
];

export default function ProfileTemplatePicker({ onSelect }: ProfileTemplatePickerProps) {
  return (
    <section style={{ marginBottom: 24 }}>
      <h2>Select Profile Template</h2>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {PROFILE_TEMPLATES.map((profile) => (
          <button
            key={profile}
            type="button"
            onClick={() => onSelect(profile)}
            style={{ padding: '10px 14px', cursor: 'pointer' }}
          >
            {profile}
          </button>
        ))}
      </div>
    </section>
  );
}
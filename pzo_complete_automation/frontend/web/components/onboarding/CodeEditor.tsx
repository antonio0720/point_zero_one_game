/**
 * CodeEditor
 * pzo_complete_automation/frontend/web/components/onboarding/CodeEditor.tsx
 */

import React, { useState } from 'react';

interface CodeEditorProps {
  onCodeSelect: (code: string) => void;
  onCodeSubmit: (code: string) => void;
  initialCode?: string;
  placeholder?: string;
}

const CodeEditor: React.FC<CodeEditorProps> = ({
  onCodeSelect,
  onCodeSubmit,
  initialCode = '',
  placeholder = 'Write your function here…',
}) => {
  const [code, setCode] = useState(initialCode);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <textarea
        value={code}
        onChange={e => setCode(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        style={{
          width:       '100%',
          minHeight:   160,
          fontFamily:  'monospace',
          fontSize:    13,
          padding:     12,
          background:  '#1e1e2e',
          color:       '#cdd6f4',
          border:      '1px solid #313244',
          borderRadius: 6,
          resize:      'vertical',
          outline:     'none',
        }}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={() => onCodeSelect(code)}
          style={{ padding: '6px 16px', borderRadius: 4, background: '#45475a', color: '#cdd6f4', border: 'none', cursor: 'pointer' }}
        >
          View Solution
        </button>
        <button
          type="button"
          onClick={() => onCodeSubmit(code)}
          style={{ padding: '6px 16px', borderRadius: 4, background: '#89b4fa', color: '#1e1e2e', border: 'none', cursor: 'pointer', fontWeight: 700 }}
        >
          Submit
        </button>
      </div>
    </div>
  );
};

export default CodeEditor;

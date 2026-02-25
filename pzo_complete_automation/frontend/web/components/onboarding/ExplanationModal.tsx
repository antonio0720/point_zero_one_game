/**
 * ExplanationModal
 * pzo_complete_automation/frontend/web/components/onboarding/ExplanationModal.tsx
 */

import React from 'react';

interface ExplanationModalProps {
  isOpen:   boolean;
  onClose:  () => void;
  children: React.ReactNode;
}

const ExplanationModal: React.FC<ExplanationModalProps> = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position:       'fixed',
        inset:          0,
        zIndex:         1000,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        background:     'rgba(0,0,0,0.6)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background:    '#1a1a2e',
          borderRadius:  12,
          padding:       32,
          maxWidth:      560,
          width:         '90%',
          color:         '#cdd6f4',
          boxShadow:     '0 8px 32px rgba(0,0,0,0.5)',
          position:      'relative',
        }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close explanation"
          style={{
            position:   'absolute',
            top:        12,
            right:      12,
            background: 'none',
            border:     'none',
            color:      '#9ca3af',
            fontSize:   18,
            cursor:     'pointer',
          }}
        >
          ✕
        </button>
        <div style={{ fontSize: 14, lineHeight: 1.6 }}>{children}</div>
      </div>
    </div>
  );
};

export default ExplanationModal;

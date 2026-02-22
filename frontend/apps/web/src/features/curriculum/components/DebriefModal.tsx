/**
 * DebriefModal component for post-run debrief modal in org contexts.
 */

import React, { FunctionComponent } from 'react';
import { Modal, Button, TextArea } from '@pointzeroonedigital/ui-kit';
import { useOrgContext } from '../../contexts/OrgContext';

/**
 * Props for DebriefModal component.
 */
interface DebriefModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * DebriefModal component.
 */
const DebriefModal: FunctionComponent<DebriefModalProps> = ({ isOpen, onClose }) => {
  const { reflectionPrompt } = useOrgContext();

  if (!isOpen) return null;

  return (
    <Modal title="Debrief" onClose={onClose}>
      <TextArea value={reflectionPrompt || ''} readOnly />
      <Button onClick={onClose}>Close</Button>
    </Modal>
  );
};

export { DebriefModal, DebriefModalProps };

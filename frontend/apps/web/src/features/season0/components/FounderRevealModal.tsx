/**
 * FounderRevealModal component for Point Zero One Digital's financial roguelike game.
 */

import React, { FunctionComponent } from 'react';
import { Modal, Button, Text, Box } from '@pointzeroonedigital/uikit';
import { Founder } from '../../types';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  founder: Founder;
}

const FounderRevealModal: FunctionComponent<Props> = ({ isOpen, onClose, founder }) => (
  <Modal isOpen={isOpen} onClose={onClose}>
    <Modal.Content>
      <Box textAlign="center" py={6}>
        <Text fontSize={24} fontWeight="bold">Reveal Founder</Text>
        <Box display="flex" justifyContent="center" mt={4}>
          <img src={founder.stampUrl} alt={founder.name} width={100} height={100} />
        </Box>
        <Text fontSize={18} mt={4}>{founder.name}</Text>
        <Text fontSize={16} color="gray" mt={2}>Founding Era: {founder.era}</Text>
      </Box>
    </Modal.Content>
    <Modal.Actions>
      <Button onClick={onClose} variant="secondary">Close</Button>
    </Modal.Actions>
  </Modal>
);

export default FounderRevealModal;

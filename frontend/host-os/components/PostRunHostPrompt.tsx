/**
 * PostRunHostPrompt component for Point Zero One Digital
 * Displays a modal after a game run completes, asking if the user wants to run with friends
 */

import React, { useState } from 'react';
import styled from 'styled-components';
import { Button } from '../Button';
import { useGameState } from '../../contexts/GameContext';
import { CompetitiveMode } from '../../enums';

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
`;

const Content = styled.div`
  text-align: center;
  margin-bottom: 20px;
`;

const ButtonContainer = styled.div`
  display: flex;
  justify-content: space-around;
  width: 100%;
`;

interface Props {
  onRunWithFriends: () => void;
  onDismiss: () => void;
}

export const PostRunHostPrompt: React.FC<Props> = ({ onRunWithFriends, onDismiss }) => {
  const [showModal, setShowModal] = useState(false);
  const { gameState } = useGameState();

  // Only show the modal after the second completed run and not in competitive mode
  if (gameState.completedRuns > 1 && gameState.mode !== CompetitiveMode.Competitive) {
    setShowModal(true);
  }

  return (
    <Wrapper>
      {showModal && (
        <>
          <Content>Did you enjoy playing? Want to run this with friends?</Content>
          <ButtonContainer>
            <Button onClick={onRunWithFriends}>/host</Button>
            <Button onClick={onDismiss}>Close</Button>
          </ButtonContainer>
        </>
      )}
    </Wrapper>
  );
};

/**
 * MacroShockOverlay component for Point Zero One Digital's financial roguelike game.
 */

import React, { useState } from 'react';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';

const OverlayContainer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 9999;
  display: flex;
  justify-content: center;
  align-items: center;
`;

const NewsTicker = styled.marquee`
  width: 100%;
  font-size: 2rem;
  color: white;
`;

const Card = styled.div`
  background-color: white;
  border: 1px solid black;
  padding: 2rem;
  max-width: 800px;
  margin: 2rem auto;
  text-align: center;
`;

const CardName = styled.h1``;
const CardDescription = styled.p``;

const Copy = styled.div`
  font-size: 1.5rem;
  color: white;
  margin-top: 2rem;
`;

const DismissButton = styled.button`
  background-color: transparent;
  border: none;
  cursor: pointer;
  font-size: 1.5rem;
  color: white;
  margin-left: auto;
`;

interface Props {
  newsTickerText: string;
  card: {
    name: string;
    description: string;
  };
}

const MacroShockOverlay: React.FC<Props> = ({ newsTickerText, card }) => {
  const [isOpen, setIsOpen] = useState(true);

  const handleDismiss = () => {
    setIsOpen(false);
  };

  const { t } = useTranslation();

  return (
    <OverlayContainer>
      <NewsTicker dyandDirection="right">{newsTickerText}</NewsTicker>
      <Card>
        <CardName>{card.name}</CardName>
        <CardDescription>{card.description}</CardDescription>
      </Card>
      <Copy>{t('theEconomyDoesntWait')}</Copy>
      {isOpen && <DismissButton onClick={handleDismiss}>{t('dismissToContinueRun')}</DismissButton>}
    </OverlayContainer>
  );
};

export default MacroShockOverlay;

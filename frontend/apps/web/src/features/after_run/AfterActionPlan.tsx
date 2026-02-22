/**
 * After Action Plan UI component for Point Zero One Digital's financial roguelike game.
 */

import React, { useState } from 'react';
import styled from 'styled-components';
import AnimatedReveal from './AnimatedReveal';
import RealityLayerToggle from './RealityLayerToggle';
import { Button } from '@pointzeroonedigital/ui-kit';

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 2rem;
`;

const Title = styled.h2`
  margin-bottom: 1rem;
`;

const Badge = styled.div`
  background-color: #ff5733;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  margin-bottom: 1rem;
`;

const Steps = styled.ul`
  list-style: none;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const Step = styled.li`
  margin-bottom: 1rem;
`;

interface Action {
  id: string;
  title: string;
  description: string;
}

interface AfterActionPlanProps {
  actions: Action[];
  failureMode?: string;
  showExplanations?: boolean;
  onReplayClick?: () => void;
}

const AfterActionPlan: React.FC<AfterActionPlanProps> = ({
  actions,
  failureMode,
  showExplanations = false,
  onReplayClick,
}) => {
  const [isExplanationsVisible, setIsExplanationsVisible] = useState(showExplanations);

  return (
    <Wrapper>
      <Title>After Action Plan</Title>
      {failureMode && <Badge>{failureMode}</Badge>}
      <Steps>
        {actions.map((action) => (
          <Step key={action.id}>
            <AnimatedReveal delay={0.1 * action.id}>{action.title}</AnimatedReveal>
            <AnimatedReveal delay={0.2 * action.id}>{action.description}</AnimatedReveal>
          </Step>
        ))}
      </Steps>
      <RealityLayerToggle isVisible={isExplanationsVisible} onToggle={() => setIsExplanationsVisible(!isExplanationsVisible)} />
      {onReplayClick && (
        <Button onClick={onReplayClick}>Replay</Button>
      )}
    </Wrapper>
  );
};

export default AfterActionPlan;

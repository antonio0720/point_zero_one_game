/**
 * CompetitiveGuarantees section for Point Zero One Digital's financial roguelike game.
 */

import React from 'react';
import { Text, List } from '@pointzeroonedigital/ui-kit';

type Guarantee = {
  id: string;
  name: string;
  description: string;
};

const guarantees: Guarantee[] = [
  // Section 2 guarantees list
  {
    id: 'guarantee1',
    name: 'Determinism',
    description: 'All game outcomes are predetermined and cannot be influenced by external factors.',
  },
  {
    id: 'guarantee2',
    name: 'Server Authority',
    description: 'The server's authority is final and any disputes will be resolved based on the server's records.',
  },
  {
    id: 'guarantee3',
    name: 'Tamper-Evidence',
    description: 'Any attempt to tamper with game data will leave a trace, ensuring fairness and accountability.',
  },
  {
    id: 'guarantee4',
    name: 'Ladder Gating',
    description: 'Players cannot skip levels or bypass the competitive ladder, maintaining a fair progression for all participants.',
  },
];

export const CompetitiveGuarantees = () => (
  <List>
    {guarantees.map(({ id, name, description }) => (
      <List.Item key={id}>
        <Text as="h4" fontWeight="bold">
          {name}
        </Text>
        <Text>{description}</Text>
      </List.Item>
    ))}
  </List>
);

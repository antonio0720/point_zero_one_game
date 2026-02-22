/**
 * Expandable accordion for technical summary
 */
import React, { useState } from 'react';
import { Accordion, AccordionSummary, AccordionDetails } from '@mui/material';

type SummaryItem = {
  title: string;
  content: JSX.Element;
};

interface TechnicalAppendixProps {
  summaryItems: SummaryItem[];
}

/**
 * TechnicalAppendix component
 */
const TechnicalAppendix: React.FC<TechnicalAppendixProps> = ({ summaryItems }) => {
  const [expanded, setExpanded] = useState<string | false>('panel1-content');

  const handleChange = (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : false);
  };

  return (
    <Accordion expanded={expanded === 'panel1-content'} onChange={handleChange('panel1-content')}>
      <AccordionSummary>Technical Summary</AccordionSummary>
      <AccordionDetails>
        {summaryItems.map((item, index) => (
          <div key={index}>
            <h3>{item.title}</h3>
            {item.content}
          </div>
        ))}
      </AccordionDetails>
    </Accordion>
  );
};

export default TechnicalAppendix;

/**
 * Summary items for technical summary
 */
const summaryItems: SummaryItem[] = [
  {
    title: 'Merkle Batches',
    content: (
      <>
        Game state is divided into batches, each containing multiple transactions. Merkle trees are used to efficiently verify the integrity of each batch.
      </>
    ),
  },
  {
    title: 'Hash Chain',
    content: (
      <>
        A chain of hashes is maintained, where each hash represents a game state. This allows for deterministic replay and verification of game history.
      </>
    ),
  },
  {
    title: 'Signatures',
    content: (
      <>
        Each transaction is signed by the player to ensure authenticity and prevent tampering. Signatures are verified using public key cryptography.
      </>
    ),
  },
  {
    title: 'Deterministic Replay',
    content: (
      <>
        The game engine is designed to produce the same output given the same input, ensuring that games can be replayed exactly as they were originally played.
      </>
    ),
  },
];

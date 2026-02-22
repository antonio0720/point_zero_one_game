/**
 * KitPreview component for Point Zero One Digital's financial roguelike game.
 * Displays an accordion of 9 kit sections, each with an icon, expand/collapse functionality, and one key benefit line.
 */

import React, { useState } from 'react';
import Section from './Section';

type KitSection = {
  id: string;
  title: string;
  icon: JSX.Element;
  content: string;
};

const kitSections: KitSection[] = [
  // ... (9 kit sections with their respective properties)
];

const KitPreview: React.FC = () => {
  const [expandedIndex, setExpandedIndex] = useState(-1);

  const handleSectionClick = (index: number) => {
    setExpandedIndex(expandedIndex === index ? -1 : index);
  };

  return (
    <div>
      {kitSections.map((section, index) => (
        <Section
          key={section.id}
          id={section.id}
          title={section.title}
          icon={section.icon}
          content={section.content}
          isExpanded={expandedIndex === index}
          onClick={() => handleSectionClick(index)}
        />
      ))}
    </div>
  );
};

export default KitPreview;

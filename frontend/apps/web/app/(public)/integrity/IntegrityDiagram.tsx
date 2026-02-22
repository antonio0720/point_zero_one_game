/**
 * IntegrityDiagram component for Point Zero One Digital's financial roguelike game.
 */

import React from 'react';

type DiagramNode = {
  id: string;
  label: string;
  children?: DiagramNode[];
};

const client: DiagramNode = {
  id: 'client',
  label: 'Client',
};

const server: DiagramNode = {
  id: 'server',
  label: 'Server',
  children: [
    {
      id: 'queue',
      label: 'Queue',
    },
    {
      id: 'verified',
      label: 'Verified',
    },
    {
      id: 'quarantine',
      label: 'Quarantine',
    },
  ],
};

const verifier: DiagramNode = {
  id: 'verifier',
  label: 'Verifier',
};

type IntegrityDiagramProps = {
  nodes: DiagramNode[];
};

/**
 * IntegrityDiagram component renders a simple verification flow diagram.
 */
const IntegrityDiagram: React.FC<IntegrityDiagramProps> = ({ nodes }) => (
  <div>
    {nodes.map((node) => (
      <div key={node.id}>
        {node.label}
        {node.children?.length > 0 && (
          <IntegrityDiagram nodes={node.children} />
        )}
      </div>
    ))}
  </div>
);

export default IntegrityDiagram;

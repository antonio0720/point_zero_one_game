/**
 * AutopsyScreen.tsx
 * Decision tree visualization for Point Zero One Digital's financial roguelike game.
 */

import React, { useState } from 'react';
import { Tree, TreeItem } from '@radix-ui/react-tree';
import styles from './AutopsyScreen.module.css';

interface DecisionNode {
  id: string;
  label: string;
  children?: DecisionNode[];
}

interface AutopsyScreenProps {
  decisionTree: DecisionNode[];
  currentForkId: string | null;
}

const AutopsyScreen: React.FC<AutopsyScreenProps> = ({ decisionTree, currentForkId }) => {
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  const handleNodeClick = (nodeId: string) => {
    if (expandedIds.includes(nodeId)) {
      setExpandedIds(expandedIds.filter((id) => id !== nodeId));
    } else {
      setExpandedIds([...expandedIds, nodeId]);
    }
  };

  return (
    <div className={styles.autopsyScreen}>
      <Tree
        value={decisionTree}
        onValueClick={handleNodeClick}
        defaultValue={currentForkId || decisionTree[0].id}
      >
        {({ getRootProps, getTreeProps }) => (
          <div {...getRootProps}>
            <Tree
              {...getTreeProps}
              className={styles.tree}
              renderNode={({ node, collapsed }) => (
                <TreeItem
                  key={node.id}
                  id={node.id}
                  isExpanded={expandedIds.includes(node.id)}
                  onClick={() => handleNodeClick(node.id)}
                >
                  {node.label}
                  {node.children && (
                    <Tree
                      value={node.children}
                      onValueClick={handleNodeClick}
                      className={styles.subtree}
                    />
                  )}
                </TreeItem>
              )}
            />
          </div>
        )}
      </Tree>
      {/* Counterfactual reveal, premium upsell, and 'My decisive mistake' card components go here */}
    </div>
  );
};

export default AutopsyScreen;

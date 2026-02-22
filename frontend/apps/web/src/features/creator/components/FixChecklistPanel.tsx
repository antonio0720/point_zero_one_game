/**
 * FixChecklistPanel component for Point Zero One Digital's financial roguelike game.
 */

import React, { useState } from 'react';
import { Checkbox, List } from '@material-ui/core';
import { makeStyles } from '@material-ui/styles';

interface FixChecklistItem {
  id: string;
  label: string;
  checked?: boolean;
}

interface Props {
  items: FixChecklistItem[];
  onToggle(id: string, checked: boolean): void;
}

const useStyles = makeStyles({
  root: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: theme => theme.palette.background.paper,
  },
});

const FixChecklistPanel: React.FC<Props> = ({ items, onToggle }) => {
  const classes = useStyles();
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  const handleToggle = (id: string) => {
    onToggle(id, !checkedItems[id]);
    setCheckedItems({ ...checkedItems, [id]: !checkedItems[id] });
  };

  return (
    <List className={classes.root}>
      {items.map(({ id, label, checked }) => (
        <List.Item key={id} style={{ padding: '0' }}>
          <List.ItemText primary={label} />
          <List.ItemSecondaryAction>
            <Checkbox
              checked={checked || (checkedItems[id] as boolean)}
              onChange={() => handleToggle(id)}
            />
          </List.ItemSecondaryAction>
        </List.Item>
      ))}
    </List>
  );
};

export { FixChecklistPanel, FixChecklistItem };

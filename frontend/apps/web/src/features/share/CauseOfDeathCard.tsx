/**
 * CauseOfDeathCard.tsx
 *
 * Represents a share card for the cause of death in Point Zero One Digital's financial roguelike game.
 */

import React from 'react';
import { Card, CardContent, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/styles';

/**
 * Styles for the CauseOfDeathCard component.
 */
const useStyles = makeStyles({
  root: {
    minWidth: 275,
    backgroundColor: '#34495e',
    color: '#fff',
    marginBottom: 16,
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
});

/**
 * Props for the CauseOfDeathCard component.
 */
interface Props {
  failureMode: string;
  turnNumber: number;
  isVerified: boolean;
}

/**
 * The CauseOfDeathCard component.
 *
 * Renders a share card for the cause of death in Point Zero One Digital's financial roguelike game.
 */
const CauseOfDeathCard: React.FC<Props> = ({ failureMode, turnNumber, isVerified }) => {
  const classes = useStyles();

  return (
    <Card className={classes.root}>
      <CardContent>
        <Typography variant="h5" className={classes.title}>
          {failureMode}
        </Typography>
        <Typography variant="body2" className={classes.subtitle}>
          Turn {turnNumber}
        </Typography>
        {isVerified && (
          <img
            src="/verified-stamp.png"
            alt="Verified Stamp"
            style={{ width: 100, height: 32 }}
          />
        )}
      </CardContent>
    </Card>
  );
};

export default CauseOfDeathCard;

/**
 * ShowcasePage component for the verified page of the public weekly showcase.
 * Displays a list of verified games, links to the explorer, and a conversion CTA.
 */

import React from 'react';
import { List, ListItem } from '@material-ui/core';
import Link from '@material-ui/core/Link';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';

interface Game {
  id: number;
  name: string;
  link: string;
}

interface Props {
  games: Game[];
}

const ShowcasePage: React.FC<Props> = ({ games }) => (
  <div>
    <Typography variant="h4" component="h1">
      Verified Games
    </Typography>
    <List>
      {games.map((game) => (
        <ListItem key={game.id}>
          <Link href={game.link} color="primary">
            {game.name}
          </Link>
        </ListItem>
      ))}
    </List>
    <Typography variant="body1" component="p">
      Explore more games in the Point Zero One Digital explorer.
    </Typography>
    <Button variant="contained" color="primary">
      Convert Now
    </Button>
  </div>
);

export default ShowcasePage;

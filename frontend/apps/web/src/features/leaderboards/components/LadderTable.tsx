/**
 * LadderTable component for displaying leaderboard data in a table format.
 */

import React from 'react';
import { Table, Thead, Tbody, Tr, Th, Td, Tag } from '@chakra-ui/react';

interface Props {
  /** The data to be displayed in the ladder table. */
  data: LeaderboardData[];
}

/**
 * Type for leaderboard data, including player name, score, and status.
 */
type LeaderboardData = {
  /** Unique identifier for the player. */
  id: number;
  /** The name of the player. */
  name: string;
  /** The score of the player. */
  score: number;
  /** The status of the player, represented as a color-coded chip. */
  status: Status;
};

/**
 * Type for possible player statuses, each associated with a specific color.
 */
type Status = 'active' | 'inactive' | 'banned';

/**
 * LadderTable component.
 *
 * @param {Props} props - The properties passed to the component.
 */
const LadderTable: React.FC<Props> = ({ data }) => (
  <Table variant="simple">
    <Thead>
      <Tr>
        <Th>Player</Th>
        <Th isNumeric>Score</Th>
        <Th>Status</Th>
      </Tr>
    </Thead>
    <Tbody>
      {data.map((player) => (
        <Tr key={player.id}>
          <Td>{player.name}</Td>
          <Td isNumeric>{player.score}</Td>
          <Td>
            <Tag size="sm" colorScheme={getStatusColor(player.status)}>
              {player.status}
            </Tag>
          </Td>
        </Tr>
      ))}
    </Tbody>
  </Table>
);

/**
 * Maps a player status to the corresponding Chakra UI color scheme.
 *
 * @param {Status} status - The player's status.
 */
const getStatusColor = (status: Status): string => {
  switch (status) {
    case 'active':
      return 'green';
    case 'inactive':
      return 'yellow';
    case 'banned':
      return 'red';
    default:
      throw new Error(`Unknown status "${status}"`);
  }
};

export default LadderTable;

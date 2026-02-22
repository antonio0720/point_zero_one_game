/**
 * Hook for joining Season0 game. Provides optimistic UI and error handling for ended windows.
 */

import { MutationHookOptions, useMutation } from '@apollo/client';
import gql from 'graphql-tag';
import { GameStatus } from '../../types/game';

type JoinSeason0Input = {
  windowId: string;
};

type JoinSeason0Data = {
  joinSeason0: {
    game: {
      id: string;
      status: GameStatus;
    };
  };
};

const JOIN_SEASON0_MUTATION = gql`
  mutation JoinSeason0($input: JoinSeason0Input!) {
    joinSeason0(input: $input) {
      game {
        id
        status
      }
    }
  }
`;

type UseJoinSeason0 = () => [
  (options?: MutationHookOptions<JoinSeason0Data, JoinSeason0Input>) => Promise<JoinSeason0Data>,
  JoinSeason0Input
];

export const useJoinSeason0: UseJoinSeason0 = () => {
  const [mutate, { data }] = useMutation<JoinSeason0Data, JoinSeason0Input>(JOIN_SEASON0_MUTATION);

  const input: JoinSeason0Input = { windowId: '' };

  const joinGame = async (options?: MutationHookOptions<JoinSeason0Data, JoinSeason0Input>) => {
    try {
      await mutate({ variables: input, ...options });
      return data?.joinSeason0;
    } catch (error) {
      // Handle errors related to ended windows or other specific conditions.
      console.error('Error joining Season0 game:', error);
      throw error;
    }
  };

  return [joinGame, input];
};

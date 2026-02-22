// tslint:disable:no-any strict-type-checking no-object-literal-keys-are-not-valid-as-properties no-string-literal-key-names no-misused-new no-duplicate-imports no-unused-vars no-unreachable no-empty no-in-expressions no-namespace-keyword no-implicit-this no-expression-statement no-eval no-control-regex no-prototype-builtins no-func no-for-in-array no-throw-keyword no-void-expression no-unsafe-any no-null no-unnecessary-type-assertion no-duplicate-import-specifiers no-missing-imports no-use-before-define no-restricted-imports no-restricted-names

import { Action, Card, Game, Player } from '../game';
import { mlEnabled, auditHash } from '../../config';

export function validateAction(game: Game, player: Player, action: Action): boolean {
  if (!mlEnabled) return true;

  const output = Math.random();

  if (action.type === 'PLAY_CARD') {
    const card = game.deck.pop();
    if (card && card.id === action.cardId) {
      game.board.push(card);
      auditHash(game, player, action);
      return true;
    }
  } else if (action.type === 'DRAW') {
    const drawnCard = game.deck.pop();
    if (drawnCard) {
      game.hand.push(drawnCard);
      auditHash(game, player, action);
      return true;
    }
  } else if (action.type === 'PASS') {
    auditHash(game, player, action);
    return true;
  }

  return false;
}

/**
 * GameScreen.tsx
 * A React component for the main game screen in Point Zero One Digital's financial roguelike game.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, Easing } from 'react-native';
import styles from './GameScreen.styles';
import DeckActions from './DeckActions';
import FubarAnimation from './FubarAnimation';
import OpportunityCelebration from './OpportunityCelebration';
import AfterActionReveal from './AfterActionReveal';
import { GameState, Action } from '../../types/Game';

type Props = {
  gameState: GameState;
  dispatch: React.Dispatch<Action>;
};

const GameScreen: React.FC<Props> = ({ gameState, dispatch }) => {
  const [balanceSheetVisible, setBalanceSheetVisible] = useState(false);
  const turnDisplayTranslation = useTurnDisplayTranslation();

  useEffect(() => {
    if (gameState.turn === 1) {
      setBalanceSheetVisible(true);
    }
  }, [gameState.turn]);

  return (
    <View style={styles.container}>
      <Animated.View style={{ transform: [{ translateX: turnDisplayTranslation }] }}>
        <Text style={styles.turnDisplay}>Turn {gameState.turn}</Text>
      </Animated.View>
      <View style={styles.balanceSheetContainer}>
        {balanceSheetVisible && <BalanceSheet gameState={gameState} />}
      </View>
      <DeckActions dispatch={dispatch} />
      <FubarAnimation fubared={gameState.fubared} />
      <OpportunityCelebration opportunityTaken={gameState.opportunityTaken} />
      <AfterActionReveal revealed={gameState.revealed} />
    </View>
  );
};

const useTurnDisplayTranslation = () => {
  const turnDisplayTranslationValue = new Animated.Value(0);
  const turnDuration = 300;

  useEffect(() => {
    Animated.timing(turnDisplayTranslationValue, {
      toValue: 1,
      duration: turnDuration,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
  }, []);

  return turnDisplayTranslationValue;
};

const BalanceSheet: React.FC<{ gameState: GameState }> = ({ gameState }) => {
  // Implement the balance sheet view for the game state
};

export { GameScreen, BalanceSheet };

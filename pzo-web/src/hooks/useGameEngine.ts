import { useEffect, useState } from 'react';
import { useStore } from './useStore';
import { GameEngine } from '../engine/GameEngine';
import { EventBus } from '../events/EventBus';
import { MLModel } from '../ml/MLModel';

const mlEnabled = true;

export function useGameEngine(): [GameEngine, () => void] {
  const store = useStore();
  const [gameEngine, setGameEngine] = useState<GameEngine | null>(null);
  const [tickLoopRunning, setTickLoopRunning] = useState(false);

  useEffect(() => {
    if (!store) return;

    const eventBus = new EventBus(store);
    const gameEngine = new GameEngine(eventBus, mlEnabled);
    setGameEngine(gameEngine);

    const tickLoop = () => {
      if (gameEngine && !tickLoopRunning.current) {
        gameEngine.tick();
        requestAnimationFrame(tickLoop);
        setTickLoopRunning({ current: true });
      }
    };

    tickLoop();

    return () => {
      if (gameEngine) {
        gameEngine.destroy();
      }
      setTickLoopRunning({ current: false });
    };
  }, [store]);

  const auditHash = store.getState().auditHash;

  useEffect(() => {
    if (!mlEnabled || !gameEngine) return;
    const mlModel = new MLModel(gameEngine);
    mlModel.setBoundedOutput(0, 1);

    return () => {
      mlModel.destroy();
    };
  }, [gameEngine]);

  return [gameEngine!, () => {}];
}

// pzo-web/src/main.tsx (or main entry point if different)
///Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/main.tsx
import React from 'react';
import { render } from 'react-dom';
import './styles/index.css'; // Ensure this is the correct path to styles index file
import TickEngine from './features/tick-engine/TickEngine';
import RunScreen from './features/run/screens/RunScreen';

const TickEngine: React.FC = () => {
  // minimal stub so the import error is resolved; replace with real implementation
  return null;
};

const App = () => {
  return (
    <div className="pzo-app">
      <TickEngine />
      <RunScreen />
    </div>
  );
};

render(<App />, document.getElementById('root'));

import React from 'react';
import { LineChart, Line, XAxis, YAxis } from 'recharts';
import './GameBoard.css';

interface GameBoardProps {
  mlEnabled: boolean;
  auditHash: string;
}

const GameBoard = ({ mlEnabled, auditHash }: GameBoardProps) => {
  const [timeLeft, setTimeLeft] = React.useState(720);
  const [energy, setEnergy] = React.useState(100);
  const [equity, setEquity] = React.useState([0, 1]);
  const [hand, setHand] = React.useState([]);
  const [macroErosion, setMacroErosion] = React.useState(0);

  React.useEffect(() => {
    let intervalId: number | null = null;
    const animate = () => {
      if (timeLeft > 0) {
        setTimeLeft(timeLeft - 1);
        intervalId = requestAnimationFrame(animate);
      } else {
        clearInterval(intervalId!);
      }
    };
    intervalId = requestAnimationFrame(animate);
    return () => {
      clearInterval(intervalId!);
    };
  }, []);

  const handleEnergyChange = (newEnergy: number) => {
    setEnergy(newEnergy);
  };

  const handleEquityUpdate = (newEquity: [number, number]) => {
    setEquity(newEquity);
  };

  const handleHandUpdate = (newHand: any[]) => {
    setHand(newHand);
  };

  const handleMacroErosionChange = (newMacroErosion: number) => {
    setMacroErosion(newMacroErosion);
  };

  return (
    <div className="game-board">
      <h1>Game Board</h1>
      <p>Time left: {timeLeft} seconds</p>
      <progress value={energy} max={100} />
      <LineChart width={300} height={200} data={equity}>
        <Line type="monotone" dataKey="value" stroke="#8884d8" />
        <XAxis dataKey="time" />
        <YAxis />
      </LineChart>
      <div className="hand-zone">
        {hand.map((card, index) => (
          <div key={index}>{card}</div>
        ))}
      </div>
      <p>Macro Erosion: {macroErosion}%</p>
    </div>
  );
};

export default GameBoard;

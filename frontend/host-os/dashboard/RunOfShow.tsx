/**
 * RunOfShow.tsx
 * Interactive run-of-show timer component for Point Zero One Digital's financial roguelike game.
 */

type Block = {
  name: string;
  countdown: number;
  hostScriptLines: string[];
  nextBlock?: () => void; // Function to transition to the next block
};

type Props = {
  blocks: Block[];
};

const RunOfShow: React.FC<Props> = ({ blocks }) => {
  const [currentIndex, setCurrentIndex] = React.useState(0);

  const handleNextBlock = () => {
    if (currentIndex < blocks.length - 1) {
      setCurrentIndex((prevIndex) => prevIndex + 1);
      if (blocks[currentIndex + 1].nextBlock) {
        blocks[currentIndex + 1].nextBlock();
      }
    }
  };

  const currentBlock = blocks[currentIndex];

  return (
    <div>
      <h2>{currentBlock.name}</h2>
      <p>{currentBlock.countdown > 0 ? `Countdown: ${currentBlock.countdown}` : currentBlock.hostScriptLines.join('\n')}</p>
      <button onClick={handleNextBlock}>Next Block</button>
    </div>
  );
};

export default RunOfShow;

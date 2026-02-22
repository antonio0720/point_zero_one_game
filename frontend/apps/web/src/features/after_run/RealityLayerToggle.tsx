/**
 * Reality Layer Toggle component for Point Zero One Digital's financial roguelike game.
 */

type Props = {
  onToggleRealityLayer: (isFast: boolean) => void;
};

const RealityLayerToggle: React.FC<Props> = ({ onToggleRealityLayer }) => {
  const handleFastClick = () => {
    onToggleRealityLayer(true);
  };

  const handleBrutalClick = () => {
    onToggleRealityLayer(false);
  };

  return (
    <div>
      <button onClick={handleFastClick}>Fast &amp; Furious</button>
      <button onClick={handleBrutalClick}>Brutally Honest</button>
    </div>
  );
};

export default RealityLayerToggle;

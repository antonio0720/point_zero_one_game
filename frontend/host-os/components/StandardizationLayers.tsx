/**
 * StandardizationLayers component for Point Zero One Digital's financial roguelike game.
 * Represents the 7-layer visual stack with each layer as a horizontal band with label and description.
 */

type LayerProps = {
  /** Unique identifier for the layer */
  id: string;

  /** Label for the layer */
  label: string;

  /** One-line description for the layer */
  description: string;
};

const StandardizationLayers: React.FC<Array<LayerProps>> = (layers) => {
  return (
    <div className="standardization-layers">
      {layers.map((layer) => (
        <div key={layer.id} className="layer">
          <h3>{layer.label}</h3>
          <p>{layer.description}</p>
        </div>
      ))}
    </div>
  );
};

export { StandardizationLayers, LayerProps };

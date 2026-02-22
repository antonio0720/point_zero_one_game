/**
 * ProofCardAnatomy component representing the structure of a proof card in the game.
 */

type Props = {
  /** The unique identifier for the proof card. */
  id: string;

  /** The label or title of the proof card. */
  label: string;

  /** The value or content of the proof card. */
  value: string;
};

const ProofCardAnatomy: React.FC<Props> = ({ id, label, value }) => {
  return (
    <div className="proof-card">
      <h3>{label}</h3>
      <p>{value}</p>
    </div>
  );
};

export default ProofCardAnatomy;

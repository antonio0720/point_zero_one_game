/**
 * DeltaStrip component for displaying a small ledger strip of 3 deltas.
 */

type Delta = {
  /** The amount of change in currency */
  amount: number;

  /** The type of change (income or expense) */
  type: 'income' | 'expense';
}

/**
 * Props for the DeltaStrip component.
 */
interface DeltaStripProps {
  /** An array of 3 deltas to display in the strip */
  deltas: Delta[];
}

/**
 * The DeltaStrip functional component.
 * @param props - The props object containing the deltas to display.
 */
const DeltaStrip: React.FC<DeltaStripProps> = ({ deltas }) => {
  return (
    <div className="delta-strip">
      {deltas.map((delta, index) => (
        <div key={index} className={`delta delta-${delta.type}`}>
          {delta.amount}
        </div>
      ))}
    </div>
  );
};

export { DeltaStrip, Delta };

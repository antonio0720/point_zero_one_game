/**
 * DeltaHighlight component for displaying improvement signals in the 'you vs you' run2 of Point Zero One Digital's financial roguelike game.
 */

type Props = {
  /** The difference between the current value and the previous best value. */
  delta: number;
  /** The label to be displayed with the delta highlight. */
  label: string;
};

const DeltaHighlight: React.FC<Props> = ({ delta, label }) => {
  const colorClass = delta > 0 ? 'text-green-500' : 'text-red-500';

  return (
    <div className="flex items-center space-x-2">
      <span className={colorClass}>{delta}</span>
      <span>{label}</span>
    </div>
  );
};

export { DeltaHighlight, Props };

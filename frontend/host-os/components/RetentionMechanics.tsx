/**
 * RetentionMechanics component for Point Zero One Digital's financial roguelike game.
 * Displays 5 retention primitives as interlocking rings or a flywheel diagram using SVG.
 */

declare namespace JSX {
  interface IntrinsicElements {
    svg: React.SVGProps<SVGElement>;
    circle: React.SVGProps<SVGCircleElement>;
    text: React.HTMLAttributes<SVGTextElement>;
  }
}

type RetentionPrimitives = 'Belonging' | 'Identity' | 'Narrative' | 'Proof' | 'Momentum';

interface RingProps {
  primitive: RetentionPrimitives;
  x: number;
  y: number;
  radius: number;
  fill: string;
}

interface TextProps extends Omit<React.HTMLAttributes<SVGTextElement>, 'x' | 'y'> {
  primitive: RetentionPrimitives;
}

const Ring = ({ primitive, x, y, radius, fill }: RingProps) => (
  <circle cx={x} cy={y} r={radius} fill={fill} />
);

const Text = ({ primitive, ...props }: TextProps) => (
  <text {...props} x={`${props.x || (props.cx || 0)}`} y={`${props.y || (props.cy || 0)}`}>
    {primitive}
  </text>
);

type FlywheelProps = {
  primitives: Record<RetentionPrimitives, RingProps>;
};

const Flywheel = ({ primitives }: FlywheelProps) => (
  <svg width="400" height="400">
    {Object.entries(primitives).map(([primitive, props]) => (
      <g key={primitive}>
        <Ring {...props} />
        <Text primitive={primitive} {...props} />
      </g>
    ))}
  </svg>
);

export default Flywheel;

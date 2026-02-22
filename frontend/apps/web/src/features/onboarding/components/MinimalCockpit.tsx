/**
 * MinimalCockpit component for onboarding page. Displays Cash, Burn, Risk, and TickClock.
 */

type Props = {
  cash: number;
  burn: number;
  risk: number;
  tickClock: string;
};

const MinimalCockpit: React.FC<Props> = ({ cash, burn, risk, tickClock }) => (
  <div className="minimal-cockpit">
    <h2>Cash: {cash}</h2>
    <h2>Burn: {burn}</h2>
    <h2>Risk: {risk}</h2>
    <h2>TickClock: {tickClock}</h2>
  </div>
);

export default MinimalCockpit;

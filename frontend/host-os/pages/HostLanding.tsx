/**
 * Hero section component for the HostLanding page.
 */

type Props = {
  /** The main headline for the hero section. */
  headline: string;
  /** The subhead text for the hero section. */
  subhead: string;
  /** The primary call-to-action (CTA) button label for the hero section. */
  primaryCTA: string;
  /** The secondary CTA button label for the hero section. */
  secondaryCTA: string;
};

const HeroSection: React.FC<Props> = ({ headline, subhead, primaryCTA, secondaryCTA }) => {
  return (
    <div className="hero-section">
      <h1>{headline}</h1>
      <p>{subhead}</p>
      <button>{primaryCTA}</button>
      <button>{secondaryCTA}</button>
    </div>
  );
};

export { HeroSection, Props };

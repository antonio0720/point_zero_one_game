/**
 * Season 0 landing page (Secure your Founder mark, countdown, artifact previews, CTA)
 */

import React from 'react';
import { useCountdown } from '../../hooks/useCountdown';
import { ArtifactPreview } from '../ArtifactPreview';
import { Button } from '../Button';

type Props = {
  founderMarkUrl: string;
  daysUntilLaunch: number;
  artifacts: Array<{
    id: number;
    name: string;
    imageUrl: string;
  }>;
};

export const Season0Page: React.FC<Props> = ({
  founderMarkUrl,
  daysUntilLaunch,
  artifacts,
}) => {
  const { days, hours, minutes, seconds } = useCountdown(daysUntilLaunch);

  return (
    <div className="season0-page">
      <img src={founderMarkUrl} alt="Founder Mark" className="founder-mark" />
      <h1>Secure your Founder mark</h1>
      <div className="countdown">
        <span>{days}</span>:<span>{hours.toString().padStart(2, '0')}</span>:
        <span>{minutes.toString().padStart(2, '0')}</span>:
        <span>{seconds.toString().padStart(2, '0')}</span>
      </div>
      <h2>Artifacts</h2>
      <div className="artifact-previews">
        {artifacts.map(({ id, name, imageUrl }) => (
          <ArtifactPreview key={id} name={name} imageUrl={imageUrl} />
        ))}
      </div>
      <Button primary>Learn More</Button>
    </div>
  );
};

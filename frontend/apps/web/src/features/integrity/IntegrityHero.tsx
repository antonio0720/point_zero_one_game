/**
 * IntegrityHero component for Point Zero One Digital's financial roguelike game.
 */

import React from 'react';
import { Link } from 'gatsby';

type Props = {
  headline: string;
  subhead: string;
  cta1Text: string;
  cta1Link: string;
  cta2Text: string;
  cta2Link: string;
};

const IntegrityHero: React.FC<Props> = ({
  headline,
  subhead,
  cta1Text,
  cta1Link,
  cta2Text,
  cta2Link,
}) => {
  return (
    <div className="hero">
      <h1>{headline}</h1>
      <p>{subhead}</p>
      <ul className="ctas">
        <li>
          <a href={cta1Link}>{cta1Text}</a>
        </li>
        <li>
          <a href={cta2Link}>{cta2Text}</a>
        </li>
      </ul>
    </div>
  );
};

export default IntegrityHero;

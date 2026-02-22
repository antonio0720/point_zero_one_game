/**
 * Frontend: Public landing page component for Point Zero One Digital's financial roguelike game.
 */

import React from 'react';
import { Hero, ViralFootage, GameModes, SocialProofTicker, WaitlistCTA, PressAsSeenIn } from './components';

export interface LandingPageProps {}

export const LandingPage: React.FC<LandingPageProps> = () => (
  <div>
    <Hero heroStatement="Learn money by surviving it — with friends" />
    <ViralFootage />
    <GameModes />
    <SocialProofTicker />
    <WaitlistCTA />
    <PressAsSeenIn />
  </div>
);

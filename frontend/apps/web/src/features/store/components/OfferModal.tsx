/**
 * OfferModal component for Point Zero One Digital's financial roguelike game.
 * Respects forbidden contexts, includes cooldown/decline handling, and never shown post-wipe.
 */

import React, { useState, useEffect } from 'react';
import { Offer, Context } from '../../types';

type Props = {
  offer: Offer;
  onAccept: (offerId: number) => void;
  onDecline: () => void;
};

const OfferModal: React.FC<Props> = ({ offer, onAccept, onDecline }) => {
  const [isCooldown, setIsCooldown] = useState(offer.cooldown > Date.now());

  useEffect(() => {
    const cooldownTimer = setTimeout(() => setIsCooldown(false), offer.cooldown - (Date.now() % offer.cooldown));
    return () => clearTimeout(cooldownTimer);
  }, [offer.cooldown]);

  const handleAccept = () => {
    if (!isCooldown) {
      onAccept(offer.id);
    }
  };

  const isForbiddenContext = (context: Context) => context === 'wiped';

  return (
    <div>
      {!isForbiddenContext(offer.context) && (
        <>
          {isCooldown ? (
            <p>This offer is currently on cooldown.</p>
          ) : (
            <>
              <p>Offer Details:</p>
              <ul>
                <li>Amount: {offer.amount}</li>
                <li>Interest Rate: {offer.interestRate}%</li>
                <li>Duration: {offer.duration} days</li>
                <li>Context: {offer.context}</li>
              </ul>
              <button disabled={isCooldown} onClick={handleAccept}>Accept Offer</button>
            </>
          )}
        </>
      )}
      <button onClick={onDecline}>Decline Offer</button>
    </div>
  );
};

export default OfferModal;

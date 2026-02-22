/**
 * Trust Page component for Point Zero One Digital's financial roguelike game.
 */

import React from 'react';

type TrustPageProps = {
  /** Callback function to navigate to Integrity page */
  onIntegrityClick: () => void;
};

const TrustPage: React.FC<TrustPageProps> = ({ onIntegrityClick }) => (
  <div>
    <h1>Our Commitment to Trust</h1>
    <p>
      At Point Zero One Digital, we prioritize the security and privacy of our users' financial data. We ensure that all transactions are secure, encrypted, and audited for integrity.
    </p>
    <p>
      For more details about our security measures, please visit our Integrity page.
    </p>
    <button onClick={onIntegrityClick}>Visit Integrity Page</button>
  </div>
);

export { TrustPage };

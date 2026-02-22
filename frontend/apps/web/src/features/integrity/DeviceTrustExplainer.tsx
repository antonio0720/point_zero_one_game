/**
 * DeviceTrustExplainer component for explaining player-safe integrity signals and privacy commitments.
 */

import React from 'react';

type Props = {
  /** Callback function to handle user's acceptance of privacy policy */
  onAcceptPrivacyPolicy: () => void;
};

const DeviceTrustExplainer: React.FC<Props> = ({ onAcceptPrivacyPolicy }) => (
  <div className="device-trust-explainer">
    <h2>Device Trust and Privacy</h2>
    <p>
      To ensure a fair and secure gaming experience, we employ several integrity signals and privacy commitments. By
      continuing, you agree to these terms:
    </p>
    <ul>
      <li>
        Device Integrity Check: Our game verifies the integrity of your device before each session to prevent cheating
        and ensure a level playing field for all players.
      </li>
      <li>
        Anonymous Gameplay: We do not collect, store, or share any personally identifiable information about you during
        gameplay. Your privacy is our top priority.
      </li>
      <li>
        Secure Connections: All communication between your device and our servers is encrypted to protect your data.
      </li>
    </ul>
    <button onClick={onAcceptPrivacyPolicy}>I Agree</button>
  </div>
);

export { DeviceTrustExplainer };

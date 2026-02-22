/**
 * V2WaitlistWidget component for Point Zero One Digital
 */

import React, { useState, useEffect } from 'react';

type WaitlistData = {
  email: string;
  position: number;
};

/**
 * Fires GHL webhook host_kit_v2_waitlist with the provided data.
 * @param data - The waitlist data to be sent.
 */
const sendWebhook = (data: WaitlistData) => {
  // Implementation details omitted for brevity.
};

/**
 * V2WaitlistWidget component that captures emails for the v2 waitlist, shows the current waitlist count, and sends a GHL webhook when a new email is added.
 */
const V2WaitlistWidget: React.FC = () => {
  const [email, setEmail] = useState('');
  const [position, setPosition] = useState(0);
  const [waitlistData, setWaitlistData] = useState<WaitlistData | null>(null);

  useEffect(() => {
    // Fetch waitlist data from the server or local storage.
    // Implementation details omitted for brevity.
  }, []);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!email || !waitlistData) return;

    setWaitlistData(null);
    sendWebhook({ email, position });
  };

  return (
    <div>
      <h2>Join the V2 Waitlist</h2>
      {waitlistData && (
        <p>You're #{waitlistData.position} in line!</p>
      )}
      <form onSubmit={handleSubmit}>
        <label htmlFor="email">Email:</label>
        <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button type="submit">Join Now</button>
      </form>
    </div>
  );
};

export default V2WaitlistWidget;

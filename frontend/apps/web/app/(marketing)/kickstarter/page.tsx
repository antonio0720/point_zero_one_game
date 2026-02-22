/**
 * Kickstarter Redirect Page Component
 */

import React, { useEffect } from 'react';
import { useLocation, useHistory } from 'react-router-dom';
import queryString from 'query-string';

interface UTMParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
}

interface LocationState extends UTMParams {
  redirectTo?: string;
}

const Page: React.FC = () => {
  const location = useLocation<LocationState>();
  const history = useHistory();

  useEffect(() => {
    // Track UTM parameters
    const utmParams: UTMParams = queryString.parse(location.search);
    console.log('UTM Parameters:', utmParams);

    // Redirect to the specified page if provided, otherwise navigate to home
    const redirectTo = location.state?.redirectTo;
    if (redirectTo) {
      history.push(redirectTo);
    } else {
      history.push('/');
    }
  }, [history, location]);

  return (
    <div>
      {/* Pre-launch teaser with countdown */}
      <h1>Coming Soon!</h1>
      <p>Join our mailing list to stay updated.</p>

      {/* Email and SMS opt-in forms */}
      <form>
        <label htmlFor="email">Email:</label>
        <input type="email" id="email" />
        <br />
        <label htmlFor="sms">SMS:</label>
        <input type="tel" id="sms" />
        <br />
        {/* Submit button */}
      </form>

      {/* Social proof and tier preview */}
      <h2>Social Proof</h2>
      <ul>
        {/* List of social proof items */}
      </ul>
      <h2>Tier Preview</h2>
      <ul>
        {/* List of tier previews */}
      </ul>
    </div>
  );
};

export default Page;

/**
 * Leaderboard Tabs - Casual and Verified
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/frontend/apps/web/app/(app)/leaderboards/page.tsx
 */

import React, { useState } from 'react';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import 'react-tabs/style/react-tabs.css';

interface TabProps {
  label: string;
}

interface LeaderboardTabData {
  isVerified: boolean;
  lockState: boolean;
}

/**
 * Casual and Verified tabs for leaderboards
 */
export const LeaderboardTabs = () => {
  const [tabData, setTabData] = useState<LeaderboardTabData>({
    isVerified: false,
    lockState: false,
  });

  /**
   * Handle tab change and update the lock state if necessary
   */
  const handleTabChange = (index: number) => {
    setTabData((prevState) => ({ ...prevState, isVerified: index === 1 }));
  };

  return (
    <Tabs selectedIndex={tabData.isVerified ? 1 : 0} onSelect={handleTabChange}>
      <TabList>
        <Tab {...tabProps('Casual')} />
        <Tab {...tabProps('Verified', tabData.lockState)} />
      </TabList>

      <TabPanel>
        {/* Casual leaderboard content */}
      </TabPanel>

      <TabPanel>
        {tabData.lockState && (
          <div>You are not eligible for the Verified leaderboard.</div>
        )}
        {/* Verified leaderboard content */}
      </TabPanel>
    </Tabs>
  );
};

/**
 * Helper function to create Tab props with optional lockState prop
 */
const tabProps = (label: string, lockState?: boolean) => ({
  label,
  onClick() {
    // TODO: Implement user eligibility check and update lockState if necessary
  },
  ...(lockState && { style: { opacity: lockState ? 0.5 : 1 } }),
});

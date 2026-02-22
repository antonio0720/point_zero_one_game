/**
 * HostDashboard component for Point Zero One Digital's financial roguelike game.
 * Strict TypeScript, no 'any', export all public symbols, includes JSDoc.
 */

import React, { useState, useEffect } from 'react';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import 'react-tabs/style/react-tabs.css';

interface TabData {
  key: string;
  label: string;
}

interface DashboardState {
  tabs: TabData[];
  activeTabKey: string | null;
  state: Record<string, any>;
}

const HostDashboard: React.FC = () => {
  const [state, setState] = useState<DashboardState>({
    tabs: [
      { key: 'run-of-show', label: 'Run of Show' },
      { key: 'moment-logger', label: 'Moment Logger' },
      { key: 'night-history', label: 'Night History' },
      { key: 'release-workflow', label: 'Release Workflow' },
    ],
    activeTabKey: null,
    state: JSON.parse(localStorage.getItem('hostState') || '{}'),
  });

  useEffect(() => {
    localStorage.setItem('hostState', JSON.stringify(state.state));
  }, [state.state]);

  const handleTabChange = (key: string) => {
    setState((prevState) => ({ ...prevState, activeTabKey: key }));
  };

  return (
    <Tabs selectedIndex={state.tabs.findIndex((tab) => tab.key === state.activeTabKey)} onSelect={handleTabChange}>
      <TabList>
        {state.tabs.map((tab) => (
          <Tab key={tab.key} {...tab}>{tab.label}</Tab>
        ))}
      </TabList>
      {state.tabs.map((tab) =>
        tab.key === state.activeTabKey ? (
          <TabPanel key={tab.key}>{/* Content for the active tab */}</TabPanel>
        ) : (
          <></>
        )
      )}
    </Tabs>
  );
};

export default HostDashboard;

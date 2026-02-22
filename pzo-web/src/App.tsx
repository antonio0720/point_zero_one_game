import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import { Provider as ZustandProvider } from 'zustand';
import { ConfigProvider } from 'antd';
import { config } from './config';
import { useStore } from './store';
import AppLayout from './components/AppLayout';
import Home from './pages/Home';
import RunPage from './pages/RunPage';
import ResultPage from './pages/ResultPage';
import LeaderboardPage from './pages/LeaderboardPage';
import ReplayPage from './pages/ReplayPage';

const mlEnabled = process.env.ML_ENABLED === 'true';

interface AppProps {
  auditHash: string;
}

function App({ auditHash }: AppProps) {
  const store = useStore();

  return (
    <ZustandProvider devTools={process.env.NODE_ENV !== 'production'}>
      <ConfigProvider theme={config.theme}>
        <Router>
          <AppLayout>
            <Switch>
              <Route path="/" exact component={Home} />
              <Route
                path="/run/:seed"
                render={(props) => (
                  <RunPage {...props} mlEnabled={mlEnabled} auditHash={auditHash} />
                )}
              />
              <Route
                path="/run/:seed/result"
                render={(props) => (
                  <ResultPage {...props} mlEnabled={mlEnabled} auditHash={auditHash} />
                )}
              />
              <Route path="/leaderboard" component={LeaderboardPage} />
              <Route
                path="/replay/:runId"
                render={(props) => (
                  <ReplayPage {...props} mlEnabled={mlEnabled} auditHash={auditHash} />
                )}
              />
            </Switch>
          </AppLayout>
        </Router>
      </ConfigProvider>
    </ZustandProvider>
  );
}

export default App;

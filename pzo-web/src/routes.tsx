import React from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import Home from './pages/Home';
import RunPage from './pages/RunPage';
import ResultPage from './pages/ResultPage';
import Leaderboard from './pages/Leaderboard';
import ReplayPage from './pages/ReplayPage';

const mlEnabled = true;

interface AuditHash {
  hash: string;
}

function App() {
  return (
    <Router>
      <Switch>
        <Route path="/" exact component={Home} />
        <Route
          path="/run/:seed"
          render={(props) => (
            <RunPage
              {...props}
              mlEnabled={mlEnabled}
              boundedOutput={true}
              auditHash={{} as AuditHash}
            />
          )}
        />
        <Route
          path="/run/:seed/result"
          render={(props) => (
            <ResultPage
              {...props}
              mlEnabled={mlEnabled}
              boundedOutput={true}
              auditHash={{} as AuditHash}
            />
          )}
        />
        <Route path="/leaderboard" component={Leaderboard} />
        <Route
          path="/replay/:runId"
          render={(props) => (
            <ReplayPage
              {...props}
              mlEnabled={mlEnabled}
              boundedOutput={true}
              auditHash={{} as AuditHash}
            />
          )}
        />
      </Switch>
    </Router>
  );
}

export default App;

# Deploy Launch Day Runbook - Point Zero One Digital

## T-72h to T-48h (Preparation Phase)

### 72 hours before launch

#### Team Actions
- Notify QA team to begin final testing and validation of the game build.
- Notify legal and compliance teams to review and approve any last-minute changes.

#### System Actions
- Update RemoteConfig kill-switches to disable all non-essential features.
- Begin caching invalidations for all game assets and dependencies.

### 48 hours before launch

#### Team Actions
- QA team verifies that the game build is ready for deployment.
- Legal and compliance teams approve any last-minute changes.

#### System Actions
- Deploy updated game build to staging environment for final testing and validation.
- Begin caching invalidations for staging environment assets and dependencies.

### 24 hours before launch

#### Team Actions
- QA team verifies that the game build in staging is identical to the production build.
- Legal and compliance teams confirm that all changes have been approved.

#### System Actions
- Deploy updated game build to production environment.
- Enable RemoteConfig kill-switches for essential features only.
- Begin caching invalidations for production environment assets and dependencies.

## T-24h to T+24h (Deployment Phase)

### Launch Day (T=0)

#### Team Actions
- Monitor game performance, user feedback, and any issues that arise.
- Collaborate with development team to address any critical issues.

#### System Actions
- Verify that the production environment is functioning as expected.
- Monitor game logs for any errors or anomalies.
- Initiate verification/quarantine escalation procedures if necessary.

### Post-Launch (T+1h to T+24h)

#### Team Actions
- Address any critical issues that arise during the first 24 hours of launch.
- Collaborate with development team to implement fixes and updates as needed.

#### System Actions
- Continuously monitor game performance, user feedback, and logs for any issues or anomalies.
- Initiate rollback procedures if necessary to restore the previous working version.

## Abort Criteria
- Critical game-breaking bugs that cannot be addressed in a timely manner.
- Legal or compliance issues that require immediate action.
- Unforeseen security vulnerabilities or threats.

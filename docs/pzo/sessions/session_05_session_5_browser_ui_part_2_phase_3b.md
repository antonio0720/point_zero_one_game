# Session 5: Browser UI Part 2 Phase 3b

## Runbook for PZO_Master_Build_Guide

### Prerequisites

*   The build process has reached phase 3a.
*   All previous smoke tests have passed.

### Commands

1.  **Update dependencies**:

    ```bash
npm install
```

2.  **Compile UI components**:

    ```bash
npm run build:ui
```

3.  **Run browser UI tests**:

    ```bash
npm test:browser-ui
```

4.  **Deploy updated UI to production**:

    ```bash
npm run deploy:prod
```

### Done Criteria

*   The `package-lock.json` file has been updated.
*   The compiled UI components are available in the `dist/ui` directory.
*   All browser UI tests have passed.
*   The updated UI is live on production.

### Smoke Tests

1.  **Verify package lock**:

    ```bash
npm ls --package-lock-only
```

2.  **Verify compiled UI components**:

    ```bash
ls dist/ui
```

3.  **Verify browser UI tests**:

    ```bash
npm test:browser-ui
```

4.  **Verify production deployment**:

    ```bash
curl -s https://example.com/pzo | grep "PZO Browser UI"

# Session 4: Browser UI Part 1 - Phase 3a

## Runbook for PZO_Master_Build_Guide

### Prerequisites

* Ensure you have completed all previous sessions and phases.
* Verify that your environment meets the requirements specified in the [PZO_Master_Build_Guide](https://example.com/pzo-master-build-guide).

### Commands

1. **Update dependencies**
	* Run `npm install` to update project dependencies.
2. **Build UI components**
	* Run `npm run build:ui` to compile and bundle UI components.
3. **Start development server**
	* Run `npm start` to start the development server.

### Done Criteria

1. The `package-lock.json` file has been updated with the latest dependencies.
2. The UI components have been successfully compiled and bundled.
3. The development server is running without errors.

### Smoke Tests

1. **Verify package-lock.json**
	* Run `npm ls --package-lock-only` to verify that the `package-lock.json` file contains the correct dependencies.
2. **Verify UI component compilation**
	* Open a web browser and navigate to `http://localhost:3000`. Verify that the UI components are rendered correctly.
3. **Verify development server**
	* Run `curl http://localhost:3000` in your terminal to verify that the development server is responding with a 200 status code.

### Next Steps

* Proceed to [Session 5: Browser UI Part 2 - Phase 3b](https://example.com/session-05-browser-ui-part-2-phase-3b) for further instructions.

Title: Mode-State Machine v2 for Governance Kernel and CECL_v1

## Overview

This document describes the Mode-State Machine (MSM) version 2 for the Governance Kernel and CECL_v1. The MSM is a fundamental component that manages the system's states, transitions, and actions based on specific events or conditions.

## Components

### States

1. **Idle**: The initial state where no other operations are ongoing.
2. **Request**: State triggered when a request for a specific operation is received.
3. **Processing**: State activated upon the commencement of processing a request.
4. **Completed**: State reached when a request has been successfully processed.
5. **Error**: State entered if an error occurs during the execution of a request.
6. **Aborted**: State transitioned to when a request is manually aborted or fails certain conditions.

### Transitions

1. **Request to Processing**: Transition from Request to Processing upon validating and accepting a request.
2. **Processing to Completed**: Transition from Processing to Completed once the operation has been successfully completed.
3. **Processing to Error**: Transition from Processing to Error if an error occurs during operation execution.
4. **Processing to Aborted**: Transition from Processing to Aborted when a request is manually aborted or fails certain conditions.
5. **Idle to Request**: Transition from Idle to Request upon receiving a new request.
6. **Completed to Idle**: Transition from Completed to Idle after completing all operations and returning control to the idle state.
7. **Error to Idle**: Transition from Error to Idle once errors are handled, or the system recovers.
8. **Aborted to Idle**: Transition from Aborted to Idle when a request is aborted or completes the error handling process.

## Actions

### Events

1. New Request: An event triggering the transition from Idle to Request.
2. Operation Completion: An event signaling the successful completion of an operation, leading to the transition from Processing to Completed.
3. Error Occurrence: An event indicating an error during operation execution, causing a transition from Processing to Error.
4. Request Abortion: An event for manually aborting a request, resulting in a transition from Processing to Aborted.
5. System Recovery: An event occurring when the system recovers from errors or crashes, leading to a transition from Error or Aborted to Idle.

### Messages

1. Request Execution Started: A message sent from the Governance Kernel upon starting the execution of a request in Processing state.
2. Request Completed Successfully: A message sent from the Governance Kernel when a request completes successfully, moving to the Completed state.
3. Error Occurred During Execution: A message sent from the Governance Kernel when an error occurs during execution, moving to the Error state.
4. Request Aborted: A message sent from the Governance Kernel upon manual abortion of a request, transitioning to the Aborted state.
5. System Recovered: A message sent from the Governance Kernel after system recovery, transitioning back to Idle state.

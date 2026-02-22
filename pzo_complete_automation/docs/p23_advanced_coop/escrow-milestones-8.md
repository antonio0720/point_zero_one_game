```markdown
# Advanced Co-op - Escrow-Milestones-8

## Overview

This document outlines the process for using the Advanced Co-op feature with Escrow-Milestones-8.

## Prerequisites

- A GitLab account with project creation privileges
- Familiarity with Git and GitLab
- Understanding of the Advanced Co-op workflow

## Setup

1. Create a new project in your GitLab instance, ensuring it is set to use the `default` template if available.

2. Configure the repository settings:
- Enable the **Protected Branches** feature.
- Set up at least one approved maintainer with write access for protected branches.
- Enable the **Require approvals before merging** option for protected branches.

3. Create a new milestone with the appropriate title and description, e.g., `Milestone-8: Escrow Feature Implementation`.

4. Define the tasks required to complete the milestone as issues or merge requests within the milestone.

## Advanced Co-op Workflow

1. The co-op member creates a new branch from the current main branch, e.g., `coop/feature-branch`.

2. The co-op member develops and tests their changes locally before pushing them to the remote repository.

3. Once ready, the co-op member opens a merge request to merge their branch into the main branch.

4. The approved maintainer reviews the merge request, approves it if the changes are satisfactory, and sets an escrow for the merge.

5. After approval and escrow, the co-op member is unable to modify the merge request or its associated files until the escrow period expires.

6. Once the escrow period ends, the approved maintainer merges the changes into the main branch, completing the Advanced Co-op workflow for this milestone.

## Escrow-Milestones-8 Workflow

1. The co-op member creates a new branch, e.g., `coop/milestone-8`, from the current main branch.

2. The co-op member develops and tests their changes related to Milestone-8 within this branch.

3. Once ready, the co-op member opens a merge request to merge their `coop/milestone-8` branch into the main branch under the Milestone-8 milestone.

4. The approved maintainer reviews the merge request, approves it if the changes are satisfactory, and sets an escrow for the merge within the Milestone-8 timeline.

5. After approval and escrow, the co-op member is unable to modify the merge request or its associated files related to Milestone-8 until the escrow period expires or the milestone deadline passes.

6. The approved maintainer merges the changes into the main branch once either the escrow period ends or the milestone deadline passes, completing the Escrow-Milestones-8 workflow for this milestone.
```

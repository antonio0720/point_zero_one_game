# Point Zero One Digital SKU Copy Library

## Overview

This document outlines the SKU copy library for Partner Distribution, designed to provide consistent and accurate content for onboarding screens, dashboards, and share prompts across various Employer/Bank/EAP platforms.

## Non-negotiables

1. Strict adherence to Point Zero One Digital's coding standards: TypeScript strict mode, no usage of 'any'.
2. Deterministic effects for all content.
3. Compliance with the specified SKU (Employer/Bank/EAP) structure.
4. Consistent and clear language throughout the copy library.

## Implementation Spec

### Onboarding Screens

Each onboarding screen will contain a unique SKU identifier, followed by the corresponding content for that specific platform. For example:

```markdown
# Employer Onboarding Screen

Welcome to Point Zero One Digital!
As an employer, you'll have access to our cutting-edge financial roguelike game.
To get started, please enter your account details below.
```

```markdown
# Bank Onboarding Screen

Hello and welcome to Point Zero One Digital!
As a bank, you can leverage our sovereign infrastructure architect design for optimal performance.
Enter your banking information to begin.
```

### Dashboards

Dashboard content will be organized by SKU and will provide users with relevant information tailored to their specific platform. For example:

```markdown
# Employer Dashboard

Welcome back, [Employer Name]!
Here's a summary of your current game progress:
- Games Played: 10
- High Score: 5000
- Next Level: Level 3
```

### Share Prompts

Share prompts will offer users the opportunity to invite others to join Point Zero One Digital, with content tailored to each SKU. For example:

```markdown
# Employer Share Prompt

Invite your colleagues to join you in our financial roguelike game!
Simply share this link and they'll be able to start playing right away.
[Share Link]
```

## Edge Cases

In the event of an edge case where content is not available for a specific SKU, a default message should be displayed:

```markdown
# Unsupported SKU

We're sorry, but we currently do not support this platform.
Please check back soon for updates and improvements.

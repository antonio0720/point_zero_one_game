# Verified Ritual States UI Copy

## Overview

This document outlines the UI copy for each state of a verified ritual in Point Zero One Digital's financial roguelike game. The states include proof minted, pending, stamped, and quarantined. Additionally, it includes celebration microcopy and non-accusatory failure copy.

## Non-negotiables

1. Precise, execution-grade language: Use clear, concise, and unambiguous language to ensure users understand the state of their ritual.
2. Anti-bureaucratic tone: Avoid jargon and bureaucratic language to maintain a user-friendly and approachable tone.
3. Deterministic effects: All UI copy should reflect the deterministic nature of the game, providing predictable and consistent information to users.

## Implementation Spec

### Proof Minted

```markdown
Your Verified Ritual has been successfully minted!
Proof ID: {proof_id}
```

### Pending

```markdown
Your Verified Ritual is currently pending review.
Please wait for confirmation before proceeding.
```

### Stamped

```markdown
Congratulations! Your Verified Ritual has been stamped by the network.
It will now be included in the next block and become part of the immutable ledger.
```

### Quarantined

```markdown
Your Verified Ritual has been quarantined due to an issue with its proof.
Please review your ritual details and resubmit if necessary.
```

## Edge Cases

In the event of a network error or other unexpected issues, the following failure copy will be displayed:

```markdown
An error occurred while processing your Verified Ritual.
Please try again later or contact support for assistance.

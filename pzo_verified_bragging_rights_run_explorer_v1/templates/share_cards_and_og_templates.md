# OG Image Templates and Share Card Copy by Verification Status

## Overview

This document outlines the creation of Open Graph (OG) image templates for Stamped, Pending, and Quarantined states in `pzo_verified_bragging_rights_run_explorer_v1`. Additionally, it provides share card copy by verification status, adhering to Point Zero One Digital's branded visual rules.

## Non-negotiables

1. Strict TypeScript usage with no 'any'.
2. All code is in strict mode.
3. Deterministic effects across all templates and share cards.
4. Adherence to Point Zero One Digital's brand guidelines for visual elements.

## Implementation Spec

### Stamped State

#### OG Image Template

```markdown
![Verified Badge]({{ assetUrl }}/images/verified_badge.png)
Game Title - Verified by Point Zero One Digital
{{ game_description }}
```

Replace `{{ assetUrl }}`, `Game Title`, and `game_description` with appropriate values.

#### Share Card Copy

```markdown
I've just achieved a verified score in **Game Title** by Point Zero One Digital! 🏆

Check out my run here: [Link to game]
```

### Pending State

#### OG Image Template

```markdown
![Pending Badge]({{ assetUrl }}/images/pending_badge.png)
Game Title - Pending Verification by Point Zero One Digital
{{ game_description }}
```

Replace `{{ assetUrl }}`, `Game Title`, and `game_description` with appropriate values.

#### Share Card Copy

```markdown
I've submitted a score in **Game Title** for verification by Point Zero One Digital! 🤞

Stay tuned for the results: [Link to game]
```

### Quarantined State

#### OG Image Template

```markdown
![Quarantine Badge]({{ assetUrl }}/images/quarantine_badge.png)
Game Title - Quarantined by Point Zero One Digital
{{ game_description }}
```

Replace `{{ assetUrl }}`, `Game Title`, and `game_description` with appropriate values.

#### Share Card Copy

```markdown
My score in **Game Title** has been quarantined by Point Zero One Digital. 😷

I'll need to review and resubmit: [Link to game]
```

## Edge Cases

1. If the game title contains special characters, ensure they are properly escaped in the OG image templates and share card copy.
2. Ensure that the asset URL is secure (HTTPS) for all images.
3. Provide fallback images for cases where the primary image fails to load.

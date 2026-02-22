# Point Zero One Digital Moment Catalog v1.0

## Overview

This document outlines the specifications for all HOS moment families in Point Zero One Digital's 12-minute financial roguelike game, including their codes, triggers, callout lines, angles, title templates, and retention hooks. Newly added are HOS-F: Comeback Arc and HOS-G: Underdog Win.

## Non-negotiables

1. Strict TypeScript adherence with no usage of 'any'.
2. All code is written in strict mode.
3. All effects are deterministic.
4. Precise, execution-grade language with zero fluff and anti-bureaucratic style.

## Implementation Spec

### HOS-A: Opportunity Flip
- Code: `op_flip`
- Trigger: Player encounters a profitable investment opportunity.
- Callout Line: "Seize the day!"
- Angle: 45 degrees
- Title Template: `Opportunity Flip - [Investment Name]`
- Retention Hook: "Don't miss out on future opportunities like this one."

### HOS-B: Disaster Hits
- Code: `dis_hit`
- Trigger: Player suffers a significant financial loss.
- Callout Line: "Better luck next time."
- Angle: 135 degrees
- Title Template: `Disaster Strikes - [Investment Name]`
- Retention Hook: "Learn from your mistakes and come back stronger."

### HOS-C: Missed the Bag
- Code: `miss_bag`
- Trigger: Player misses out on a lucrative investment.
- Callout Line: "Always be ready for the next opportunity."
- Angle: 225 degrees
- Title Template: `Missed the Bag - [Investment Name]`
- Retention Hook: "Don't let fear of missing out hold you back."

### HOS-D: Group Betrayal
- Code: `grp_betr`
- Trigger: A partner or ally betrays the player.
- Callout Line: "Trust no one."
- Angle: 315 degrees
- Title Template: `Group Betrayal - [Partner Name]`
- Retention Hook: "Remember who your true allies are."

### HOS-E: Teachability
- Code: `teach_abl`
- Trigger: Player learns a valuable lesson from an event.
- Callout Line: "Wisdom is the reward of a sober and serious mind."
- Angle: 0 degrees
- Title Template: `Teachable Moment - [Lesson Learned]`
- Retention Hook: "Keep learning, keep growing."

### HOS-F: Comeback Arc
- Code: `come_arc`
- Trigger: Player recovers from a significant financial loss.
- Callout Line: "Rise from the ashes."
- Angle: 90 degrees
- Title Template: `Comeback Arc - [Player Name]`
- Retention Hook: "Never give up, no matter how tough things get."

### HOS-G: Underdog Win
- Code: `underdog_win`
- Trigger: Player achieves a significant victory despite being at a disadvantage.
- Callout Line: "Against all odds."
- Angle: 270 degrees
- Title Template: `Underdog Win - [Player Name]`
- Retention Hook: "Believe in yourself and your abilities."

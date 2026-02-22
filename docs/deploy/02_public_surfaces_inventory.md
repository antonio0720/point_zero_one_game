# Public Surfaces Inventory

## Overview

This document outlines the inventory of every public URL surface in Point Zero One Digital's platform, including Integrity pages, Run Explorer routes, Leaderboards, Waitlist invite pages, Host OS landing, and Creator Studio. Each surface is detailed with its owner, rate limits, caching strategy, SEO/OG rules, and privacy defaults.

## Non-negotiables

1. Clarity: All information must be easily understandable to developers and non-developers alike.
2. Consistency: All surfaces should adhere to the same naming conventions, structure, and design principles.
3. Determinism: All effects on these surfaces should be predictable and reproducible.
4. Security: Privacy defaults and rate limits must prioritize user data protection and system stability.
5. Performance: Caching strategies should optimize load times and reduce server strain.
6. SEO Compliance: Surfaces should follow best practices for search engine optimization (SEO) and Open Graph (OG) rules.

## Implementation Spec

### Integrity pages
- Owner: Trust & Safety team
- Rate limits: None (publicly accessible)
- Caching strategy: Static caching for 1 hour, dynamic caching for 30 minutes
- SEO/OG rules: Custom title and description per page, Open Graph images provided
- Privacy defaults: Public access with no personal data disclosure

### Run Explorer routes
- Owner: Game Development team
- Rate limits: 10 requests per minute per IP address
- Caching strategy: Static caching for 5 minutes, dynamic caching for 30 seconds
- SEO/OG rules: Custom title and description per game, Open Graph images provided
- Privacy defaults: Public access with no personal data disclosure

### Leaderboards
- Owner: Game Development team
- Rate limits: 1 request per minute per IP address
- Caching strategy: Static caching for 5 minutes, dynamic caching for 30 seconds
- SEO/OG rules: Custom title and description per leaderboard, Open Graph images provided
- Privacy defaults: Public access with no personal data disclosure

### Waitlist invite pages
- Owner: Marketing team
- Rate limits: None (publicly accessible)
- Caching strategy: Static caching for 1 hour, dynamic caching disabled
- SEO/OG rules: Custom title and description, Open Graph images provided
- Privacy defaults: Public access with no personal data disclosure

### Host OS landing
- Owner: Infrastructure team
- Rate limits: None (publicly accessible)
- Caching strategy: Static caching for 1 hour, dynamic caching disabled
- SEO/OG rules: Custom title and description, Open Graph images provided
- Privacy defaults: Public access with no personal data disclosure

### Creator Studio
- Owner: Creator Relations team
- Rate limits: 5 requests per minute per IP address
- Caching strategy: Static caching for 1 hour, dynamic caching for 30 minutes
- SEO/OG rules: Custom title and description per creator, Open Graph images provided
- Privacy defaults: Authenticated access with personal data disclosure limited to the authenticated user

## Edge Cases

In case of a conflict between the non-negotiables or specific implementation details, prioritize security and privacy concerns over performance or SEO considerations. If a surface requires an exception to any rule, document the reason and proposed solution in a ticket for review by the relevant team leads.

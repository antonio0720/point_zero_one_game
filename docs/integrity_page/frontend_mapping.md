Title: Frontend Mapping for Integrity Page

Overview
---------

This document outlines the component tree, route map, and anchor links for the Integrity page in Point Zero One Digital's 12-minute financial roguelike game. The frontend is designed with strict TypeScript, adhering to production-grade and deployment-ready sovereign infrastructure architect principles.

Non-negotiables
----------------

1. Strict TypeScript: All code will be written in TypeScript, ensuring type safety and readability.
2. Strict Mode: All TypeScript files will be compiled with strict mode enabled for enhanced type checking.
3. Deterministic Effects: All effects within the Integrity page will be deterministic to ensure consistent user experiences.
4. Anchor Links: Each section under the /integrity route will have a corresponding anchor link for easy navigation.
5. Component Tree: The frontend will follow a well-structured component tree for maintainability and scalability.
6. Route Map: A clear route map will be defined to manage navigation within the Integrity page.

Implementation Spec
--------------------

### Component Tree

```
IntegrityPage
  |
  +-- Header (Navigation, Title)
  |
  +-- MainContent
        |
        +-- Section1 (Introduction)
        |
        +-- Section2 (Game Overview)
        |
        +-- Section3 (Infrastructure Architecture)
        |
        +-- Section4 (Code Standards)
        |
        +-- Section5 (Deterministic Effects)
        |
        +-- Footer (Credits, Legal Information)
```

### Route Map

- `/integrity`: Main Integrity page with all sections.
- `/integrity/#section1`: Navigate directly to Section 1 (Introduction).
- ... and so on for each section.

Edge Cases
----------

1. If a user navigates to an unknown section, redirect them to the main Integrity page (`/integrity`).
2. Ensure that anchor links are case-insensitive to accommodate users who may use different capitalization when navigating.
3. Implement fallback mechanisms for browsers that do not support HTML5 history API or JavaScript. In such cases, display a message informing the user about the issue and provide a link to the main Integrity page (`/integrity`).
